'use server';

import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { can, ForbiddenError } from '@/lib/auth/rbac';
import { failure, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { nextReference } from '@/lib/reference';
import { syncNcrsWithCapa } from '@/lib/audits/ncr-sync';
import { requireSiteUser } from '@/lib/incidents/access';
import {
  ACTIVE_CAPA_STATUSES, CAPA_STATUS_LABEL, CAPA_TRANSITIONS, daysOverdue, MAX_ESCALATION_LEVEL,
  OPEN_CAPA_STATUSES,
} from '@/lib/incidents/workflow';
import {
  capaCreateSchema, capaTransitionSchema, escalateCapaSchema, extendCapaSchema,
  reassignCapaSchema, verifyCapaSchema,
} from '@/lib/validations/incident';

const STALE = 'This action was changed by someone else. Refresh and try again.';

async function loadCapa(capaId: string) {
  const capa = await prisma.capaAction.findUnique({
    where: { id: capaId },
    select: {
      id: true, siteId: true, referenceNo: true, status: true, assigneeId: true, priority: true,
      dueDate: true, escalationLevel: true, incidentId: true,
      incident: { select: { status: true } },
    },
  });
  if (!capa) throw new WorkflowError('This action no longer exists.');
  return capa;
}

function revalidateCapa(incidentId: string | null) {
  revalidatePath('/incidents');
  revalidatePath('/incidents/capa');
  if (incidentId) revalidatePath(`/incidents/${incidentId}`);
}

/** Creates a CAPA linked to an incident, an RCA and/or a compliance audit. */
export async function createCapa(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = capaCreateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    const [incident, rca, audit] = await Promise.all([
      d.incidentId
        ? prisma.incident.findUnique({ where: { id: d.incidentId }, select: { id: true, siteId: true, status: true } })
        : null,
      d.rcaId
        ? prisma.rcaAnalysis.findUnique({
            where: { id: d.rcaId },
            select: { id: true, incidentId: true, incident: { select: { siteId: true, status: true } } },
          })
        : null,
      d.auditId
        ? prisma.complianceAudit.findUnique({ where: { id: d.auditId }, select: { id: true, siteId: true } })
        : null,
    ]);
    if ((d.incidentId && !incident) || (d.rcaId && !rca) || (d.auditId && !audit)) {
      throw new WorkflowError('A linked record no longer exists.');
    }
    if (incident && rca && rca.incidentId !== incident.id) {
      throw new WorkflowError('The RCA belongs to a different incident.');
    }

    const siteIds = new Set([incident?.siteId, rca?.incident.siteId, audit?.siteId].filter(Boolean) as string[]);
    if (siteIds.size !== 1) throw new WorkflowError('The linked records must belong to the same site.');
    const siteId = [...siteIds][0];

    const { user } = await authorize('capa:manage', siteId);
    const incidentId = incident?.id ?? rca?.incidentId ?? null;
    const incidentStatus = incident?.status ?? rca?.incident.status;
    if (incidentStatus === 'CLOSED') throw new WorkflowError('This incident is closed. Reopen it before adding actions.');

    const created = await prisma.$transaction(async (tx) => {
      const assignee = await requireSiteUser(tx, d.assigneeId, siteId, undefined, 'The assignee');
      const capa = await tx.capaAction.create({
        data: {
          referenceNo: await nextReference(tx, 'CAPA'),
          siteId,
          incidentId,
          rcaId: rca?.id ?? null,
          auditId: audit?.id ?? null,
          title: d.title,
          description: d.description,
          type: d.type,
          priority: d.priority,
          assigneeId: assignee.id,
          createdById: user.id,
          dueDate: d.dueDate,
          originalDueDate: d.dueDate,
        },
        select: { id: true, referenceNo: true },
      });

      if (incidentId) {
        await tx.incident.updateMany({
          where: { id: incidentId, status: 'RCA_COMPLETE' },
          data: { status: 'CAPA_IN_PROGRESS' },
        });
      }
      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'CAPA', entityId: capa.id,
        action: 'capa.created',
        metadata: { referenceNo: capa.referenceNo, priority: d.priority, assigneeId: assignee.id, dueDate: d.dueDate.toISOString() },
      });
      return capa;
    });

    revalidateCapa(incidentId);
    return { ok: true, message: `Action ${created.referenceNo} created.` };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Day-to-day status moves by the assignee (or a manager). Closing is not possible here:
 * it goes through verifyCapa so nobody closes their own work.
 */
export async function transitionCapa(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = capaTransitionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { capaId, toStatus, notes } = parsed.data;

    const capa = await loadCapa(capaId);
    const { user } = await authorize('capa:work', capa.siteId);
    const isManager = can(user.role, 'capa:manage');

    if (!isManager && capa.assigneeId !== user.id) {
      throw new ForbiddenError('Only the assignee or an HSE manager can update this action.');
    }
    if (!CAPA_TRANSITIONS[capa.status].includes(toStatus)) {
      throw new WorkflowError(`An action that is ${CAPA_STATUS_LABEL[capa.status]} cannot move to ${CAPA_STATUS_LABEL[toStatus]}.`);
    }
    if (toStatus === 'CANCELLED' && !isManager) throw new ForbiddenError('Only an HSE manager can cancel an action.');

    const reopening = capa.status === 'CLOSED';
    if (reopening) {
      if (!isManager) throw new ForbiddenError('Only an HSE manager can reopen a closed action.');
      if (!notes || notes.length < 5) {
        return { ok: false, error: 'Fix the highlighted fields.', fieldErrors: { notes: ['Explain why this action is being reopened'] } };
      }
      if (capa.incident?.status === 'CLOSED') {
        throw new WorkflowError('The incident is closed. Reopen the incident before reopening this action.');
      }
    }

    const data: Prisma.CapaActionUncheckedUpdateManyInput = { status: toStatus };
    if (toStatus === 'PENDING_VERIFICATION') {
      data.completedAt = new Date();
      data.completionNotes = notes;
    }
    if (toStatus === 'IN_PROGRESS' && (capa.status === 'PENDING_VERIFICATION' || reopening)) {
      data.completedAt = null;
      data.verifiedById = null;
      data.verifiedAt = null;
    }

    await prisma.$transaction(async (tx) => {
      const moved = await tx.capaAction.updateMany({ where: { id: capa.id, status: capa.status }, data });
      if (moved.count === 0) throw new WorkflowError(STALE);
      if (reopening) await syncNcrsWithCapa(tx, capa, 'REOPENED', user.id);
      if (toStatus === 'CANCELLED') await syncNcrsWithCapa(tx, capa, 'CANCELLED', user.id);
      await logActivity(tx, {
        siteId: capa.siteId, actorId: user.id, entityType: 'CAPA', entityId: capa.id,
        action: reopening ? 'capa.reopened' : 'capa.status_changed',
        metadata: { from: capa.status, to: toStatus, notes: notes ?? null },
      });
    });

    revalidateCapa(capa.incidentId);
    return { ok: true, message: `${capa.referenceNo} is now ${CAPA_STATUS_LABEL[toStatus]}.` };
  } catch (e) {
    return failure(e);
  }
}

/** Effectiveness check. The verifier cannot be the assignee. */
export async function verifyCapa(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = verifyCapaSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { capaId, outcome, effectivenessNotes } = parsed.data;

    const capa = await loadCapa(capaId);
    const { user } = await authorize('capa:verify', capa.siteId);

    if (capa.assigneeId === user.id) throw new ForbiddenError('You are assigned to this action, so someone else must verify it.');
    if (capa.status !== 'PENDING_VERIFICATION') throw new WorkflowError('Only an action pending verification can be verified.');

    const effective = outcome === 'effective';
    await prisma.$transaction(async (tx) => {
      const moved = await tx.capaAction.updateMany({
        where: { id: capa.id, status: 'PENDING_VERIFICATION' },
        data: effective
          ? { status: 'CLOSED', verifiedById: user.id, verifiedAt: new Date(), effectivenessNotes }
          : { status: 'IN_PROGRESS', completedAt: null, verifiedById: null, verifiedAt: null, effectivenessNotes },
      });
      if (moved.count === 0) throw new WorkflowError(STALE);
      if (effective) await syncNcrsWithCapa(tx, capa, 'CLOSED', user.id);
      await logActivity(tx, {
        siteId: capa.siteId, actorId: user.id, entityType: 'CAPA', entityId: capa.id,
        action: effective ? 'capa.verified_closed' : 'capa.verification_failed',
        metadata: { effectivenessNotes },
      });
    });

    let message = effective ? `${capa.referenceNo} closed.` : `${capa.referenceNo} sent back to the assignee.`;
    if (effective && capa.incidentId) {
      const remaining = await prisma.capaAction.count({
        where: { incidentId: capa.incidentId, status: { in: OPEN_CAPA_STATUSES } },
      });
      if (remaining === 0) message += ' All actions for this incident are complete, so it can now be closed.';
    }
    revalidateCapa(capa.incidentId);
    return { ok: true, message };
  } catch (e) {
    return failure(e);
  }
}

export async function reassignCapa(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = reassignCapaSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { capaId, assigneeId, reason } = parsed.data;

    const capa = await loadCapa(capaId);
    const { user } = await authorize('capa:manage', capa.siteId);
    if (!OPEN_CAPA_STATUSES.includes(capa.status)) throw new WorkflowError('Only open actions can be reassigned.');
    if (capa.assigneeId === assigneeId) {
      return { ok: false, error: 'Fix the highlighted fields.', fieldErrors: { assigneeId: ['This person is already the assignee'] } };
    }

    await prisma.$transaction(async (tx) => {
      const assignee = await requireSiteUser(tx, assigneeId, capa.siteId, undefined, 'The new assignee');
      const moved = await tx.capaAction.updateMany({
        where: { id: capa.id, status: capa.status, assigneeId: capa.assigneeId },
        data: { assigneeId: assignee.id },
      });
      if (moved.count === 0) throw new WorkflowError(STALE);
      await logActivity(tx, {
        siteId: capa.siteId, actorId: user.id, entityType: 'CAPA', entityId: capa.id,
        action: 'capa.reassigned', metadata: { from: capa.assigneeId, to: assignee.id, reason: reason ?? null },
      });
    });

    revalidateCapa(capa.incidentId);
    return { ok: true, message: `${capa.referenceNo} reassigned.` };
  } catch (e) {
    return failure(e);
  }
}

/** Moves the due date and resets the escalation ladder; history stays in CapaEscalation. */
export async function extendCapaDueDate(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = extendCapaSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { capaId, newDueDate, reason } = parsed.data;

    const capa = await loadCapa(capaId);
    const { user } = await authorize('capa:manage', capa.siteId);
    if (!ACTIVE_CAPA_STATUSES.includes(capa.status)) {
      throw new WorkflowError('The due date can only change while an action is open or in progress.');
    }
    if (newDueDate.getTime() === capa.dueDate.getTime()) {
      return { ok: false, error: 'Fix the highlighted fields.', fieldErrors: { newDueDate: ['Choose a different date'] } };
    }

    await prisma.$transaction(async (tx) => {
      const moved = await tx.capaAction.updateMany({
        where: { id: capa.id, status: capa.status },
        data: { dueDate: newDueDate, escalationLevel: 0, escalatedToId: null },
      });
      if (moved.count === 0) throw new WorkflowError(STALE);
      await logActivity(tx, {
        siteId: capa.siteId, actorId: user.id, entityType: 'CAPA', entityId: capa.id,
        action: 'capa.due_date_changed',
        metadata: {
          from: capa.dueDate.toISOString(), to: newDueDate.toISOString(),
          reason, escalationReset: capa.escalationLevel > 0,
        },
      });
    });

    revalidateCapa(capa.incidentId);
    return { ok: true, message: `Due date for ${capa.referenceNo} updated.` };
  } catch (e) {
    return failure(e);
  }
}

/** Manual escalation by a manager: one level up, to a chosen HSE manager or admin. */
export async function escalateCapa(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = escalateCapaSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { capaId, toUserId, reason } = parsed.data;

    const capa = await loadCapa(capaId);
    const { user } = await authorize('capa:manage', capa.siteId);
    if (!ACTIVE_CAPA_STATUSES.includes(capa.status)) throw new WorkflowError('Only open or in-progress actions can be escalated.');
    if (capa.escalationLevel >= MAX_ESCALATION_LEVEL) throw new WorkflowError('This action is already at the highest escalation level.');

    const level = capa.escalationLevel + 1;
    await prisma.$transaction(async (tx) => {
      const target = await requireSiteUser(tx, toUserId, capa.siteId, ['HSE_MANAGER', 'ADMIN'], 'The escalation target');
      const moved = await tx.capaAction.updateMany({
        where: { id: capa.id, status: capa.status, escalationLevel: capa.escalationLevel },
        data: { escalationLevel: level, escalatedToId: target.id, lastEscalatedAt: new Date() },
      });
      if (moved.count === 0) throw new WorkflowError(STALE);
      await tx.capaEscalation.create({
        data: {
          capaId: capa.id, level, toUserId: target.id, trigger: 'MANUAL', reason,
          daysOverdue: capa.dueDate.getTime() < Date.now() ? daysOverdue(capa.dueDate) : null,
        },
      });
      await logActivity(tx, {
        siteId: capa.siteId, actorId: user.id, entityType: 'CAPA', entityId: capa.id,
        action: 'capa.escalated', metadata: { level, toUserId: target.id, trigger: 'MANUAL', reason },
      });
    });

    revalidateCapa(capa.incidentId);
    return { ok: true, message: `${capa.referenceNo} escalated to level ${level}.` };
  } catch (e) {
    return failure(e);
  }
}
