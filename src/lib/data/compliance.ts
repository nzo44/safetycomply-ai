import type { ComplianceStatus, Prisma, Priority, RequirementCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER } from '@/lib/compliance-meta';
import type { MatrixRow } from '@/types/compliance';
import { one, pick, type SearchParams } from './params';

export type MatrixFilters = {
  q?: string;
  category?: RequirementCategory;
  status?: ComplianceStatus;
  risk?: Priority;
  overdue?: boolean;
};

export function parseFilters(sp: SearchParams): MatrixFilters {
  return {
    q: one(sp, 'q')?.trim() || undefined,
    category: pick<RequirementCategory>(one(sp, 'category'), CATEGORY_LABEL),
    status: pick<ComplianceStatus>(one(sp, 'status'), STATUS_LABEL),
    risk: pick<Priority>(one(sp, 'risk'), PRIORITY_LABEL),
    overdue: one(sp, 'overdue') === '1',
  };
}

export async function getMatrix(siteId: string, f: MatrixFilters) {
  const where: Prisma.LegalRequirementWhereInput = {
    siteId,
    isActive: true,
    ...(f.category && { category: f.category }),
    ...(f.status && { currentStatus: f.status }),
    ...(f.overdue && { nextReviewDate: { lt: new Date() } }),
    ...(f.q && {
      OR: [
        { title: { contains: f.q, mode: 'insensitive' } },
        { citation: { contains: f.q, mode: 'insensitive' } },
        { authority: { contains: f.q, mode: 'insensitive' } },
      ],
    }),
  };

  const rows = await prisma.legalRequirement.findMany({
    where,
    include: {
      owner: { select: { id: true, fullName: true } },
      audits: {
        orderBy: { auditDate: 'desc' },
        take: 1,
        select: { auditDate: true, gapSeverity: true, evidenceUrls: true },
      },
    },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
    take: 500,
  });

  // "Latest audit" can't be expressed as a Prisma relation filter, so risk is filtered here.
  return f.risk ? rows.filter((r) => r.audits[0]?.gapSeverity === f.risk) : rows;
}

type MatrixQueryRow = Awaited<ReturnType<typeof getMatrix>>[number];

export function toMatrixRow(r: MatrixQueryRow): MatrixRow {
  const last = r.audits[0];
  const isGap = r.currentStatus === 'NON_COMPLIANT' || r.currentStatus === 'PARTIALLY_COMPLIANT';
  return {
    id: r.id,
    title: r.title,
    citation: r.citation,
    category: r.category,
    currentStatus: r.currentStatus,
    ownerName: r.owner?.fullName ?? null,
    nextReviewDate: r.nextReviewDate,
    lastAuditDate: last?.auditDate ?? null,
    gapSeverity: isGap ? (last?.gapSeverity ?? null) : null,
    evidenceUrls: last?.evidenceUrls ?? [],
  };
}

export type CategoryRow = { category: string } & Record<ComplianceStatus, number>;

const zeroCounts = () =>
  Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<ComplianceStatus, number>;

export async function getComplianceStats(siteId: string) {
  const where = { siteId, isActive: true };
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86_400_000);

  const [byStatus, byCat, overdue, dueSoon] = await Promise.all([
    prisma.legalRequirement.groupBy({ by: ['currentStatus'], where, _count: { _all: true } }),
    prisma.legalRequirement.groupBy({ by: ['category', 'currentStatus'], where, _count: { _all: true } }),
    prisma.legalRequirement.count({ where: { ...where, nextReviewDate: { lt: now } } }),
    prisma.legalRequirement.count({ where: { ...where, nextReviewDate: { gte: now, lte: in30 } } }),
  ]);

  const counts = zeroCounts();
  byStatus.forEach((g) => (counts[g.currentStatus] = g._count._all));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Weighted rate: compliant = 1, partial = 0.5. N/A and pending are excluded.
  const assessed = counts.COMPLIANT + counts.PARTIALLY_COMPLIANT + counts.NON_COMPLIANT;
  const rate = assessed ? Math.round(((counts.COMPLIANT + 0.5 * counts.PARTIALLY_COMPLIANT) / assessed) * 100) : null;

  const rows: Record<string, CategoryRow> = {};
  byCat.forEach((g) => {
    rows[g.category] ??= { category: CATEGORY_LABEL[g.category], ...zeroCounts() };
    rows[g.category][g.currentStatus] = g._count._all;
  });

  return { total, counts, rate, overdue, dueSoon, byCategory: Object.values(rows) };
}

export function getRequirement(id: string, siteId: string) {
  return prisma.legalRequirement.findFirst({
    where: { id, siteId },
    include: {
      owner: { select: { id: true, fullName: true } },
      audits: {
        orderBy: { auditDate: 'desc' },
        include: {
          auditor: { select: { fullName: true } },
          capaActions: { select: { id: true, referenceNo: true, status: true, dueDate: true } },
        },
      },
    },
  });
}

export function getSiteUsers(siteId: string) {
  return prisma.user.findMany({
    where: { isActive: true, OR: [{ role: 'ADMIN' }, { sites: { some: { siteId } } }] },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  });
}
