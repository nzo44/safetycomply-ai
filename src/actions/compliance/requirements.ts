'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { ForbiddenError } from '@/lib/auth/rbac';
import { failure, invalid, type ActionResult } from '@/lib/action-result';
import { requirementSchema, type RequirementInput } from '@/lib/validations/compliance';
import { addDays } from '@/lib/utils';

const toData = (d: RequirementInput) => ({
  title: d.title,
  citation: d.citation,
  authority: d.authority,
  jurisdiction: d.jurisdiction,
  category: d.category,
  obligation: d.obligation,
  description: d.description ?? null,
  sourceUrl: d.sourceUrl ?? null,
  ownerId: d.ownerId ?? null,
  effectiveDate: d.effectiveDate ?? null,
  reviewFrequencyDays: d.reviewFrequencyDays ?? null,
});

/** The owner must be an active user with access to this site. */
async function assertOwnerInSite(ownerId: string | undefined, siteId: string) {
  if (!ownerId) return;
  const ok = await prisma.user.findFirst({
    where: { id: ownerId, isActive: true, OR: [{ role: 'ADMIN' }, { sites: { some: { siteId } } }] },
    select: { id: true },
  });
  if (!ok) throw new ForbiddenError('The selected owner does not have access to this site.');
}

export async function createRequirement(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const { siteId } = await authorize('requirement:write');
    const parsed = requirementSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    await assertOwnerInSite(d.ownerId, siteId);

    const created = await prisma.legalRequirement.create({
      data: {
        ...toData(d),
        siteId,
        nextReviewDate:
          d.nextReviewDate ?? (d.reviewFrequencyDays ? addDays(new Date(), d.reviewFrequencyDays) : null),
      },
      select: { id: true },
    });
    id = created.id;
  } catch (e) {
    return failure(e);
  }
  revalidatePath('/compliance');
  redirect(`/compliance/${id}`);
}

export async function updateRequirement(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const existing = await prisma.legalRequirement.findUnique({ where: { id }, select: { siteId: true } });
    if (!existing) return { ok: false, error: 'This requirement no longer exists.' };
    await authorize('requirement:write', existing.siteId);

    const parsed = requirementSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    await assertOwnerInSite(parsed.data.ownerId, existing.siteId);

    await prisma.legalRequirement.update({
      where: { id },
      data: { ...toData(parsed.data), nextReviewDate: parsed.data.nextReviewDate ?? null },
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath('/compliance');
  revalidatePath(`/compliance/${id}`);
  redirect(`/compliance/${id}`);
}

/** Soft-delete: audit history is preserved. Bind the id: `archiveRequirement.bind(null, id)`. */
export async function archiveRequirement(id: string): Promise<void> {
  const existing = await prisma.legalRequirement.findUnique({ where: { id }, select: { siteId: true } });
  if (!existing) notFound();
  await authorize('requirement:write', existing.siteId);
  await prisma.legalRequirement.update({ where: { id }, data: { isActive: false } });
  revalidatePath('/compliance');
  redirect('/compliance');
}
