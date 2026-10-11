'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { ForbiddenError } from '@/lib/auth/rbac';
import { failure, fieldError, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { changedKeys, logActivity } from '@/lib/activity';
import { nextReference } from '@/lib/reference';
import { hazardsInOrder, loadEditableAssessment } from '@/lib/risk/access';
import { maxLevel } from '@/lib/risk/matrix';
import { addMonthsUtc, approvalCheck, reviewMonthsFor } from '@/lib/risk/workflow';
import {
  archiveAssessmentSchema, assessmentIdSchema, assessmentSchema, assessmentUpdateSchema, reviewAssessmentSchema,
} from '@/lib/validations/risk';

const STALE = 'This assessment was changed by someone else. Refresh and try again.';

function revalidateRisk(id: string) {
  revalidatePath('/risk');
  revalidatePath(`/risk/${id}`);
}

export async function createAssessment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const { user, siteId } = await authorize('risk:write');
    const parsed = assessmentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
      const a = await tx.riskAssessment.create({
        data: {
          referenceNo: await nextReference(tx, 'RA'),
          version: 1,
          siteId,
          assessorId: user.id,
          title: d.title,
          type: d.type,
          activity: d.activity,
          area: d.area ?? null,
          scope: d.scope ?? null,
          teamMembers: d.teamMembers,
          assessedAt: d.assessedAt ?? new Date(),
        },
        select: { id: true, referenceNo: true },
      });
      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: a.id,
        action: 'risk.created', metadata: { referenceNo: a.referenceNo, type: d.type },
      });
      return a;
    });
    id = created.id;
  } catch (e) {
    return failure(e);
  }
  revalidatePath('/risk');
  redirect(`/risk/${id}`);
}

export async function updateAssessmentDetails(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = assessmentUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    const { a, user } = await loadEditableAssessment(d.assessmentId);

    const before = await prisma.riskAssessment.findUniqueOrThrow({ where: { id: a.id } });
    const data = {
      title: d.title, activity: d.activity, area: d.area ?? null, scope: d.scope ?? null,
      teamMembers: d.teamMembers, ...(d.assessedAt && { assessedAt: d.assessedAt }),
    };
    const changed = changedKeys(before as unknown as Record<string, unknown>, data);

    if (changed.length > 0) {
      await prisma.$transaction(async (tx) => {
        const r = await tx.riskAssessment.updateMany({ where: { id: a.id, status: 'DRAFT' }, data });
        if (r.count === 0) throw new WorkflowError('This assessment is no longer a draft.');
        await logActivity(tx, {
          siteId: a.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: a.id,
          action: 'risk.updated', metadata: { changed },
        });
      });
    }
    revalidateRisk(a.id);
    return { ok: true, message: changed.length ? 'Details updated.' : 'No changes to save.' };
  } catch (e) {
    return failure(e);
  }
}

/** DRAFT -> IN_REVIEW. The completeness check runs inside the transaction, after the status flip, so it can't race with edits. */
export async function submitAssessment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = assessmentIdSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { a, user } = await loadEditableAssessment(parsed.data.assessmentId);

    await prisma.$transaction(async (tx) => {
      const moved = await tx.riskAssessment.updateMany({
        where: { id: a.id, status: 'DRAFT' },
        data: { status: 'IN_REVIEW', submittedAt: new Date() },
      });
      if (moved.count === 0) throw new WorkflowError(STALE);

      const { blockers } = approvalCheck(await hazardsInOrder(tx, a.id));
      if (blockers.length) throw new WorkflowError(`This assessment can't be submitted yet: ${blockers.join('; ')}.`);

      await logActivity(tx, {
        siteId: a.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: a.id, action: 'risk.submitted',
      });
    });

    revalidateRisk(a.id);
    return { ok: true, message: 'Submitted for review.' };
  } catch (e) {
    return failure(e);
  }
}

/** Approve or return. The reviewer cannot be the assessor. Approving archives the version it supersedes. */
export async function reviewAssessment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = reviewAssessmentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { assessmentId, decision, comments } = parsed.data;

    const a = await prisma.riskAssessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, siteId: true, referenceNo: true, version: true, status: true, assessorId: true },
    });
    if (!a) throw new WorkflowError('This assessment no longer exists.');
    const { user } = await authorize('risk:approve', a.siteId);

    if (a.assessorId === user.id) throw new ForbiddenError('You prepared this assessment, so another HSE manager must review it.');
    if (a.status !== 'IN_REVIEW') throw new WorkflowError('Only an assessment that is in review can be approved or returned.');

    if (decision === 'return') {
      await prisma.$transaction(async (tx) => {
        const r = await tx.riskAssessment.updateMany({
          where: { id: a.id, status: 'IN_REVIEW' }, data: { status: 'DRAFT', submittedAt: null },
        });
        if (r.count === 0) throw new WorkflowError(STALE);
        await logActivity(tx, {
          siteId: a.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: a.id,
          action: 'risk.returned', metadata: { comments },
        });
      });
      revalidateRisk(a.id);
      return { ok: true, message: 'Returned to the assessor.' };
    }

    // Approve: a remaining high residual risk needs the approver's written acceptance.
    const preview = approvalCheck(await hazardsInOrder(prisma, a.id));
    if (preview.blockers.length) throw new WorkflowError(`This assessment can't be approved: ${preview.blockers.join('; ')}.`);
    if (preview.highResidualCount > 0 && (!comments || comments.length < 10)) {
      return fieldError('comments', 'Record why the remaining high residual risk is acceptable (at least 10 characters)');
    }

    const nextReview = await prisma.$transaction(async (tx) => {
      const hazards = await hazardsInOrder(tx, a.id);
      const check = approvalCheck(hazards);
      if (check.blockers.length) throw new WorkflowError(`This assessment can't be approved: ${check.blockers.join('; ')}.`);

      // Supersede earlier approved versions first (the partial unique index allows only one approved).
      const superseded = await tx.riskAssessment.findMany({
        where: { referenceNo: a.referenceNo, status: 'APPROVED', id: { not: a.id } },
        select: { id: true, version: true },
      });
      for (const s of superseded) {
        await tx.riskAssessment.update({ where: { id: s.id }, data: { status: 'ARCHIVED' } });
        await logActivity(tx, {
          siteId: a.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: s.id,
          action: 'risk.archived', metadata: { reason: `Superseded by version ${a.version}` },
        });
      }

      const reviewDate = addMonthsUtc(new Date(), reviewMonthsFor(maxLevel(hazards.map((h) => h.residualLevel))));
      const r = await tx.riskAssessment.updateMany({
        where: { id: a.id, status: 'IN_REVIEW' },
        data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date(), approvalNotes: comments ?? null, nextReviewDate: reviewDate },
      });
      if (r.count === 0) throw new WorkflowError(STALE);

      await logActivity(tx, {
        siteId: a.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: a.id,
        action: 'risk.approved', metadata: { nextReviewDate: reviewDate.toISOString(), comments: comments ?? null },
      });
      return reviewDate;
    });

    revalidateRisk(a.id);
    return { ok: true, message: `Approved. Next review is due ${nextReview.toISOString().slice(0, 10)}.` };
  } catch (e) {
    return failure(e);
  }
}

/** Approved assessments are immutable: revising clones the register into a new draft version. */
export async function reviseAssessment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let newId: string;
  try {
    const parsed = assessmentIdSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);

    const src = await prisma.riskAssessment.findUnique({ where: { id: parsed.data.assessmentId } });
    if (!src) throw new WorkflowError('This assessment no longer exists.');
    const { user } = await authorize('risk:write', src.siteId);
    if (src.status !== 'APPROVED') throw new WorkflowError('Only an approved assessment can be revised.');

    const open = await prisma.riskAssessment.findFirst({
      where: { referenceNo: src.referenceNo, status: { in: ['DRAFT', 'IN_REVIEW'] } },
      select: { version: true },
    });
    if (open) throw new WorkflowError(`Version ${open.version} of this assessment is already being revised.`);

    newId = await prisma.$transaction(async (tx) => {
      const copy = await tx.riskAssessment.create({
        data: {
          referenceNo: src.referenceNo, version: src.version + 1, parentId: src.id, siteId: src.siteId,
          assessorId: user.id, title: src.title, type: src.type, activity: src.activity, area: src.area,
          scope: src.scope, teamMembers: src.teamMembers,
        },
        select: { id: true },
      });
      const hazards = await tx.hazardItem.findMany({ where: { riskAssessmentId: src.id } });
      if (hazards.length) {
        await tx.hazardItem.createMany({
          data: hazards.map(({ id: _id, riskAssessmentId: _ra, createdAt: _c, updatedAt: _u, ...rest }) => ({
            ...rest, riskAssessmentId: copy.id,
          })),
        });
      }
      await logActivity(tx, {
        siteId: src.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: copy.id,
        action: 'risk.revised', metadata: { version: src.version + 1, fromVersion: src.version },
      });
      return copy.id;
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath('/risk');
  redirect(`/risk/${newId}`);
}

export async function archiveAssessment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = archiveAssessmentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { assessmentId, reason } = parsed.data;

    const a = await prisma.riskAssessment.findUnique({ where: { id: assessmentId }, select: { id: true, siteId: true, status: true } });
    if (!a) throw new WorkflowError('This assessment no longer exists.');
    const { user } = await authorize('risk:approve', a.siteId);
    if (a.status !== 'DRAFT' && a.status !== 'APPROVED') {
      throw new WorkflowError('Only a draft or an approved assessment can be archived.');
    }

    await prisma.$transaction(async (tx) => {
      const r = await tx.riskAssessment.updateMany({ where: { id: a.id, status: a.status }, data: { status: 'ARCHIVED' } });
      if (r.count === 0) throw new WorkflowError(STALE);
      await logActivity(tx, {
        siteId: a.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: a.id,
        action: 'risk.archived', metadata: { reason },
      });
    });

    revalidateRisk(a.id);
    return { ok: true, message: 'Assessment archived.' };
  } catch (e) {
    return failure(e);
  }
}
