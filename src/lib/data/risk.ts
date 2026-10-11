import type { AssessmentStatus, AssessmentType, Prisma, RiskLevel } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { LEVEL_META, maxLevel } from '@/lib/risk/matrix';
import { ASSESSMENT_STATUS_LABEL, ASSESSMENT_TYPE_LABEL, isReviewOverdue } from '@/lib/risk/workflow';
import type { TimelineEntry } from '@/types/incidents';
import type { AssessmentView, HazardView, RegisterRow } from '@/types/risk';
import { one, pick, type SearchParams } from './params';

export type RiskFilters = {
  q?: string; type?: AssessmentType; status?: AssessmentStatus; level?: RiskLevel; overdue?: boolean;
};

export function parseRiskFilters(sp: SearchParams): RiskFilters {
  return {
    q: one(sp, 'q')?.trim() || undefined,
    type: pick<AssessmentType>(one(sp, 'type'), ASSESSMENT_TYPE_LABEL),
    status: pick<AssessmentStatus>(one(sp, 'status'), ASSESSMENT_STATUS_LABEL),
    level: pick<RiskLevel>(one(sp, 'level'), LEVEL_META),
    overdue: one(sp, 'overdue') === '1',
  };
}

export async function getAssessments(siteId: string, f: RiskFilters): Promise<RegisterRow[]> {
  const now = new Date();
  const overdue = f.overdue || f.status === 'EXPIRED';
  const statusClause: Prisma.RiskAssessmentWhereInput = overdue
    ? { status: 'APPROVED', nextReviewDate: { lt: now } }
    : f.status ? { status: f.status } : { status: { not: 'ARCHIVED' } };

  const rows = await prisma.riskAssessment.findMany({
    where: {
      siteId,
      ...statusClause,
      ...(f.type && { type: f.type }),
      ...(f.q && {
        OR: [
          { title: { contains: f.q, mode: 'insensitive' } },
          { referenceNo: { contains: f.q, mode: 'insensitive' } },
          { activity: { contains: f.q, mode: 'insensitive' } },
          { area: { contains: f.q, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      id: true, referenceNo: true, version: true, title: true, type: true, area: true, status: true, nextReviewDate: true,
      hazards: { select: { initialLevel: true, residualLevel: true } },
    },
  });

  const mapped = rows.map<RegisterRow>((r) => ({
    id: r.id, referenceNo: r.referenceNo, version: r.version, title: r.title, type: r.type, area: r.area, status: r.status,
    hazardCount: r.hazards.length,
    peakResidual: maxLevel(r.hazards.map((h) => h.residualLevel)),
    peakInitial: maxLevel(r.hazards.map((h) => h.initialLevel)),
    nextReviewDate: r.nextReviewDate,
    reviewOverdue: isReviewOverdue(r, now),
  }));
  return f.level ? mapped.filter((r) => (r.peakResidual ?? r.peakInitial) === f.level) : mapped;
}

export async function getRiskStats(siteId: string) {
  const now = new Date();
  const [approved, inReview, drafts, overdue, openHigh] = await Promise.all([
    prisma.riskAssessment.count({ where: { siteId, status: 'APPROVED' } }),
    prisma.riskAssessment.count({ where: { siteId, status: 'IN_REVIEW' } }),
    prisma.riskAssessment.count({ where: { siteId, status: 'DRAFT' } }),
    prisma.riskAssessment.count({ where: { siteId, status: 'APPROVED', nextReviewDate: { lt: now } } }),
    prisma.hazardItem.count({
      where: { residualLevel: { in: ['HIGH', 'EXTREME'] }, riskAssessment: { siteId, status: 'APPROVED' } },
    }),
  ]);
  return { approved, inReview, drafts, overdue, openHigh };
}

/** Site-scoped: an assessment from another site returns null (the page 404s). */
export async function getAssessmentDetail(id: string, siteId: string): Promise<AssessmentView | null> {
  const a = await prisma.riskAssessment.findFirst({
    where: { id, siteId },
    include: {
      assessor: { select: { fullName: true } },
      approver: { select: { fullName: true } },
      hazards: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { responsible: { select: { fullName: true } } },
      },
    },
  });
  if (!a) return null;

  const versions = await prisma.riskAssessment.findMany({
    where: { siteId, referenceNo: a.referenceNo },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, status: true },
  });

  const hazards = a.hazards.map<HazardView>((h) => ({
    id: h.id, sortOrder: h.sortOrder, taskStep: h.taskStep, hazard: h.hazard, consequence: h.consequence,
    whoAtRisk: h.whoAtRisk, initialLikelihood: h.initialLikelihood, initialSeverity: h.initialSeverity,
    initialScore: h.initialScore, initialLevel: h.initialLevel, controlMeasures: h.controlMeasures,
    controlHierarchy: h.controlHierarchy, requiredPpe: h.requiredPpe, residualLikelihood: h.residualLikelihood,
    residualSeverity: h.residualSeverity, residualScore: h.residualScore, residualLevel: h.residualLevel,
    responsibleId: h.responsibleId, responsibleName: h.responsible?.fullName ?? null,
  }));

  return {
    id: a.id, referenceNo: a.referenceNo, version: a.version, status: a.status, type: a.type, title: a.title,
    activity: a.activity, area: a.area, scope: a.scope, teamMembers: a.teamMembers, assessorId: a.assessorId,
    assessorName: a.assessor.fullName, approverName: a.approver?.fullName ?? null, assessedAt: a.assessedAt,
    submittedAt: a.submittedAt, approvedAt: a.approvedAt, approvalNotes: a.approvalNotes,
    nextReviewDate: a.nextReviewDate, hazards, versions,
  };
}

export async function getRiskTimeline(siteId: string, assessmentId: string): Promise<TimelineEntry[]> {
  const logs = await prisma.activityLog.findMany({
    where: { siteId, entityType: 'RISK_ASSESSMENT', entityId: assessmentId },
    include: { actor: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return logs.map((l) => ({
    id: l.id, entityType: l.entityType, entityId: l.entityId, action: l.action,
    metadata: l.metadata && typeof l.metadata === 'object' && !Array.isArray(l.metadata) ? (l.metadata as Record<string, unknown>) : {},
    actorName: l.actor?.fullName ?? null, createdAt: l.createdAt,
  }));
}
