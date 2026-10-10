import type { IncidentSeverity, IncidentStatus, IncidentType, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DAY_MS } from '@/lib/utils';
import { OPEN_CAPA_STATUSES } from '@/lib/incidents/workflow';
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, SEVERITY_LABEL } from '@/lib/incidents-meta';
import type { RcaView, TimelineEntry, WhyStep } from '@/types/incidents';
import { capaCardInclude, toCapaCard } from './capa';
import { one, pick, type SearchParams } from './params';

export type IncidentFilters = {
  q?: string; status?: IncidentStatus; severity?: IncidentSeverity; type?: IncidentType; openOnly?: boolean;
};

export function parseIncidentFilters(sp: SearchParams): IncidentFilters {
  return {
    q: one(sp, 'q')?.trim() || undefined,
    status: pick<IncidentStatus>(one(sp, 'status'), INCIDENT_STATUS_LABEL),
    severity: pick<IncidentSeverity>(one(sp, 'severity'), SEVERITY_LABEL),
    type: pick<IncidentType>(one(sp, 'type'), INCIDENT_TYPE_LABEL),
    openOnly: one(sp, 'open') === '1',
  };
}

export function getIncidents(siteId: string, f: IncidentFilters) {
  const where: Prisma.IncidentWhereInput = {
    siteId,
    ...(f.status ? { status: f.status } : f.openOnly ? { status: { not: 'CLOSED' } } : {}),
    ...(f.severity && { severity: f.severity }),
    ...(f.type && { type: f.type }),
    ...(f.q && {
      OR: [
        { title: { contains: f.q, mode: 'insensitive' } },
        { referenceNo: { contains: f.q, mode: 'insensitive' } },
        { location: { contains: f.q, mode: 'insensitive' } },
      ],
    }),
  };
  return prisma.incident.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    take: 200,
    select: {
      id: true, referenceNo: true, title: true, type: true, severity: true, status: true,
      occurredAt: true, location: true, isRecordable: true, isReportableToAuthority: true,
      _count: { select: { capaActions: { where: { status: { in: OPEN_CAPA_STATUSES } } } } },
    },
  });
}

export async function getIncidentStats(siteId: string) {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [open, underInvestigation, lastLti, recordableYtd] = await Promise.all([
    prisma.incident.count({ where: { siteId, status: { not: 'CLOSED' } } }),
    prisma.incident.count({ where: { siteId, status: 'UNDER_INVESTIGATION' } }),
    prisma.incident.findFirst({
      where: { siteId, OR: [{ lostTimeDays: { gt: 0 } }, { fatalityCount: { gt: 0 } }] },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    }),
    prisma.incident.count({ where: { siteId, isRecordable: true, occurredAt: { gte: yearStart } } }),
  ]);
  return {
    open, underInvestigation, recordableYtd,
    /** null = no lost-time incident has ever been recorded for this site. */
    daysSinceLastLti: lastLti ? Math.max(0, Math.floor((now.getTime() - lastLti.occurredAt.getTime()) / DAY_MS)) : null,
  };
}

export function parseWhyChain(v: unknown): WhyStep[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x, i) => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    return [{ level: Number(r.level) || i + 1, why: String(r.why ?? ''), answer: String(r.answer ?? '') }];
  });
}

type RcaRow = Prisma.RcaAnalysisGetPayload<{
  include: { lead: { select: { fullName: true } }; approver: { select: { fullName: true } } };
}>;

const toRcaView = (r: RcaRow): RcaView => ({
  id: r.id, status: r.status, method: r.method, leadId: r.leadId, leadName: r.lead.fullName,
  approverName: r.approver?.fullName ?? null, problemStatement: r.problemStatement,
  whyChain: parseWhyChain(r.whyChain), rootCause: r.rootCause, rootCauseCategory: r.rootCauseCategory,
  contributingFactors: r.contributingFactors, completedAt: r.completedAt, approvedAt: r.approvedAt,
});

/** Site-scoped: an incident from another site returns null (the page 404s). */
export async function getIncidentDetail(id: string, siteId: string) {
  const inc = await prisma.incident.findFirst({
    where: { id, siteId },
    include: {
      reporter: { select: { fullName: true } },
      rca: { include: { lead: { select: { fullName: true } }, approver: { select: { fullName: true } } } },
      capaActions: { orderBy: { dueDate: 'asc' }, include: capaCardInclude },
    },
  });
  if (!inc) return null;
  const { rca, capaActions, reporter, ...incident } = inc;
  const now = new Date();
  return {
    incident,
    reporterName: reporter.fullName,
    rca: rca ? toRcaView(rca) : null,
    capas: capaActions.map((c) => toCapaCard(c, now)),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Merges incident, RCA and CAPA activity into one newest-first feed, and resolves user ids to names. */
export async function getIncidentTimeline(
  siteId: string,
  ids: { incidentId: string; rcaId?: string | null; capaIds: string[] },
) {
  const logs = await prisma.activityLog.findMany({
    where: {
      siteId,
      OR: [
        { entityType: 'INCIDENT', entityId: ids.incidentId },
        ...(ids.rcaId ? [{ entityType: 'RCA' as const, entityId: ids.rcaId }] : []),
        ...(ids.capaIds.length ? [{ entityType: 'CAPA' as const, entityId: { in: ids.capaIds } }] : []),
      ],
    },
    include: { actor: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const entries: TimelineEntry[] = logs.map((l) => ({
    id: l.id, entityType: l.entityType, entityId: l.entityId, action: l.action,
    metadata: asRecord(l.metadata), actorName: l.actor?.fullName ?? null, createdAt: l.createdAt,
  }));

  const userIds = new Set<string>();
  for (const e of entries) {
    for (const k of ['from', 'to', 'toUserId', 'leadId', 'assigneeId']) {
      const v = e.metadata[k];
      if (typeof v === 'string' && UUID.test(v)) userIds.add(v);
    }
  }
  const users = userIds.size
    ? await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, fullName: true } })
    : [];
  return { entries, names: Object.fromEntries(users.map((u) => [u.id, u.fullName])) as Record<string, string> };
}

export function getSiteUsersWithRole(siteId: string, roles?: Role[]) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      ...(roles && { role: { in: roles } }),
      OR: [{ role: 'ADMIN' }, { sites: { some: { siteId } } }],
    },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: 'asc' },
  });
}
