'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { failure, invalid, type ActionResult } from '@/lib/action-result';
import { logActivity } from '@/lib/activity';
import { checklistSchema } from '@/lib/validations/audit';

/** Templates are org-wide and immutable. To change one, create a new version. */
export async function createChecklist(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { user, siteId } = await authorize('checklist:manage');
    const parsed = checklistSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    await prisma.$transaction(async (tx) => {
      const checklist = await tx.auditChecklist.create({
        data: {
          title: d.title, standard: d.standard, description: d.description, createdById: user.id,
          questions: { create: d.questions.map((q, i) => ({ ...q, sortOrder: i })) },
        },
        select: { id: true },
      });
      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'CHECKLIST', entityId: checklist.id,
        action: 'checklist.created', metadata: { title: d.title, standard: d.standard, questions: d.questions.length },
      });
    });

    revalidatePath('/audits');
    return { ok: true, message: `Checklist created with ${d.questions.length} questions.` };
  } catch (e) {
    return failure(e);
  }
}
