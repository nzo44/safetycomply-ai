'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { failure, fieldError, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { assertEvidenceForSite } from '@/lib/evidence-guard';
import { requireSiteUser } from '@/lib/incidents/access';
import { resolveSiteTime } from '@/lib/site-time';
import {
  CRITICAL_DAYS_TO_FULL, daysUntil, utilizationLevel, utilizationPct, type UtilizationLevel,
} from '@/lib/waste/capacity';
import { PROCESSABLE_STATUSES } from '@/lib/waste/meta';
import { computeProjectedFillDate } from '@/lib/waste/projection';
import { processDischargeSchema } from '@/lib/validations/waste';

/**
 * Weighs a load in. In one transaction:
 *  1. moves the manifest to DISCHARGED (guarded, so double submits and races fail cleanly)
 *  2. writes the ticket with netWeightKg = gross - tare (Decimal, never client-supplied)
 *  3. for landfill-bound loads, atomically increments LandfillCapacity and refreshes the projection
 */
export async function processDischarge(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = processDischargeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    const manifest = await prisma.wasteManifest.findUnique({
      where: { id: d.manifestId },
      select: { id: true, siteId: true, manifestCode: true, status: true, wasteType: true, disposalMethod: true, dispatchedAt: true },
    });
    if (!manifest) throw new WorkflowError('This manifest no longer exists.');
    const { user, siteId } = await authorize('waste:weigh', manifest.siteId);

    assertEvidenceForSite(d.evidenceUrls, siteId);
    if (manifest.status === 'DISCHARGED') throw new WorkflowError('This manifest has already been discharged.');
    if (!PROCESSABLE_STATUSES.includes(manifest.status)) {
      throw new WorkflowError(`A ${manifest.status.toLowerCase()} manifest cannot be weighed in.`);
    }

    const when = await resolveSiteTime(d.dischargeDate, siteId);
    if ('error' in when) return fieldError('dischargeDate', when.error);
    if (when.date.getTime() < manifest.dispatchedAt.getTime()) {
      return fieldError('dischargeDate', 'The discharge cannot be before the manifest was dispatched');
    }

    // Friendly duplicate check; the unique index is the backstop for races.
    const dup = await prisma.weighbridgeTicket.findUnique({
      where: { siteId_weighbridgeTicketNo: { siteId, weighbridgeTicketNo: d.weighbridgeTicketNo } },
      select: { id: true },
    });
    if (dup) return fieldError('weighbridgeTicketNo', 'This ticket number has already been used at this site');

    const gross = new Prisma.Decimal(d.grossWeightKg.toFixed(3));
    const tare = new Prisma.Decimal(d.tareWeightKg.toFixed(3));
    const net = gross.minus(tare);
    const toLandfill = manifest.disposalMethod === 'LANDFILL';

    const outcome = await prisma.$transaction(async (tx) => {
      const operatorId =
        d.operatorId && d.operatorId !== user.id
          ? (await requireSiteUser(tx, d.operatorId, siteId, undefined, 'The operator')).id
          : user.id;

      if (toLandfill) {
        const cap = await tx.landfillCapacity.findUnique({ where: { siteId }, select: { id: true } });
        if (!cap) {
          throw new WorkflowError(
            'Landfill capacity is not set up for this site. An HSE manager must configure it before landfill loads can be weighed in.',
          );
        }
      }

      const moved = await tx.wasteManifest.updateMany({
        where: { id: manifest.id, status: { in: PROCESSABLE_STATUSES } },
        data: { status: 'DISCHARGED', receivedAt: when.date },
      });
      if (moved.count === 0) throw new WorkflowError('This manifest was changed by someone else. Refresh and try again.');

      const ticket = await tx.weighbridgeTicket.create({
        data: {
          manifestId: manifest.id,
          siteId,
          operatorId,
          weighbridgeTicketNo: d.weighbridgeTicketNo,
          wasteType: manifest.wasteType,
          grossWeightKg: gross,
          tareWeightKg: tare,
          netWeightKg: net,
          countedToLandfill: toLandfill,
          dischargeDate: when.date,
          notes: d.notes ?? null,
          evidenceUrls: d.evidenceUrls,
        },
        select: { id: true },
      });

      let landfill: { pct: number; level: UtilizationLevel; daysToFull: number | null } | null = null;
      if (toLandfill) {
        // Atomic SQL increment: concurrent weighings can't overwrite each other.
        const updated = await tx.landfillCapacity.update({
          where: { siteId },
          data: { currentVolumeTons: { increment: net.div(1000) } },
        });
        const projected = await computeProjectedFillDate(tx, siteId, updated.totalCapacityTons, updated.currentVolumeTons);
        await tx.landfillCapacity.update({ where: { siteId }, data: { projectedFillDate: projected } });
        const pct = utilizationPct(updated.currentVolumeTons.toNumber(), updated.totalCapacityTons.toNumber());
        const daysToFull = projected ? daysUntil(projected) : null;
        landfill = { pct, level: utilizationLevel(pct, daysToFull), daysToFull };
      }

      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'WASTE_MANIFEST', entityId: manifest.id,
        action: 'waste.discharged',
        metadata: {
          ticketId: ticket.id, ticketNo: d.weighbridgeTicketNo, netKg: net.toString(),
          countedToLandfill: toLandfill, operatorId,
        },
      });
      return { landfill };
    });

    let message = `${manifest.manifestCode} discharged: ${net.toFixed(3)} kg net.`;
    if (outcome.landfill && outcome.landfill.level !== 'OK') {
      const { pct, daysToFull } = outcome.landfill;
      message += pct > 100
        ? ' The landfill is now over capacity.'
        : ` The landfill is now ${pct.toFixed(1)}% full${daysToFull !== null && daysToFull <= CRITICAL_DAYS_TO_FULL ? `, projected to fill in ${daysToFull} days` : ''}.`;
    }
    revalidatePath('/waste');
    return { ok: true, message };
  } catch (e) {
    return failure(e);
  }
}
