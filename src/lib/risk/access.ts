import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { can, ForbiddenError } from '@/lib/auth/rbac';
import { WorkflowError } from '@/lib/action-result';

/** A draft the caller may edit: write permission, site access, assessor or HSE manager. */
export async function loadEditableAssessment(assessmentId: string) {
  const a = await prisma.riskAssessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, siteId: true, referenceNo: true, version: true, status: true, type: true, assessorId: true },
  });
  if (!a) throw new WorkflowError('This assessment no longer exists.');
  const { user } = await authorize('risk:write', a.siteId);
  if (a.status !== 'DRAFT') throw new WorkflowError('Only a draft can be edited. Approved assessments are changed by creating a new version.');
  if (a.assessorId !== user.id && !can(user.role, 'risk:approve')) {
    throw new ForbiddenError('Only the assessor or an HSE manager can edit this draft.');
  }
  return { a, user };
}

/** Serializes edits against submit: fails if the assessment stopped being a draft. */
export async function touchDraft(tx: Prisma.TransactionClient, assessmentId: string) {
  const r = await tx.riskAssessment.updateMany({ where: { id: assessmentId, status: 'DRAFT' }, data: { updatedAt: new Date() } });
  if (r.count === 0) throw new WorkflowError('This assessment is no longer a draft.');
}

export const hazardsInOrder = (db: Prisma.TransactionClient, assessmentId: string) =>
  db.hazardItem.findMany({
    where: { riskAssessmentId: assessmentId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, hazard: true, initialLevel: true, residualLevel: true, controlHierarchy: true },
  });
