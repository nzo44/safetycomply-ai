'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { can, ForbiddenError } from '@/lib/auth/rbac';
import { failure, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { requireSiteUser } from '@/lib/incidents/access';
import { authorizeExecution } from '@/lib/audits/access';
import { NCR_PRIORITY } from '@/lib/audits/meta';
import { nextReference } from '@/lib/reference';
import { closeNcrSchema, ncrSchema } from '@/lib/validations/audit';

const STALE = 'This NCR was changed by someone else. Refresh and try again.';

/**
 * Raises an NCR from a failed checklist item, and optionally creates or links a CAPA in one step.
 * Also covers the follow-up case: for an existing NCR that is still open with no action, it attaches one.
 * Issuing or linking an action needs capa:manage. Raising the NCR itself needs only execution rights,
 * so an inspector can raise a major NCR in the field and a manager issues the action afterwards.
 */
export async function triggerNcrFromFinding(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = ncrSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    const resp = await prisma.inspectionResponse.findUnique({
      where: { id: d.responseId },
      include: {
        inspection: { select: { id: true, siteId: true, referenceNo: true, status: true, inspectorId: true } },
        question: { select: { question: true } },
        ncr: { select: { id: true, referenceNo: true, status: true, capaTaskId: true, severity: true, summary: true, containmentActions: true } },
      },
    });
    if (!resp) throw new WorkflowError('This finding no longer exists.');
    const ins = resp.inspection;
    const user = await authorizeExecution(ins);

    if (ins.status !== 'IN_PROGRESS' && ins.status !== 'COMPLETED') throw new WorkflowError('NCRs can be raised once the inspection has started.');
    if (resp.result !== 'NON_COMPLIANT') throw new WorkflowError('NCRs can only be raised for failed items.');

    const existing = resp.ncr;
    if (existing && !(existing.status === 'OPEN' && !existing.capaTaskId)) {
      throw new WorkflowError(`${existing.referenceNo} already has an action or is closed.`);
    }
    if (existing && d.capaMode === 'none') {
      throw new WorkflowError(`${existing.referenceNo} already exists. Issue an action for it, or close it from the inspection page.`);
    }
    if (d.capaMode !== 'none' && !can(user.role, 'capa:manage')) {
      throw new ForbiddenError('Only an HSE manager can issue or link a corrective action.');
    }

    const severity = existing?.severity ?? d.severity;
    const summary = existing?.summary ?? d.summary;
    const containment = existing?.containmentActions ?? d.containmentActions ?? null;

    const out = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction: the answer could have been changed since we read it.
      const stillFailed = await tx.inspectionResponse.count({ where: { id: resp.id, result: 'NON_COMPLIANT' } });
      if (stillFailed === 0) throw new WorkflowError('This item is no longer a fail.');

      let capa: { id: string; referenceNo: string } | null = null;
      let linked = false;

      if (d.capaMode === 'create') {
        const assignee = await requireSiteUser(tx, d.assigneeId!, ins.siteId, undefined, 'The assignee');
        capa = await tx.capaAction.create({
          data: {
            referenceNo: await nextReference(tx, 'CAPA'),
            siteId: ins.siteId, inspectionId: ins.id,
            title: d.capaTitle!,
            description: `${summary}${containment ? `\n\nContainment taken: ${containment}` : ''}\n\nRaised from ${ins.referenceNo}: ${resp.question.question}`,
            type: d.capaType, priority: NCR_PRIORITY[severity],
            assigneeId: assignee.id, createdById: user.id, dueDate: d.dueDate!, originalDueDate: d.dueDate!,
          },
          select: { id: true, referenceNo: true },
        });
        await logActivity(tx, {
          siteId: ins.siteId, actorId: user.id, entityType: 'CAPA', entityId: capa.id, action: 'capa.created',
          metadata: { referenceNo: capa.referenceNo, priority: NCR_PRIORITY[severity], assigneeId: assignee.id, dueDate: d.dueDate!.toISOString() },
        });
      } else if (d.capaMode === 'link') {
        capa = await tx.capaAction.findFirst({
          where: { id: d.existingCapaId!, siteId: ins.siteId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
          select: { id: true, referenceNo: true },
        });
        if (!capa) throw new WorkflowError('That action is not open at this site.');
        linked = true;
      }

      const status = capa ? ('CAPA_ISSUED' as const) : ('OPEN' as const);
      if (existing) {
        const r = await tx.nonConformanceReport.updateMany({
          where: { id: existing.id, status: 'OPEN', capaTaskId: null }, data: { status, capaTaskId: capa?.id ?? null },
        });
        if (r.count === 0) throw new WorkflowError(STALE);
        await logActivity(tx, {
          siteId: ins.siteId, actorId: user.id, entityType: 'NCR', entityId: existing.id, action: 'ncr.action_issued',
          metadata: { referenceNo: existing.referenceNo, capaRef: capa?.referenceNo, linked },
        });
        return { ncrRef: existing.referenceNo, capaRef: capa?.referenceNo ?? null, raised: false };
      }

      const ncr = await tx.nonConformanceReport.create({
        data: {
          referenceNo: await nextReference(tx, 'NCR'), siteId: ins.siteId, inspectionId: ins.id, responseId: resp.id,
          raisedById: user.id, severity, summary, containmentActions: containment, status, capaTaskId: capa?.id ?? null,
        },
        select: { id: true, referenceNo: true },
      });
      await logActivity(tx, {
        siteId: ins.siteId, actorId: user.id, entityType: 'NCR', entityId: ncr.id, action: 'ncr.raised',
        metadata: { referenceNo: ncr.referenceNo, severity, capaRef: capa?.referenceNo ?? null },
      });
      return { ncrRef: ncr.referenceNo, capaRef: capa?.referenceNo ?? null, raised: true };
    });

    revalidatePath('/audits');
    revalidatePath(`/audits/${ins.id}`);
    revalidatePath('/incidents/capa');
    const base = out.raised ? `${out.ncrRef} raised` : `Action issued for ${out.ncrRef}`;
    return { ok: true, message: out.capaRef ? `${base}, linked to ${out.capaRef}.` : `${base}. An HSE manager still needs to issue an action.` };
  } catch (e) {
    return failure(e);
  }
}

/** On-the-spot closure, for minor NCRs only. Everything else closes when its action is verified. */
export async function closeNcr(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = closeNcrSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);

    const ncr = await prisma.nonConformanceReport.findUnique({
      where: { id: parsed.data.ncrId },
      select: { id: true, siteId: true, inspectionId: true, referenceNo: true, status: true, severity: true, capaTaskId: true },
    });
    if (!ncr) throw new WorkflowError('This NCR no longer exists.');
    const { user } = await authorize('inspection:schedule', ncr.siteId);

    if (ncr.status !== 'OPEN' || ncr.capaTaskId) {
      throw new WorkflowError('Only an NCR without an action can be closed here. Others close when their action is verified.');
    }
    if (ncr.severity !== 'MINOR') throw new WorkflowError('Major and critical NCRs need a corrective action before they can be closed.');

    await prisma.$transaction(async (tx) => {
      const r = await tx.nonConformanceReport.updateMany({
        where: { id: ncr.id, status: 'OPEN', capaTaskId: null },
        data: { status: 'CLOSED', closedAt: new Date(), closureNotes: parsed.data.closureNotes },
      });
      if (r.count === 0) throw new WorkflowError(STALE);
      await logActivity(tx, {
        siteId: ncr.siteId, actorId: user.id, entityType: 'NCR', entityId: ncr.id,
        action: 'ncr.closed', metadata: { referenceNo: ncr.referenceNo, notes: parsed.data.closureNotes },
      });
    });

    revalidatePath('/audits');
    revalidatePath(`/audits/${ncr.inspectionId}`);
    return { ok: true, message: `${ncr.referenceNo} closed.` };
  } catch (e) {
    return failure(e);
  }
}
