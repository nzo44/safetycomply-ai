import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { can, ForbiddenError } from '@/lib/auth/rbac';
import { WorkflowError } from '@/lib/action-result';

export async function loadInspection(id: string) {
  const i = await prisma.auditInspection.findUnique({
    where: { id },
    select: { id: true, siteId: true, referenceNo: true, status: true, inspectorId: true, checklistId: true },
  });
  if (!i) throw new WorkflowError('This inspection no longer exists.');
  return i;
}

/** Execute permission at the inspection's own site, and the assigned inspector or an HSE manager. */
export async function authorizeExecution(i: { siteId: string; inspectorId: string }) {
  const { user } = await authorize('inspection:execute', i.siteId);
  if (i.inspectorId !== user.id && !can(user.role, 'inspection:schedule')) {
    throw new ForbiddenError('Only the assigned inspector or an HSE manager can work on this inspection.');
  }
  return user;
}
