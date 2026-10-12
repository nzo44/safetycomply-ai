import type { AuditStandard, InspectionStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DAY_MS } from '@/lib/utils';
import {
  INSPECTION_FILTER_LABEL, STANDARD_LABEL, WORKABLE_STATUSES, isInspectionOverdue,
} from '@/lib/audits/meta';
import type { TimelineEntry } from '@/types/incidents';
import type {
  DetailItem, ExecutionData, InspectionDetail, InspectionRow, NcrLite, NcrRegisterRow, NcrTarget,
} from '@/types/audits';
import { one, pick, type SearchParams } from './params';

export const AUDIT_PAGE_SIZE = 20;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (v?: string) => (v && DATE.test(v) && !Number.isNaN(Date.parse(v)) ? new Date(`${v}T00:00:00.000Z`) : undefined);

export type InspectionFilters = {
  q?: string; standard?: AuditStandard; status?: InspectionStatus | 'OVERDUE'; from?: Date; to?: Date; page: number;
};

export function parseInspectionFilters(sp: SearchParams): InspectionFilters {
  return {
    q: one(sp, 'q')?.trim() || undefined,
    standard: pick<AuditStandard>(one(sp, 'standard'), STANDARD_LABEL),
    status: pick<InspectionStatus | 'OVERDUE'>(one(sp, 'status'), INSPECTION_FILTER_LABEL),
    from: toDate(one(sp, 'from')),
    to: toDate(one(sp, 'to')),
    page: Math.min(10_000, Math.max(1, parseInt(one(sp, 'page') ?? '1', 10) || 1)),
  };
}

export async function getInspections(siteId: string, f: InspectionFilters) {
  const now = new Date();
  const where: Prisma.AuditInspectionWhereInput = {
    siteId,
    ...(f.status === 'OVERDUE'
      ? { status: { in: WORKABLE_STATUSES }, scheduledDate: { lte: new Date(now.getTime() - DAY_MS) } }
      : f.status ? { status: f.status } : {}),
    ...(f.standard && { checklist: { standard: f.standard } }),
    ...((f.from || f.to) && f.status !== 'OVERDUE' ? { scheduledDate: { ...(f.from && { gte: f.from }), ...(f.to && { lte: f.to }) } } : {}),
    ...(f.q && {
      OR: [
        { referenceNo: { contains: f.q, mode: 'insensitive' } },
        { checklist: { title: { contains: f.q, mode: 'insensitive' } } },
        { inspector: { fullName: { contains: f.q, mode: 'insensitive' } } },
      ],
    }),
  };

  const total = await prisma.auditInspection.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(f.page, pageCount);

  const rows = await prisma.auditInspection.findMany({
    where,
    orderBy: [{ scheduledDate: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * AUDIT_PAGE_SIZE,
    take: AUDIT_PAGE_SIZE,
    include: {
      inspector: { select: { fullName: true } },
      checklist: { select: { title: true, standard: true, _count: { select: { questions: true } } } },
      _count: { select: { responses: true, ncrs: { where: { status: { not: 'CLOSED' } } } } },
    },
  });

  const mapped: InspectionRow[] = rows.map((r) => ({
    id: r.id, referenceNo: r.referenceNo, checklistTitle: r.checklist.title, standard: r.checklist.standard,
    inspectorId: r.inspectorId, inspectorName: r.inspector.fullName, scheduledDate: r.scheduledDate,
    completedDate: r.completedDate, scorePercentage: r.scorePercentage?.toNumber() ?? null, status: r.status,
    overdue: isInspectionOverdue(r, now), answered: r._count.responses, totalQuestions: r.checklist._count.questions,
    openNcrs: r._count.ncrs,
  }));
  return { rows: mapped, total, page, pageCount, pageSize: AUDIT_PAGE_SIZE };
}

/** Trailing 12 months for completed audits and the average score. NCRs and overdue are current. */
export async function getAuditStats(siteId: string) {
  const now = new Date();
  const since = new Date(now.getTime() - 365 * DAY_MS);
  const [done, openNcrs, overdue] = await Promise.all([
    prisma.auditInspection.aggregate({
      where: { siteId, status: 'COMPLETED', completedDate: { gte: since } },
      _count: { _all: true }, _avg: { scorePercentage: true },
    }),
    prisma.nonConformanceReport.count({ where: { siteId, status: { in: ['OPEN', 'CAPA_ISSUED'] } } }),
    prisma.auditInspection.count({
      where: { siteId, status: { in: WORKABLE_STATUSES }, scheduledDate: { lte: new Date(now.getTime() - DAY_MS) } },
    }),
  ]);
  return { completed: done._count._all, avgScore: done._avg.scorePercentage?.toNumber() ?? null, openNcrs, overdue };
}

/** Open NCRs for the register's second tab, newest first. */
export async function getNcrRegister(siteId: string): Promise<NcrRegisterRow[]> {
  const rows = await prisma.nonConformanceReport.findMany({
    where: { siteId, status: { in: ['OPEN', 'CAPA_ISSUED'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      inspection: { select: { id: true, referenceNo: true } },
      capa: { select: { referenceNo: true } },
    },
  });
  return rows.map((n) => ({
    id: n.id, referenceNo: n.referenceNo, severity: n.severity, status: n.status, summary: n.summary,
    inspectionId: n.inspection.id, inspectionRef: n.inspection.referenceNo, capaRef: n.capa?.referenceNo ?? null,
    createdAt: n.createdAt,
  }));
}

export async function getChecklistOptions() {
  const rows = await prisma.auditChecklist.findMany({
    orderBy: [{ standard: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, standard: true, _count: { select: { questions: true } } },
  });
  return rows.map((c) => ({ value: c.id, label: `${c.title} (${STANDARD_LABEL[c.standard]}, ${c._count.questions} questions)` }));
}

/** Site-scoped: another site's inspection returns null (the page 404s). */
export async function getExecutionData(id: string, siteId: string): Promise<ExecutionData | null> {
  const i = await prisma.auditInspection.findFirst({
    where: { id, siteId },
    include: {
      inspector: { select: { fullName: true } },
      checklist: {
        select: {
          title: true, standard: true,
          questions: { orderBy: { sortOrder: 'asc' }, select: { id: true, category: true, question: true, guidanceNote: true, weight: true } },
        },
      },
      responses: { select: { questionId: true, result: true, findingDescription: true, evidenceUrls: true, ncr: { select: { id: true } } } },
    },
  });
  if (!i) return null;
  return {
    inspection: {
      id: i.id, referenceNo: i.referenceNo, checklistTitle: i.checklist.title, standard: i.checklist.standard,
      status: i.status, inspectorId: i.inspectorId, inspectorName: i.inspector.fullName,
    },
    questions: i.checklist.questions,
    responses: i.responses.map((r) => ({
      questionId: r.questionId, result: r.result, findingDescription: r.findingDescription,
      evidenceUrls: r.evidenceUrls, hasNcr: r.ncr !== null,
    })),
  };
}

export async function getInspectionDetail(id: string, siteId: string): Promise<InspectionDetail | null> {
  const i = await prisma.auditInspection.findFirst({
    where: { id, siteId },
    include: {
      inspector: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
      checklist: {
        select: {
          title: true, standard: true, description: true,
          questions: { orderBy: { sortOrder: 'asc' }, select: { id: true, category: true, question: true, guidanceNote: true, weight: true } },
        },
      },
      responses: {
        include: { ncr: { include: { capa: { select: { id: true, referenceNo: true } }, raisedBy: { select: { fullName: true } } } } },
      },
    },
  });
  if (!i) return null;

  const byQuestion = new Map(i.responses.map((r) => [r.questionId, r]));
  const lite = (n: NonNullable<(typeof i.responses)[number]['ncr']>): NcrLite => ({
    id: n.id, referenceNo: n.referenceNo, severity: n.severity, status: n.status, summary: n.summary,
    containmentActions: n.containmentActions,
    capaId: n.capa?.id ?? null, capaRef: n.capa?.referenceNo ?? null, closureNotes: n.closureNotes,
  });

  const categories: InspectionDetail['categories'] = [];
  for (const q of i.checklist.questions) {
    const r = byQuestion.get(q.id);
    const item: DetailItem = {
      questionId: q.id, question: q.question, guidanceNote: q.guidanceNote, weight: q.weight,
      result: r?.result ?? null, findingDescription: r?.findingDescription ?? null, evidenceUrls: r?.evidenceUrls ?? [],
      responseId: r?.id ?? null, ncr: r?.ncr ? lite(r.ncr) : null,
    };
    const group = categories.find((c) => c.category === q.category);
    if (group) group.items.push(item);
    else categories.push({ category: q.category, items: [item] });
  }

  const ncrs = i.responses
    .flatMap((r) => (r.ncr ? [{ ...lite(r.ncr), question: i.checklist.questions.find((q) => q.id === r.questionId)?.question ?? '', raisedByName: r.ncr.raisedBy.fullName }] : []))
    .sort((a, b) => a.referenceNo.localeCompare(b.referenceNo));

  return {
    id: i.id, referenceNo: i.referenceNo, status: i.status, overdue: isInspectionOverdue(i),
    checklistTitle: i.checklist.title, checklistDescription: i.checklist.description, standard: i.checklist.standard,
    inspectorId: i.inspectorId, inspectorName: i.inspector.fullName, createdByName: i.createdBy.fullName,
    scheduledDate: i.scheduledDate, startedAt: i.startedAt, completedDate: i.completedDate,
    scorePercentage: i.scorePercentage?.toNumber() ?? null, cancelReason: i.cancelReason, categories, ncrs,
  };
}

const ncrTargetInclude = {
  inspection: { select: { id: true, referenceNo: true, status: true } },
  question: { select: { question: true, category: true } },
  ncr: { select: { id: true, referenceNo: true, severity: true, summary: true, status: true, capaTaskId: true } },
} satisfies Prisma.InspectionResponseInclude;

function toNcrTarget(r: Prisma.InspectionResponseGetPayload<{ include: typeof ncrTargetInclude }>): NcrTarget {
  let reason: string | null = null;
  if (r.result !== 'NON_COMPLIANT') reason = 'Only failed items can have an NCR.';
  else if (r.inspection.status !== 'IN_PROGRESS' && r.inspection.status !== 'COMPLETED') reason = 'The inspection is not open.';
  else if (r.ncr && !(r.ncr.status === 'OPEN' && !r.ncr.capaTaskId)) reason = `${r.ncr.referenceNo} already has an action or is closed.`;

  return {
    responseId: r.id, inspectionId: r.inspection.id, inspectionRef: r.inspection.referenceNo,
    question: r.question.question, category: r.question.category, finding: r.findingDescription ?? '',
    ncr: r.ncr ? { id: r.ncr.id, referenceNo: r.ncr.referenceNo, severity: r.ncr.severity, summary: r.ncr.summary } : null,
    eligible: reason === null, reason,
  };
}

export async function getNcrTarget(responseId: string, siteId: string): Promise<NcrTarget | null> {
  const r = await prisma.inspectionResponse.findFirst({
    where: { id: responseId, inspection: { siteId } }, include: ncrTargetInclude,
  });
  return r ? toNcrTarget(r) : null;
}

/** Same lookup by checklist question, so the execution drawer can link to a fail it just saved. */
export async function getNcrTargetByQuestion(inspectionId: string, questionId: string, siteId: string): Promise<NcrTarget | null> {
  const r = await prisma.inspectionResponse.findFirst({
    where: { inspectionId, questionId, inspection: { siteId } }, include: ncrTargetInclude,
  });
  return r ? toNcrTarget(r) : null;
}

/** Open actions at the site that can be linked to an NCR. */
export async function getLinkableCapas(siteId: string) {
  const rows = await prisma.capaAction.findMany({
    where: { siteId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    orderBy: { dueDate: 'asc' }, take: 100, select: { id: true, referenceNo: true, title: true },
  });
  return rows.map((c) => ({ value: c.id, label: `${c.referenceNo}: ${c.title}` }));
}

export async function getAuditTimeline(siteId: string, inspectionId: string, ncrIds: string[]) {
  const logs = await prisma.activityLog.findMany({
    where: {
      siteId,
      OR: [
        { entityType: 'INSPECTION', entityId: inspectionId },
        ...(ncrIds.length ? [{ entityType: 'NCR' as const, entityId: { in: ncrIds } }] : []),
      ],
    },
    include: { actor: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const entries: TimelineEntry[] = logs.map((l) => ({
    id: l.id, entityType: l.entityType, entityId: l.entityId, action: l.action,
    metadata: l.metadata && typeof l.metadata === 'object' && !Array.isArray(l.metadata) ? (l.metadata as Record<string, unknown>) : {},
    actorName: l.actor?.fullName ?? null, createdAt: l.createdAt,
  }));
  const ids = [...new Set(entries.flatMap((e) => (typeof e.metadata.inspectorId === 'string' ? [e.metadata.inspectorId] : [])))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } }) : [];
  return { entries, names: Object.fromEntries(users.map((u) => [u.id, u.fullName])) as Record<string, string> };
}
