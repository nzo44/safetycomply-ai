import type { CapaStatus, Prisma, Priority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DAY_MS } from '@/lib/utils';
import { PRIORITY_LABEL } from '@/lib/compliance-meta';
import { ACTIVE_CAPA_STATUSES, daysOverdue, isCapaOverdue, OPEN_CAPA_STATUSES } from '@/lib/incidents/workflow';
import type { CapaCardData } from '@/types/incidents';
import { one, pick, type SearchParams } from './params';

export const capaCardInclude = {
  assignee: { select: { id: true, fullName: true } },
  escalatedTo: { select: { fullName: true } },
  incident: { select: { id: true, referenceNo: true } },
  inspection: { select: { id: true, referenceNo: true } },
} satisfies Prisma.CapaActionInclude;

type CapaRow = Prisma.CapaActionGetPayload<{ include: typeof capaCardInclude }>;

export function toCapaCard(c: CapaRow, now = new Date()): CapaCardData {
  return {
    id: c.id, referenceNo: c.referenceNo, title: c.title, description: c.description,
    type: c.type, status: c.status, priority: c.priority,
    assigneeId: c.assigneeId, assigneeName: c.assignee.fullName,
    dueDate: c.dueDate,
    overdueDays: isCapaOverdue(c, now) ? daysOverdue(c.dueDate, now) : null,
    escalationLevel: c.escalationLevel, escalatedToName: c.escalatedTo?.fullName ?? null,
    incidentId: c.incident?.id ?? null, incidentRef: c.incident?.referenceNo ?? null,
    inspectionId: c.inspection?.id ?? null, inspectionRef: c.inspection?.referenceNo ?? null,
    completionNotes: c.completionNotes, effectivenessNotes: c.effectivenessNotes,
  };
}

export type CapaFilters = {
  q?: string; priority?: Priority; assignee?: string; overdue?: boolean; escalated?: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCapaFilters(sp: SearchParams): CapaFilters {
  const assignee = one(sp, 'assignee');
  return {
    q: one(sp, 'q')?.trim() || undefined,
    priority: pick<Priority>(one(sp, 'priority'), PRIORITY_LABEL),
    assignee: assignee === 'me' || (assignee && UUID.test(assignee)) ? assignee : undefined,
    overdue: one(sp, 'overdue') === '1',
    escalated: one(sp, 'escalated') === '1',
  };
}

/** Open work plus anything closed in the last 30 days. */
export async function getCapaBoard(siteId: string, f: CapaFilters, viewerId: string) {
  const now = new Date();
  const where: Prisma.CapaActionWhereInput = {
    siteId,
    AND: [
      { OR: [{ status: { in: OPEN_CAPA_STATUSES } }, { status: 'CLOSED', verifiedAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } }] },
      ...(f.q
        ? [{ OR: [{ title: { contains: f.q, mode: 'insensitive' as const } }, { referenceNo: { contains: f.q, mode: 'insensitive' as const } }] }]
        : []),
    ],
    ...(f.priority && { priority: f.priority }),
    ...(f.assignee && { assigneeId: f.assignee === 'me' ? viewerId : f.assignee }),
    ...(f.escalated && { escalationLevel: { gt: 0 } }),
    ...(f.overdue && { status: { in: ACTIVE_CAPA_STATUSES }, dueDate: { lte: new Date(now.getTime() - DAY_MS) } }),
  };
  const rows = await prisma.capaAction.findMany({
    where, include: capaCardInclude, orderBy: { dueDate: 'asc' }, take: 300,
  });
  return rows.map((r) => toCapaCard(r, now));
}

export async function getCapaStats(siteId: string) {
  const cutoff = new Date(Date.now() - DAY_MS);
  const [byStatus, overdue, escalated] = await Promise.all([
    prisma.capaAction.groupBy({ by: ['status'], where: { siteId }, _count: { _all: true } }),
    prisma.capaAction.count({ where: { siteId, status: { in: ACTIVE_CAPA_STATUSES }, dueDate: { lte: cutoff } } }),
    prisma.capaAction.count({ where: { siteId, status: { in: ACTIVE_CAPA_STATUSES }, escalationLevel: { gt: 0 } } }),
  ]);
  const n = (s: CapaStatus) => byStatus.find((g) => g.status === s)?._count._all ?? 0;
  return {
    open: n('OPEN') + n('IN_PROGRESS') + n('PENDING_VERIFICATION'),
    pendingVerification: n('PENDING_VERIFICATION'),
    overdue,
    escalated,
  };
}
