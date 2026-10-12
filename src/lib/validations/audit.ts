import { z } from 'zod';
import { AuditStandard, CapaType, InspectionResult, NcrSeverity } from '@prisma/client';
import { DAY_MS, startOfTodayUtc } from '@/lib/utils';
import { blankToUndefined, dueDateField, httpUrlList, id, optId, optText, uuid } from './helpers';

/* ───────── Checklist template ───────── */

export const MAX_QUESTIONS = 200;

/** One question per line: "Category | Question | weight 1-5 (optional) | guidance (optional)". */
function parseQuestionLines(raw: string, ctx: z.RefinementCtx) {
  const out: { category: string; question: string; weight: number; guidanceNote: string | null }[] = [];
  let problems = 0;
  const fail = (message: string) => {
    if (problems++ < 3) ctx.addIssue({ code: 'custom', message }); // report the first few, not hundreds
  };

  raw.split(/\r?\n/).forEach((line, idx) => {
    const t = line.trim();
    if (!t) return;
    const [category, question, weight, guidance] = t.split('|').map((s) => s.trim());
    const n = idx + 1;
    if (!category || !question) return fail(`Line ${n}: use "Category | Question"`);
    if (category.length > 60) return fail(`Line ${n}: the category is longer than 60 characters`);
    if (question.length < 5 || question.length > 500) return fail(`Line ${n}: the question must be 5 to 500 characters`);
    if (weight && !/^[1-5]$/.test(weight)) return fail(`Line ${n}: the weight must be a number from 1 to 5`);
    if (guidance && guidance.length > 500) return fail(`Line ${n}: the guidance is longer than 500 characters`);
    out.push({ category, question, weight: weight ? Number(weight) : 1, guidanceNote: guidance || null });
  });

  if (out.length === 0 && problems === 0) ctx.addIssue({ code: 'custom', message: 'Add at least one question' });
  if (out.length > MAX_QUESTIONS) ctx.addIssue({ code: 'custom', message: `Use ${MAX_QUESTIONS} questions or fewer` });
  return out;
}

export const checklistSchema = z.object({
  title: z.string().trim().min(5, 'Enter a title of at least 5 characters').max(200),
  standard: z.nativeEnum(AuditStandard, { errorMap: () => ({ message: 'Choose a standard' }) }),
  description: z.string().trim().min(10, 'Describe the checklist in at least 10 characters').max(2000),
  questions: z.string({ required_error: 'Add at least one question' }).transform(parseQuestionLines),
});

/* ───────── Inspection ───────── */

export const scheduleInspectionSchema = z.object({
  siteId: id('Missing site'),
  checklistId: id('Choose a checklist'),
  inspectorId: uuid('Choose an inspector'),
  scheduledDate: z.coerce
    .date({ errorMap: () => ({ message: 'Enter the inspection date' }) })
    .refine((d) => d.getTime() >= startOfTodayUtc().getTime(), 'The inspection date cannot be in the past')
    .refine((d) => d.getTime() <= startOfTodayUtc().getTime() + 730 * DAY_MS, 'The inspection date must be within 2 years'),
});

export const responseSchema = z
  .object({
    inspectionId: id(),
    questionId: id(),
    result: z.nativeEnum(InspectionResult, { errorMap: () => ({ message: 'Choose pass, fail or N/A' }) }),
    findingDescription: optText(2000),
    evidenceUrls: httpUrlList(5),
  })
  .superRefine((d, ctx) => {
    if (d.result === 'NON_COMPLIANT' && (!d.findingDescription || d.findingDescription.length < 10)) {
      ctx.addIssue({ code: 'custom', path: ['findingDescription'], message: 'Describe the finding (at least 10 characters)' });
    }
  });

export const inspectionIdSchema = z.object({ inspectionId: id() });

export const cancelInspectionSchema = z.object({
  inspectionId: id(),
  reason: z.string().trim().min(5, 'Explain why (at least 5 characters)').max(1000),
});

/* ───────── NCR ───────── */

export const ncrSchema = z
  .object({
    responseId: id('Missing finding'),
    severity: z.nativeEnum(NcrSeverity, { errorMap: () => ({ message: 'Choose a severity' }) }),
    summary: z.string().trim().min(10, 'Describe the non-conformance in at least 10 characters').max(2000),
    containmentActions: optText(2000),
    capaMode: z.preprocess(blankToUndefined, z.enum(['none', 'create', 'link']).default('none')),
    // create
    capaTitle: optText(200),
    capaType: z.preprocess(blankToUndefined, z.nativeEnum(CapaType).default('CORRECTIVE')),
    assigneeId: z.preprocess(blankToUndefined, z.string().uuid('Choose a valid assignee').optional()),
    dueDate: z.preprocess(blankToUndefined, dueDateField.optional()),
    // link
    existingCapaId: optId,
  })
  .superRefine((d, ctx) => {
    const need = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (d.capaMode === 'create') {
      if (!d.capaTitle || d.capaTitle.length < 5) need('capaTitle', 'Enter an action title of at least 5 characters');
      if (!d.assigneeId) need('assigneeId', 'Choose who will own the action');
      if (!d.dueDate) need('dueDate', 'Enter a due date');
    }
    if (d.capaMode === 'link' && !d.existingCapaId) need('existingCapaId', 'Choose an existing action');
  });

export const closeNcrSchema = z.object({
  ncrId: id(),
  closureNotes: z.string().trim().min(10, 'Say how it was resolved (at least 10 characters)').max(2000),
});
