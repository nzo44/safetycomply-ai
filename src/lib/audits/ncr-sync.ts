import type { Prisma } from '@prisma/client';
import { logActivity } from '@/lib/activity';

type Event = 'CLOSED' | 'REOPENED' | 'CANCELLED';

/** Keeps NCR status consistent with its CAPA. Call inside the same transaction as the CAPA status change. */
export async function syncNcrsWithCapa(
  tx: Prisma.TransactionClient,
  capa: { id: string; siteId: string; referenceNo: string },
  event: Event,
  actorId: string,
) {
  const from = event === 'REOPENED' ? 'CLOSED' : 'CAPA_ISSUED';
  const affected = await tx.nonConformanceReport.findMany({
    where: { capaTaskId: capa.id, status: from },
    select: { id: true, referenceNo: true },
  });
  if (affected.length === 0) return;

  const data: Prisma.NonConformanceReportUncheckedUpdateManyInput =
    event === 'CLOSED' ? { status: 'CLOSED', closedAt: new Date(), closureNotes: `Closed with action ${capa.referenceNo}` }
    : event === 'REOPENED' ? { status: 'CAPA_ISSUED', closedAt: null, closureNotes: null }
    : { status: 'OPEN', capaTaskId: null }; // the cancelled action no longer counts, so the NCR needs a new one

  await tx.nonConformanceReport.updateMany({ where: { id: { in: affected.map((n) => n.id) } }, data });
  for (const n of affected) {
    await logActivity(tx, {
      siteId: capa.siteId, actorId, entityType: 'NCR', entityId: n.id,
      action: 'ncr.status_synced', metadata: { event, referenceNo: n.referenceNo, capaRef: capa.referenceNo },
    });
  }
}
