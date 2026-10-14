import { z } from 'zod';
import { ComplianceStatus, Priority, RequirementCategory } from '@prisma/client';
import { blankToUndefined, evidenceRefList, optDate, optText } from './helpers';

export const requirementSchema = z.object({
  title: z.string().trim().min(3, 'Enter a title of at least 3 characters').max(200),
  citation: z.string().trim().min(2, 'Enter the legal citation, for example "Décret 06-198, Art. 12"').max(300),
  authority: z.string().trim().min(2, 'Enter the issuing authority').max(200),
  jurisdiction: z.string().trim().min(2, 'Enter the jurisdiction').max(100),
  category: z.nativeEnum(RequirementCategory, { errorMap: () => ({ message: 'Choose a category' }) }),
  obligation: z.string().trim().min(10, 'Describe what the site must do (at least 10 characters)').max(5000),
  description: optText(5000),
  sourceUrl: z.preprocess(
    blankToUndefined,
    z.string().trim().max(2000).refine((u) => /^https?:\/\/\S+$/i.test(u), 'Enter a full URL starting with https://').optional(),
  ),
  ownerId: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  effectiveDate: optDate,
  reviewFrequencyDays: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1, 'Enter 1 or more days').max(3650, 'Enter 3650 days or fewer').optional(),
  ),
  nextReviewDate: optDate,
});
export type RequirementInput = z.infer<typeof requirementSchema>;

export const auditSchema = z
  .object({
    requirementId: z.string().min(1),
    status: z.nativeEnum(ComplianceStatus, { errorMap: () => ({ message: 'Choose a result' }) }),
    auditDate: z.coerce
      .date({ errorMap: () => ({ message: 'Enter the audit date' }) })
      .refine((d) => d.getTime() <= Date.now() + 86_400_000, 'The audit date cannot be in the future'),
    findings: optText(5000),
    evidenceUrls: evidenceRefList(10),
    gapDescription: optText(5000),
    gapSeverity: z.preprocess(blankToUndefined, z.nativeEnum(Priority).optional()),
    nextAuditDue: optDate,
    createCapa: z.preprocess((v) => v === 'on' || v === 'true', z.boolean()),
  })
  .superRefine((d, ctx) => {
    if (d.status === 'NON_COMPLIANT' || d.status === 'PARTIALLY_COMPLIANT') {
      if (!d.gapDescription) ctx.addIssue({ code: 'custom', path: ['gapDescription'], message: 'Describe the gap' });
      if (!d.gapSeverity) ctx.addIssue({ code: 'custom', path: ['gapSeverity'], message: 'Choose a gap severity' });
    }
    if (d.nextAuditDue && d.nextAuditDue <= d.auditDate) {
      ctx.addIssue({ code: 'custom', path: ['nextAuditDue'], message: 'The next audit must be after the audit date' });
    }
  });
export type AuditInput = z.infer<typeof auditSchema>;
