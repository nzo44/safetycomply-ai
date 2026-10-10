'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { can, ForbiddenError } from '@/lib/auth/rbac';
import { failure, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { rcaDraftSchema, rcaSubmitSchema, reviewRcaSchema } from '@/lib/validations/incident';

async function persistRca(formData: FormData, mode: 'draft' | 'submit'): Promise<ActionResult> {
  const parsed = (mode === 'submit' ? rcaSubmitSchema : rcaDraftSchema).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const rca = await prisma.rcaAnalysis.findUnique({
    where: { incidentId: d.incidentId },
    include: { incident: { select: { id: true, siteId: true } } },
  });
  if (!rca) throw new WorkflowError('Start the investigation before saving an analysis.');
  const { user } = await authorize('rca:write', rca.incident.siteId);

  if (rca.leadId !== user.id && !can(user.role, 'incident:manage')) {
    throw new ForbiddenError('Only the RCA lead or an HSE manager can edit this analysis.');
  }
  if (rca.status !== 'DRAFT') {
    throw new WorkflowError('This analysis is already submitted. A reviewer must return it before it can be edited.');
  }

  // Levels come from array order; fully blank draft rows are dropped.
  const chain = d.whyChain
    .filter((s) => s.why || s.answer)
    .map((s, i) => ({ level: i + 1, why: s.why, answer: s.answer }));

  await prisma.$transaction(async (tx) => {
    await tx.rcaAnalysis.update({
      where: { id: rca.id },
      data: {
        method: d.method,
        problemStatement: d.problemStatement,
        whyChain: chain as Prisma.InputJsonValue,
        diagramData: d.diagramData == null ? Prisma.DbNull : (d.diagramData as Prisma.InputJsonValue),
        rootCause: d.rootCause ?? null,
        rootCauseCategory: d.rootCauseCategory ?? null,
        contributingFactors: d.contributingFactors,
        ...(mode === 'submit' && { status: 'SUBMITTED', completedAt: new Date() }),
      },
    });

    if (mode === 'submit') {
      const moved = await tx.incident.updateMany({
        where: { id: rca.incident.id, status: 'UNDER_INVESTIGATION' },
        data: { status: 'RCA_COMPLETE' },
      });
      if (moved.count === 0) throw new WorkflowError('The incident is not under investigation, so the analysis cannot be submitted.');
    }

    await logActivity(tx, {
      siteId: rca.incident.siteId, actorId: user.id, entityType: 'RCA', entityId: rca.id,
      action: mode === 'submit' ? 'rca.submitted' : 'rca.draft_saved',
      metadata: { method: d.method, whys: chain.length },
    });
  });

  revalidatePath(`/incidents/${rca.incident.id}`);
  return { ok: true, message: mode === 'submit' ? 'Analysis submitted for review.' : 'Draft saved.' };
}

export async function saveRcaDraft(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try { return await persistRca(formData, 'draft'); } catch (e) { return failure(e); }
}

export async function submitRca(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try { return await persistRca(formData, 'submit'); } catch (e) { return failure(e); }
}

/** Approve or return a submitted RCA. The reviewer cannot be the RCA lead. */
export async function reviewRca(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = reviewRcaSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { rcaId, decision, comments } = parsed.data;

    const rca = await prisma.rcaAnalysis.findUnique({
      where: { id: rcaId },
      include: { incident: { select: { id: true, siteId: true } } },
    });
    if (!rca) throw new WorkflowError('This analysis no longer exists.');
    const { user } = await authorize('rca:approve', rca.incident.siteId);

    if (rca.leadId === user.id) throw new ForbiddenError('You led this analysis, so someone else must review it.');
    if (rca.status !== 'SUBMITTED') throw new WorkflowError('Only a submitted analysis can be reviewed.');

    await prisma.$transaction(async (tx) => {
      const moved = await tx.rcaAnalysis.updateMany({
        where: { id: rca.id, status: 'SUBMITTED' },
        data:
          decision === 'approve'
            ? { status: 'APPROVED', approvedById: user.id, approvedAt: new Date() }
            : { status: 'DRAFT', completedAt: null },
      });
      if (moved.count === 0) throw new WorkflowError('This analysis was changed by someone else. Refresh and try again.');

      if (decision === 'return') {
        await tx.incident.updateMany({
          where: { id: rca.incident.id, status: 'RCA_COMPLETE' },
          data: { status: 'UNDER_INVESTIGATION' },
        });
      }
      await logActivity(tx, {
        siteId: rca.incident.siteId, actorId: user.id, entityType: 'RCA', entityId: rca.id,
        action: decision === 'approve' ? 'rca.approved' : 'rca.returned',
        metadata: { comments: comments ?? null },
      });
    });

    revalidatePath(`/incidents/${rca.incident.id}`);
    return { ok: true, message: decision === 'approve' ? 'Analysis approved.' : 'Analysis returned to the lead.' };
  } catch (e) {
    return failure(e);
  }
}
