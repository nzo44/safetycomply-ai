'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { failure, fieldError, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { nextReference } from '@/lib/reference';
import { resolveSiteTime } from '@/lib/site-time';
import { MANIFEST_STATUS_LABEL, MANIFEST_TRANSITIONS } from '@/lib/waste/meta';
import { createWasteManifestSchema, updateManifestStatusSchema } from '@/lib/validations/waste';

/** Logs an outgoing shipment. The tracking code is generated here, and status starts at DISPATCHED. */
export async function logWasteManifest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = createWasteManifestSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    // The siteId from the form is only a claim: authorize() checks it against the user's site access.
    const { user, siteId } = await authorize('waste:log', d.siteId);

    let dispatchedAt = new Date();
    if (d.dispatchedAt) {
      const when = await resolveSiteTime(d.dispatchedAt, siteId);
      if ('error' in when) return fieldError('dispatchedAt', when.error);
      dispatchedAt = when.date;
    }

    const manifest = await prisma.$transaction(async (tx) => {
      const created = await tx.wasteManifest.create({
        data: {
          manifestCode: await nextReference(tx, 'WM'),
          siteId,
          recordedById: user.id,
          wasteType: d.wasteType,
          wasteCode: d.wasteCode ?? null,
          description: d.description,
          disposalMethod: d.disposalMethod,
          estimatedWeightKg: d.estimatedWeightKg != null ? d.estimatedWeightKg.toFixed(3) : null,
          transporterName: d.transporterName,
          transporterLicenseNo: d.transporterLicenseNo ?? null,
          vehicleRegistration: d.vehicleRegistration ?? null,
          driverName: d.driverName ?? null,
          destinationFacility: d.destinationFacility,
          notes: d.notes ?? null,
          status: 'DISPATCHED',
          dispatchedAt,
        },
        select: { id: true, manifestCode: true },
      });
      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'WASTE_MANIFEST', entityId: created.id,
        action: 'waste.manifest_logged',
        metadata: { manifestCode: created.manifestCode, wasteType: d.wasteType, disposalMethod: d.disposalMethod },
      });
      return created;
    });

    revalidatePath('/waste');
    return { ok: true, message: `Manifest ${manifest.manifestCode} logged.` };
  } catch (e) {
    return failure(e);
  }
}

/** DISPATCHED -> IN_TRANSIT, or reject / cancel an open manifest. Discharging goes through processDischarge. */
export async function updateManifestStatus(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = updateManifestStatusSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { manifestId, toStatus, note } = parsed.data;

    const manifest = await prisma.wasteManifest.findUnique({
      where: { id: manifestId },
      select: { id: true, siteId: true, manifestCode: true, status: true },
    });
    if (!manifest) throw new WorkflowError('This manifest no longer exists.');
    const { user } = await authorize('waste:log', manifest.siteId);

    if (!MANIFEST_TRANSITIONS[manifest.status].includes(toStatus)) {
      throw new WorkflowError(
        `A ${MANIFEST_STATUS_LABEL[manifest.status].toLowerCase()} manifest cannot move to ${MANIFEST_STATUS_LABEL[toStatus].toLowerCase()}.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      const moved = await tx.wasteManifest.updateMany({
        where: { id: manifest.id, status: manifest.status }, // guards against a concurrent change
        data: { status: toStatus, statusNote: note ?? null },
      });
      if (moved.count === 0) throw new WorkflowError('This manifest was changed by someone else. Refresh and try again.');
      await logActivity(tx, {
        siteId: manifest.siteId, actorId: user.id, entityType: 'WASTE_MANIFEST', entityId: manifest.id,
        action: 'waste.manifest_status_changed', metadata: { from: manifest.status, to: toStatus, note: note ?? null },
      });
    });

    revalidatePath('/waste');
    return { ok: true, message: `${manifest.manifestCode} is now ${MANIFEST_STATUS_LABEL[toStatus].toLowerCase()}.` };
  } catch (e) {
    return failure(e);
  }
}
