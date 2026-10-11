import { Prisma, type ManifestStatus, type WasteType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { zonedLocalToUtc } from '@/lib/utils';
import { daysUntil, projectFillDate, PROJECTION_WINDOW_DAYS, utilizationLevel, utilizationPct } from '@/lib/waste/capacity';
import { HAZARDOUS_TYPES, MANIFEST_STATUS_LABEL, PENDING_TRANSIT_STATUSES, WASTE_TYPE_LABEL } from '@/lib/waste/meta';
import { getLandfillIntake } from '@/lib/waste/projection';
import type { WasteAnalytics, WasteManifestRow } from '@/types/waste';
import { one, pick, type SearchParams } from './params';

export const PAGE_SIZES = [10, 20, 50];

export interface ManifestParams {
  q?: string;
  wasteType?: WasteType;
  status?: ManifestStatus;
  page: number;
  pageSize: number;
}

export function parseManifestParams(sp: SearchParams): ManifestParams {
  const page = Math.min(10_000, Math.max(1, parseInt(one(sp, 'page') ?? '1', 10) || 1));
  const size = parseInt(one(sp, 'pageSize') ?? '', 10);
  return {
    q: one(sp, 'q')?.trim() || undefined,
    wasteType: pick<WasteType>(one(sp, 'wasteType'), WASTE_TYPE_LABEL),
    status: pick<ManifestStatus>(one(sp, 'status'), MANIFEST_STATUS_LABEL),
    page,
    pageSize: PAGE_SIZES.includes(size) ? size : 20,
  };
}

/** URL-driven list: search on code and transporter, filter by type and status, offset pagination. */
export async function getWasteManifests(siteId: string, p: ManifestParams) {
  const where: Prisma.WasteManifestWhereInput = {
    siteId,
    ...(p.wasteType && { wasteType: p.wasteType }),
    ...(p.status && { status: p.status }),
    ...(p.q && {
      OR: [
        { manifestCode: { contains: p.q, mode: 'insensitive' } },
        { transporterName: { contains: p.q, mode: 'insensitive' } },
      ],
    }),
  };

  const total = await prisma.wasteManifest.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / p.pageSize));
  const page = Math.min(p.page, pageCount);

  const rows = await prisma.wasteManifest.findMany({
    where,
    orderBy: [{ dispatchedAt: 'desc' }, { id: 'desc' }], // id breaks ties so pages never overlap
    skip: (page - 1) * p.pageSize,
    take: p.pageSize,
    include: { ticket: { select: { netWeightKg: true, weighbridgeTicketNo: true, evidenceUrls: true } } },
  });

  const mapped: WasteManifestRow[] = rows.map((m) => ({
    id: m.id, manifestCode: m.manifestCode, wasteType: m.wasteType, description: m.description,
    transporterName: m.transporterName, destinationFacility: m.destinationFacility,
    disposalMethod: m.disposalMethod, status: m.status, dispatchedAt: m.dispatchedAt, receivedAt: m.receivedAt,
    estimatedWeightKg: m.estimatedWeightKg?.toNumber() ?? null,
    netWeightKg: m.ticket?.netWeightKg.toNumber() ?? null,
    ticketNo: m.ticket?.weighbridgeTicketNo ?? null,
    statusNote: m.statusNote,
    evidenceUrls: m.ticket?.evidenceUrls ?? [],
  }));

  return { rows: mapped, total, page, pageCount, pageSize: p.pageSize };
}

/** First instant of the current month in the site's timezone, as UTC. */
function monthStart(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const y = parts.find((x) => x.type === 'year')!.value;
  const m = parts.find((x) => x.type === 'month')!.value;
  return zonedLocalToUtc(`${y}-${m}-01T00:00`, timeZone) ?? new Date(Date.UTC(Number(y), Number(m) - 1, 1));
}

/** Monthly volume by type, hazardous ratio, pending loads, and landfill capacity with a fill-date projection. */
export async function getWasteAnalytics(siteId: string, now = new Date()): Promise<WasteAnalytics> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { timezone: true } });
  const periodStart = monthStart(now, site.timezone);

  const [grouped, pendingTransit, capacity, intake] = await Promise.all([
    prisma.weighbridgeTicket.groupBy({
      by: ['wasteType'],
      where: { siteId, dischargeDate: { gte: periodStart } },
      _sum: { netWeightKg: true },
      _count: { _all: true },
    }),
    prisma.wasteManifest.count({ where: { siteId, status: { in: PENDING_TRANSIT_STATUSES } } }),
    prisma.landfillCapacity.findUnique({ where: { siteId } }),
    getLandfillIntake(prisma, siteId, now),
  ]);

  const zero = new Prisma.Decimal(0);
  const monthlyKg = grouped.reduce((s, g) => s.plus(g._sum.netWeightKg ?? zero), zero);
  const hazardousKg = grouped
    .filter((g) => HAZARDOUS_TYPES.includes(g.wasteType))
    .reduce((s, g) => s.plus(g._sum.netWeightKg ?? zero), zero);

  const byType = grouped
    .map((g) => {
      const kg = g._sum.netWeightKg ?? zero;
      return {
        wasteType: g.wasteType,
        tons: kg.div(1000).toNumber(),
        loads: g._count._all,
        sharePct: monthlyKg.isZero() ? 0 : kg.div(monthlyKg).times(100).toNumber(),
      };
    })
    .sort((a, b) => b.tons - a.tons);

  let landfill: WasteAnalytics['landfill'] = null;
  if (capacity) {
    const totalTons = capacity.totalCapacityTons.toNumber();
    const currentTons = capacity.currentVolumeTons.toNumber();
    const pct = utilizationPct(currentTons, totalTons);
    const projectedFillDate = projectFillDate({ totalTons, currentTons, ...intake, now }); // recomputed on read
    const daysToFull = projectedFillDate ? daysUntil(projectedFillDate, now) : null;
    landfill = {
      totalTons, currentTons,
      remainingTons: Math.max(0, totalTons - currentTons),
      utilizationPct: pct,
      remainingPct: Math.max(0, 100 - pct),
      level: utilizationLevel(pct, daysToFull),
      projectedFillDate,
      daysToFull,
      avgDailyIntakeTons:
        intake.firstIntakeAt && intake.intakeTons > 0
          ? intake.intakeTons / Math.max(1, Math.min(PROJECTION_WINDOW_DAYS, (now.getTime() - intake.firstIntakeAt.getTime()) / 86_400_000))
          : null,
    };
  }

  return {
    periodStart,
    monthlyTons: monthlyKg.div(1000).toNumber(),
    byType,
    hazardousRatioPct: monthlyKg.isZero() ? null : hazardousKg.div(monthlyKg).times(100).toNumber(),
    pendingTransit,
    landfill,
  };
}

/**
 * Site-scoped lookup for the weigh-in drawer. Deliberately returns the manifest in ANY status:
 * after a successful weighing the page revalidates, and the drawer must stay mounted to show the result.
 */
export async function getDischargeTarget(id: string, siteId: string) {
  const m = await prisma.wasteManifest.findFirst({
    where: { id, siteId },
    select: {
      id: true, manifestCode: true, description: true, wasteType: true, disposalMethod: true,
      transporterName: true, status: true, estimatedWeightKg: true,
    },
  });
  return m ? { ...m, estimatedWeightKg: m.estimatedWeightKg?.toNumber() ?? null } : null;
}
export type DischargeTarget = NonNullable<Awaited<ReturnType<typeof getDischargeTarget>>>;
