import type { CapaAction, EscalationRule, Prisma, Priority, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { DAY_MS } from '@/lib/utils';
import {
  ACTIVE_CAPA_STATUSES, DEFAULT_ESCALATION, daysOverdue, MAX_ESCALATION_LEVEL, type EscalationStep,
} from './workflow';

type Candidate = Pick<CapaAction, 'id' | 'siteId' | 'priority' | 'dueDate' | 'escalationLevel' | 'assigneeId' | 'referenceNo'>;

const stepsFor = (rules: EscalationRule[], siteId: string, priority: Priority): EscalationStep[] => {
  const custom = rules
    .filter((r) => r.siteId === siteId && r.priority === priority)
    .sort((a, b) => a.level - b.level);
  return custom.length > 0 ? custom : DEFAULT_ESCALATION[priority];
};

/** Earliest-created active user with the role at the site, never the assignee; falls back to an admin. */
async function pickTarget(tx: Prisma.TransactionClient, siteId: string, role: Role, excludeUserId: string) {
  const find = (r: Role) =>
    tx.user.findFirst({
      where: {
        isActive: true, role: r, id: { not: excludeUserId },
        ...(r === 'ADMIN' ? {} : { sites: { some: { siteId } } }),
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  return (await find(role)) ?? (role === 'ADMIN' ? null : await find('ADMIN'));
}

async function escalateOne(c: Candidate, rules: EscalationRule[], now: Date): Promise<number> {
  const steps = stepsFor(rules, c.siteId, c.priority);
  const overdue = daysOverdue(c.dueDate, now);
  let level = c.escalationLevel;
  let escalated = 0;

  // Climb as many rungs as the overdue time justifies, one audited event per rung.
  for (;;) {
    const next = steps.find((s) => s.level === level + 1);
    if (!next || next.afterDaysOverdue > overdue || next.level > MAX_ESCALATION_LEVEL) break;

    const outcome = await prisma.$transaction(async (tx) => {
      const target = await pickTarget(tx, c.siteId, next.escalateToRole, c.assigneeId);
      if (!target) return 'no_target' as const;

      // Guarded write: a concurrent run or a manual escalation makes count 0 and we stop.
      const moved = await tx.capaAction.updateMany({
        where: { id: c.id, escalationLevel: level, status: { in: ACTIVE_CAPA_STATUSES } },
        data: { escalationLevel: next.level, escalatedToId: target.id, lastEscalatedAt: now },
      });
      if (moved.count === 0) return 'stale' as const;

      await tx.capaEscalation.create({
        data: {
          capaId: c.id, level: next.level, toUserId: target.id, trigger: 'AUTOMATIC',
          reason: `Overdue by ${overdue} day${overdue === 1 ? '' : 's'} (${c.priority.toLowerCase()} priority)`,
          daysOverdue: overdue,
        },
      });
      await logActivity(tx, {
        siteId: c.siteId, actorId: null, entityType: 'CAPA', entityId: c.id,
        action: 'capa.escalated', metadata: { level: next.level, toUserId: target.id, trigger: 'AUTOMATIC', daysOverdue: overdue },
      });
      return 'ok' as const;
    });

    if (outcome !== 'ok') break;
    level = next.level;
    escalated++;
  }
  return escalated;
}

/** Idempotent: safe to run hourly or daily, and safe to run concurrently. */
export async function runCapaEscalationSweep(now = new Date()) {
  const candidates = await prisma.capaAction.findMany({
    where: {
      status: { in: ACTIVE_CAPA_STATUSES },
      dueDate: { lte: new Date(now.getTime() - DAY_MS) }, // due date fully elapsed
      escalationLevel: { lt: MAX_ESCALATION_LEVEL },
    },
    select: { id: true, siteId: true, priority: true, dueDate: true, escalationLevel: true, assigneeId: true, referenceNo: true },
  });

  const rules = candidates.length
    ? await prisma.escalationRule.findMany({ where: { siteId: { in: [...new Set(candidates.map((c) => c.siteId))] } } })
    : [];

  const result = { checked: candidates.length, escalations: 0, failed: [] as string[] };
  for (const c of candidates) {
    try {
      result.escalations += await escalateOne(c, rules, now);
    } catch (e) {
      console.error(`Escalation failed for ${c.referenceNo}`, e); // one bad row must not stop the sweep
      result.failed.push(c.referenceNo);
    }
  }
  return result;
}
