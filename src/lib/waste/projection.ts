import { Prisma } from '@prisma/client';
import { DAY_MS } from '@/lib/utils';
import { PROJECTION_WINDOW_DAYS, projectFillDate } from './capacity';

export async function getLandfillIntake(db: Prisma.TransactionClient, siteId: string, now: Date) {
  const since = new Date(now.getTime() - PROJECTION_WINDOW_DAYS * DAY_MS);
  const agg = await db.weighbridgeTicket.aggregate({
    where: { siteId, countedToLandfill: true, dischargeDate: { gte: since } },
    _sum: { netWeightKg: true },
    _min: { dischargeDate: true },
  });
  return {
    intakeTons: (agg._sum.netWeightKg ?? new Prisma.Decimal(0)).div(1000).toNumber(),
    firstIntakeAt: agg._min.dischargeDate,
  };
}

export async function computeProjectedFillDate(
  db: Prisma.TransactionClient,
  siteId: string,
  totalTons: Prisma.Decimal,
  currentTons: Prisma.Decimal,
  now = new Date(),
) {
  const intake = await getLandfillIntake(db, siteId, now);
  return projectFillDate({ totalTons: totalTons.toNumber(), currentTons: currentTons.toNumber(), ...intake, now });
}
