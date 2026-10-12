'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { failure, fieldError, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { requireSiteUser } from '@/lib/incidents/access';
import { authorizeExecution, loadInspection } from '@/lib/audits/access';
import { WORKABLE_STATUSES } from '@/lib/audits/meta';
import { computeScore } from '@/lib/audits/score';
import { nextReference } from '@/lib/reference';
import {
  cancelInspectionSchema, inspectionIdSchema, responseSchema, scheduleInspectionSchema,
} from '@/lib/validations/audit';

const STALE = 'This inspection was changed by someone else. Refresh and try again.';
const refresh = (id: string) => { revalidatePath('/audits'); revalidatePath(`/audits/${id}`); };

export async function scheduleInspection(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = scheduleInspectionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    const { user, siteId } = await authorize('inspection:schedule', d.siteId);

    const checklist = await prisma.auditChecklist.findUnique({
      where: { id: d.checklistId }, select: { id: true, _count: { select: { questions: true } } },
    });
    if (!checklist || checklist._count.questions === 0) return fieldError('checklistId', 'Choose a checklist that has questions');

    const created = await prisma.$transaction(async (tx) => {
      const inspector = await requireSiteUser(tx, d.inspectorId, siteId, ['ADMIN', 'HSE_MANAGER', 'INSPECTOR', 'AUDITOR'], 'The inspector');
      const ins = await tx.auditInspection.create({
        data: {
          referenceNo: await nextReference(tx, 'INS'), siteId, checklistId: checklist.id,
          inspectorId: inspector.id, createdById: user.id, scheduledDate: d.scheduledDate,
        },
        select: { id: true, referenceNo: true },
      });
      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'INSPECTION', entityId: ins.id,
        action: 'inspection.scheduled', metadata: { scheduledDate: d.scheduledDate.toISOString(), inspectorId: inspector.id },
      });
      return ins;
    });

    revalidatePath('/audits');
    return { ok: true, message: `${created.referenceNo} scheduled.` };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Saves ONE checklist answer (called on every tap, so it works well on a phone).
 * The first answer on a scheduled inspection starts it. The row lock taken by the status
 * update serializes this against completeInspection, so no answer can slip in after scoring.
 */
export async function submitInspectionResponse(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = responseSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    const ins = await loadInspection(d.inspectionId);
    const user = await authorizeExecution(ins);
    if (!WORKABLE_STATUSES.includes(ins.status)) {
      throw new WorkflowError(ins.status === 'COMPLETED' ? 'This inspection is completed, so answers can no longer change.' : 'This inspection was cancelled.');
    }

    const question = await prisma.checklistQuestion.findFirst({
      where: { id: d.questionId, checklistId: ins.checklistId }, select: { id: true },
    });
    if (!question) throw new WorkflowError('That question is not part of this inspection.');

    const key = { inspectionId_questionId: { inspectionId: ins.id, questionId: d.questionId } };
    const existing = await prisma.inspectionResponse.findUnique({ where: key, select: { ncr: { select: { referenceNo: true } } } });
    if (existing?.ncr && d.result !== 'NON_COMPLIANT') {
      throw new WorkflowError(`${existing.ncr.referenceNo} was raised for this finding, so the item must stay a fail.`);
    }

    const data = { result: d.result, findingDescription: d.findingDescription ?? null, evidenceUrls: d.evidenceUrls };
    const started = await prisma.$transaction(async (tx) => {
      const s = await tx.auditInspection.updateMany({
        where: { id: ins.id, status: 'SCHEDULED' }, data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });
      const live = await tx.auditInspection.updateMany({ where: { id: ins.id, status: 'IN_PROGRESS' }, data: { updatedAt: new Date() } });
      if (live.count === 0) throw new WorkflowError('This inspection is no longer open for answers.');

      await tx.inspectionResponse.upsert({
        where: key,
        create: { inspectionId: ins.id, questionId: d.questionId, answeredById: user.id, ...data },
        update: { ...data, answeredById: user.id, answeredAt: new Date() },
      });
      if (s.count > 0) {
        await logActivity(tx, {
          siteId: ins.siteId, actorId: user.id, entityType: 'INSPECTION', entityId: ins.id, action: 'inspection.started',
        });
      }
      return s.count > 0;
    });

    if (started) refresh(ins.id); // status badge changes; later answers don't need a page refresh
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}

/** IN_PROGRESS -> COMPLETED. Every question must be answered. The score is computed here from stored answers. */
export async function completeInspection(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = inspectionIdSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);

    const ins = await loadInspection(parsed.data.inspectionId);
    const user = await authorizeExecution(ins);
    if (ins.status === 'COMPLETED') throw new WorkflowError('This inspection is already completed.');
    if (ins.status !== 'IN_PROGRESS') throw new WorkflowError('Answer the checklist before completing the inspection.');

    const outcome = await prisma.$transaction(async (tx) => {
      // Flip first: the row lock blocks late answers, and any throw below rolls the flip back.
      const flipped = await tx.auditInspection.updateMany({
        where: { id: ins.id, status: 'IN_PROGRESS' }, data: { status: 'COMPLETED', completedDate: new Date() },
      });
      if (flipped.count === 0) throw new WorkflowError(STALE);

      const [questions, responses] = await Promise.all([
        tx.checklistQuestion.findMany({ where: { checklistId: ins.checklistId }, select: { id: true, weight: true } }),
        tx.inspectionResponse.findMany({
          where: { inspectionId: ins.id }, select: { questionId: true, result: true, ncr: { select: { id: true } } },
        }),
      ]);
      const byQuestion = new Map(responses.map((r) => [r.questionId, r]));
      const missing = questions.filter((q) => !byQuestion.has(q.id)).length;
      if (missing > 0) throw new WorkflowError(`${missing} question${missing === 1 ? ' is' : 's are'} still unanswered.`);

      const score = computeScore(questions.map((q) => ({ weight: q.weight, result: byQuestion.get(q.id)!.result })));
      await tx.auditInspection.update({
        where: { id: ins.id },
        data: { scorePercentage: score.pct === null ? null : new Prisma.Decimal(score.pct.toFixed(2)) },
      });

      const withoutNcr = responses.filter((r) => r.result === 'NON_COMPLIANT' && !r.ncr).length;
      await logActivity(tx, {
        siteId: ins.siteId, actorId: user.id, entityType: 'INSPECTION', entityId: ins.id,
        action: 'inspection.completed', metadata: { score: score.pct, failed: score.nonCompliant },
      });
      return { score, withoutNcr };
    });

    refresh(ins.id);
    let message = outcome.score.pct === null
      ? 'Inspection completed. Every item was N/A, so there is no score.'
      : `Inspection completed. Score ${outcome.score.pct.toFixed(1)}%.`;
    if (outcome.withoutNcr > 0) {
      message += ` ${outcome.withoutNcr} failed item${outcome.withoutNcr === 1 ? '' : 's'} still need${outcome.withoutNcr === 1 ? 's' : ''} an NCR.`;
    }
    return { ok: true, message };
  } catch (e) {
    return failure(e);
  }
}

export async function cancelInspection(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = cancelInspectionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);

    const ins = await loadInspection(parsed.data.inspectionId);
    const { user } = await authorize('inspection:schedule', ins.siteId);
    if (!WORKABLE_STATUSES.includes(ins.status)) throw new WorkflowError('Only a scheduled or in-progress inspection can be cancelled.');

    await prisma.$transaction(async (tx) => {
      const r = await tx.auditInspection.updateMany({
        where: { id: ins.id, status: ins.status }, data: { status: 'CANCELLED', cancelReason: parsed.data.reason },
      });
      if (r.count === 0) throw new WorkflowError(STALE);
      await logActivity(tx, {
        siteId: ins.siteId, actorId: user.id, entityType: 'INSPECTION', entityId: ins.id,
        action: 'inspection.cancelled', metadata: { reason: parsed.data.reason },
      });
    });

    refresh(ins.id);
    return { ok: true, message: `${ins.referenceNo} cancelled.` };
  } catch (e) {
    return failure(e);
  }
}
