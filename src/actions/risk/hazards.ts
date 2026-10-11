'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { failure, fieldError, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { requireSiteUser } from '@/lib/incidents/access';
import { loadEditableAssessment, touchDraft } from '@/lib/risk/access';
import { levelOf, scoreOf } from '@/lib/risk/matrix';
import { MAX_HAZARDS } from '@/lib/risk/workflow';
import { hazardRefSchema, hazardSchema, moveHazardSchema } from '@/lib/validations/risk';

const refresh = (assessmentId: string) => {
  revalidatePath('/risk');
  revalidatePath(`/risk/${assessmentId}`);
};

/** Create or update one hazard. Scores and levels are computed here from the two ratings, never taken from the form. */
export async function saveHazard(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = hazardSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    const { a, user } = await loadEditableAssessment(d.assessmentId);

    if (a.type === 'JSA' && !d.taskStep) return fieldError('taskStep', 'Describe the task step this hazard belongs to');

    const initialScore = scoreOf(d.initialLikelihood, d.initialSeverity);
    const residualScore =
      d.residualLikelihood != null && d.residualSeverity != null ? scoreOf(d.residualLikelihood, d.residualSeverity) : null;

    const data = {
      taskStep: d.taskStep ?? null,
      hazard: d.hazard,
      consequence: d.consequence,
      whoAtRisk: d.whoAtRisk ?? null,
      initialLikelihood: d.initialLikelihood,
      initialSeverity: d.initialSeverity,
      initialScore,
      initialLevel: levelOf(initialScore),
      controlMeasures: d.controlMeasures,
      controlHierarchy: d.controlHierarchy,
      requiredPpe: d.requiredPpe,
      residualLikelihood: d.residualLikelihood ?? null,
      residualSeverity: d.residualSeverity ?? null,
      residualScore,
      residualLevel: residualScore === null ? null : levelOf(residualScore),
      responsibleId: d.responsibleId ?? null,
    };

    await prisma.$transaction(async (tx) => {
      await touchDraft(tx, a.id);
      if (d.responsibleId) await requireSiteUser(tx, d.responsibleId, a.siteId, undefined, 'The responsible person');

      if (d.hazardId) {
        const r = await tx.hazardItem.updateMany({ where: { id: d.hazardId, riskAssessmentId: a.id }, data });
        if (r.count === 0) throw new WorkflowError('This hazard no longer exists.');
      } else {
        const [count, max] = await Promise.all([
          tx.hazardItem.count({ where: { riskAssessmentId: a.id } }),
          tx.hazardItem.aggregate({ where: { riskAssessmentId: a.id }, _max: { sortOrder: true } }),
        ]);
        if (count >= MAX_HAZARDS) throw new WorkflowError(`An assessment can hold up to ${MAX_HAZARDS} hazards. Split this one into separate assessments.`);
        await tx.hazardItem.create({ data: { ...data, riskAssessmentId: a.id, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
      }

      await logActivity(tx, {
        siteId: a.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: a.id,
        action: 'risk.hazard_saved', metadata: { hazard: d.hazard.slice(0, 80), created: !d.hazardId, initialScore, residualScore },
      });
    });

    refresh(a.id);
    return { ok: true, message: d.hazardId ? 'Hazard updated.' : 'Hazard added.' };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteHazard(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = hazardRefSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);

    const h = await prisma.hazardItem.findUnique({ where: { id: parsed.data.hazardId }, select: { id: true, hazard: true, riskAssessmentId: true } });
    if (!h) throw new WorkflowError('This hazard no longer exists.');
    const { a, user } = await loadEditableAssessment(h.riskAssessmentId);

    await prisma.$transaction(async (tx) => {
      await touchDraft(tx, a.id);
      await tx.hazardItem.deleteMany({ where: { id: h.id, riskAssessmentId: a.id } });
      await logActivity(tx, {
        siteId: a.siteId, actorId: user.id, entityType: 'RISK_ASSESSMENT', entityId: a.id,
        action: 'risk.hazard_removed', metadata: { hazard: h.hazard.slice(0, 80) },
      });
    });

    refresh(a.id);
    return { ok: true, message: 'Hazard removed.' };
  } catch (e) {
    return failure(e);
  }
}

/** Swap with the neighbouring hazard. Order matters for a JSA, and it drives the numbers on the matrix. */
export async function moveHazard(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = moveHazardSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { hazardId, direction } = parsed.data;

    const h = await prisma.hazardItem.findUnique({ where: { id: hazardId }, select: { id: true, riskAssessmentId: true, sortOrder: true } });
    if (!h) throw new WorkflowError('This hazard no longer exists.');
    const { a } = await loadEditableAssessment(h.riskAssessmentId);

    await prisma.$transaction(async (tx) => {
      await touchDraft(tx, a.id);
      const neighbour = await tx.hazardItem.findFirst({
        where: { riskAssessmentId: a.id, sortOrder: direction === 'up' ? { lt: h.sortOrder } : { gt: h.sortOrder } },
        orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
        select: { id: true, sortOrder: true },
      });
      if (!neighbour) return;
      await tx.hazardItem.update({ where: { id: h.id }, data: { sortOrder: neighbour.sortOrder } });
      await tx.hazardItem.update({ where: { id: neighbour.id }, data: { sortOrder: h.sortOrder } });
    });

    refresh(a.id);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
