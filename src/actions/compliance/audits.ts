'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { failure, invalid, type ActionResult } from '@/lib/action-result';
import { auditSchema } from '@/lib/validations/compliance';
import { CAPA_DUE_DAYS } from '@/lib/compliance-meta';
import { assertEvidenceForSite } from '@/lib/evidence-guard';
import { nextCapaReference } from '@/lib/reference';
import { addDays } from '@/lib/utils';

/**
 * Records an audit and, in one transaction:
 *  1. rolls the result up to LegalRequirement.currentStatus / nextReviewDate
 *     (only if this is the most recent audit, so back-dated entries don't overwrite)
 *  2. optionally raises a CAPA for non-compliant / partially compliant results
 */
export async function recordAudit(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = auditSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    const requirement = await prisma.legalRequirement.findUnique({
      where: { id: d.requirementId },
      select: { id: true, siteId: true, title: true, ownerId: true, reviewFrequencyDays: true, isActive: true },
    });
    if (!requirement || !requirement.isActive) return { ok: false, error: 'This requirement no longer exists.' };

    const { user, siteId } = await authorize('audit:write', requirement.siteId);
    assertEvidenceForSite(d.evidenceUrls, siteId);
    const hasGap = d.status === 'NON_COMPLIANT' || d.status === 'PARTIALLY_COMPLIANT';

    await prisma.$transaction(async (tx) => {
      const latest = await tx.complianceAudit.findFirst({
        where: { requirementId: requirement.id },
        orderBy: { auditDate: 'desc' },
        select: { auditDate: true },
      });

      const audit = await tx.complianceAudit.create({
        data: {
          siteId,
          requirementId: requirement.id,
          auditorId: user.id,
          auditDate: d.auditDate,
          status: d.status,
          findings: d.findings ?? null,
          evidenceUrls: d.evidenceUrls,
          gapDescription: hasGap ? d.gapDescription : null,
          gapSeverity: hasGap ? d.gapSeverity : null,
          nextAuditDue: d.nextAuditDue ?? null,
        },
      });

      if (!latest || d.auditDate >= latest.auditDate) {
        await tx.legalRequirement.update({
          where: { id: requirement.id },
          data: {
            currentStatus: d.status,
            nextReviewDate:
              d.nextAuditDue ??
              (requirement.reviewFrequencyDays ? addDays(d.auditDate, requirement.reviewFrequencyDays) : null),
          },
        });
      }

      if (hasGap && d.createCapa && d.gapSeverity) {
        const due = addDays(new Date(), CAPA_DUE_DAYS[d.gapSeverity]);
        await tx.capaAction.create({
          data: {
            referenceNo: await nextCapaReference(tx),
            siteId,
            auditId: audit.id,
            title: `Close compliance gap: ${requirement.title}`.slice(0, 200),
            description: d.gapDescription!,
            type: 'CORRECTIVE',
            priority: d.gapSeverity,
            assigneeId: requirement.ownerId ?? user.id,
            createdById: user.id,
            dueDate: due,
            originalDueDate: due,
          },
        });
      }
    });

    revalidatePath('/compliance');
    revalidatePath(`/compliance/${requirement.id}`);
    return { ok: true, message: 'Audit recorded.' };
  } catch (e) {
    return failure(e);
  }
}
