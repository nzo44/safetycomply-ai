import { Prisma, type Role, type WasteType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/auth/rbac';
import { zonedLocalToUtc } from '@/lib/utils';
import { HAZARDOUS_TYPES } from '@/lib/waste/meta';
import { getAuditStats } from './audits';
import { getCapaStats } from './capa';
import { getComplianceStats } from './compliance';
import { getIncidentStats } from './incidents';
import { getRiskStats } from './risk';

/**
 * Items waiting on this person: CAPAs assigned to them that are open or in progress,
 * plus, for verifiers, actions submitted by someone else and waiting for verification.
 */
export async function getNavCounts(siteId: string, user: { id: string; role: Role }) {
  const [assigned, toVerify] = await Promise.all([
    prisma.capaAction.count({ where: { siteId, assigneeId: user.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    can(user.role, 'capa:verify')
      ? prisma.capaAction.count({ where: { siteId, status: 'PENDING_VERIFICATION', assigneeId: { not: user.id } } })
      : Promise.resolve(0),
  ]);
  return { incidentsPending: assigned + toVerify };
}

/** Calendar quarter containing `now` in the site's timezone, plus the previous quarter's start. */
function quarterBounds(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  const q = Math.floor((month - 1) / 3); // 0..3
  const startOf = (y: number, qi: number) =>
    zonedLocalToUtc(`${y}-${String(qi * 3 + 1).padStart(2, '0')}-01T00:00`, timeZone) ?? new Date(Date.UTC(y, qi * 3, 1));
  const prev = q === 0 ? { y: year - 1, qi: 3 } : { y: year, qi: q - 1 };
  return { start: startOf(year, q), prevStart: startOf(prev.y, prev.qi), label: `Q${q + 1} ${year}` };
}

type TonnageRow = { wasteType: WasteType; _sum: { netWeightKg: Prisma.Decimal | null } };

export async function getQuarterWaste(siteId: string, timeZone: string, now = new Date()) {
  const { start, prevStart, label } = quarterBounds(now, timeZone);
  const [current, previous] = await Promise.all([
    prisma.weighbridgeTicket.groupBy({
      by: ['wasteType'],
      where: { siteId, dischargeDate: { gte: start } },
      _sum: { netWeightKg: true },
    }),
    prisma.weighbridgeTicket.aggregate({
      where: { siteId, dischargeDate: { gte: prevStart, lt: start } },
      _sum: { netWeightKg: true },
    }),
  ]);

  const zero = new Prisma.Decimal(0);
  const tons = (rows: TonnageRow[], pred: (t: WasteType) => boolean) =>
    rows.filter((r) => pred(r.wasteType)).reduce((s, r) => s.plus(r._sum.netWeightKg ?? zero), zero).div(1000).toNumber();

  const hazardousTons = tons(current, (t) => HAZARDOUS_TYPES.includes(t));
  const nonHazardousTons = tons(current, (t) => !HAZARDOUS_TYPES.includes(t));
  const totalTons = hazardousTons + nonHazardousTons;
  const previousTons = (previous._sum.netWeightKg ?? zero).div(1000).toNumber();

  return {
    label,
    hazardousTons,
    nonHazardousTons,
    totalTons,
    previousTons,
    changePct: previousTons > 0 ? ((totalTons - previousTons) / previousTons) * 100 : null,
  };
}

/** Everything the executive dashboard shows, fetched in parallel. */
export async function getExecutiveSummary(siteId: string, timeZone: string) {
  const [compliance, capa, incidents, highSeverityOpen, waste, audits, risks] = await Promise.all([
    getComplianceStats(siteId),
    getCapaStats(siteId),
    getIncidentStats(siteId),
    prisma.incident.count({
      where: { siteId, status: { not: 'CLOSED' }, severity: { in: ['MAJOR', 'CRITICAL', 'CATASTROPHIC'] } },
    }),
    getQuarterWaste(siteId, timeZone),
    getAuditStats(siteId),
    getRiskStats(siteId),
  ]);
  return { compliance, capa, incidents, highSeverityOpen, waste, audits, risks };
}
