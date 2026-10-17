'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { failure, fieldError, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { MAX_PERMIT_HOURS, PERMIT_STATUS_LABEL, transitionError, type PermitStatus } from '@/lib/permits/meta';
import { nextReference } from '@/lib/reference';
import { permitStatusSchema, requestPermitSchema } from '@/lib/validations/permits';
import { zonedLocalToUtc } from '@/lib/utils';

/** Raises a permit. The code is generated here and the status starts at REQUESTED. */
export async function requestPermit(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = requestPermitSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    const { user, siteId } = await authorize('permit:request', d.siteId);

    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { timezone: true } });
    if (!site) throw new WorkflowError('Site not found.');
    const validFrom = zonedLocalToUtc(d.validFrom, site.timezone);
    const validTo = zonedLocalToUtc(d.validTo, site.timezone);
    if (!validFrom) return fieldError('validFrom', 'Enter a valid date and time');
    if (!validTo) return fieldError('validTo', 'Enter a valid date and time');
    if (validTo.getTime() <= validFrom.getTime()) return fieldError('validTo', 'The end must be after the start');
    if (validTo.getTime() <= Date.now()) return fieldError('validTo', 'The end must be in the future');
    if (validTo.getTime() - validFrom.getTime() > MAX_PERMIT_HOURS * 3_600_000) {
      return fieldError('validTo', `A permit can last at most ${MAX_PERMIT_HOURS / 24} days`);
    }

    const permit = await prisma.$transaction(async (tx) => {
      const created = await tx.workPermit.create({
        data: {
          permitCode: await nextReference(tx, 'PTW'),
          siteId, requestedById: user.id, status: 'REQUESTED',
          type: d.type, title: d.title, location: d.location, description: d.description,
          hazards: d.hazards, precautions: d.precautions, workers: d.workers ?? null,
          validFrom, validTo,
        },
        select: { id: true, permitCode: true },
      });
      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'PERMIT', entityId: created.id,
        action: 'permit.requested', metadata: { permitCode: created.permitCode, type: d.type },
      });
      return created;
    });

    revalidatePath('/permits');
    return { ok: true, message: `Permit ${permit.permitCode} requested.` };
  } catch (e) {
    return failure(e);
  }
}

/** Approve, reject, start, close out or cancel. The rules live in `transitionError`. */
export async function updatePermitStatus(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = permitStatusSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { permitId, toStatus, note } = parsed.data;

    const permit = await prisma.workPermit.findUnique({ where: { id: permitId } });
    if (!permit) throw new WorkflowError('This permit no longer exists.');

    // Who may make this move depends on the move.
    const needed =
      toStatus === 'APPROVED' || toStatus === 'REJECTED' ? 'permit:approve'
      : toStatus === 'CANCELLED' && permit.status === 'REQUESTED' ? 'permit:request'
      : 'permit:operate';
    const { user } = await authorize(needed, permit.siteId);

    const from = permit.status as PermitStatus;
    const problem = transitionError(
      { status: from, validFrom: permit.validFrom, validTo: permit.validTo, requestedById: permit.requestedById },
      toStatus,
      { userId: user.id, isAdmin: user.role === 'ADMIN' },
    );
    if (problem) throw new WorkflowError(problem);
    if ((toStatus === 'REJECTED' || toStatus === 'CANCELLED') && !note) {
      return fieldError('note', 'Give a reason');
    }
    if (toStatus === 'CLOSED' && !note) return fieldError('note', 'Describe the close-out: area left safe, isolations removed, etc.');

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const moved = await tx.workPermit.updateMany({
        where: { id: permit.id, status: from }, // guards against a concurrent change
        data: {
          status: toStatus,
          ...(toStatus === 'APPROVED' && { approvedById: user.id, approvedAt: now }),
          ...(toStatus === 'IN_PROGRESS' && { startedAt: now }),
          ...(toStatus === 'CLOSED' && { closedAt: now, closeoutNotes: note }),
          ...((toStatus === 'REJECTED' || toStatus === 'CANCELLED') && { statusNote: note }),
        },
      });
      if (moved.count === 0) throw new WorkflowError('This permit was changed by someone else. Refresh and try again.');
      await logActivity(tx, {
        siteId: permit.siteId, actorId: user.id, entityType: 'PERMIT', entityId: permit.id,
        action: 'permit.status_changed', metadata: { permitCode: permit.permitCode, from, to: toStatus, note: note ?? null },
      });
    });

    revalidatePath('/permits');
    return { ok: true, message: `${permit.permitCode} is now ${PERMIT_STATUS_LABEL[toStatus].toLowerCase()}.` };
  } catch (e) {
    return failure(e);
  }
}
