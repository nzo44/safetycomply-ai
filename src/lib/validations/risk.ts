import { z } from 'zod';
import { AssessmentType, ControlHierarchy } from '@prisma/client';
import { blankToUndefined, id, lineList, optId, optText } from './helpers';

const rating = (label: string) =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ required_error: `Choose ${label} on the matrix`, invalid_type_error: `Choose ${label} on the matrix` })
      .int()
      .min(1, 'Use a rating from 1 to 5')
      .max(5, 'Use a rating from 1 to 5'),
  );
const optRating = z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(5).optional());

export const assessmentSchema = z.object({
  title: z.string().trim().min(5, 'Enter a title of at least 5 characters').max(200),
  type: z.nativeEnum(AssessmentType, { errorMap: () => ({ message: 'Choose JSA or HIRA' }) }),
  activity: z.string().trim().min(5, 'Describe the task or process in at least 5 characters').max(300),
  area: optText(200),
  scope: optText(3000),
  teamMembers: lineList(20, 100),
  assessedAt: z.preprocess(
    blankToUndefined,
    z.coerce.date().refine((d) => d.getTime() <= Date.now() + 86_400_000, 'The assessment date cannot be in the future').optional(),
  ),
});
export type AssessmentInput = z.infer<typeof assessmentSchema>;

/** The type is fixed once created, because a JSA needs task steps and a HIRA does not. */
export const assessmentUpdateSchema = assessmentSchema.omit({ type: true }).extend({ assessmentId: id() });

export const hazardSchema = z
  .object({
    assessmentId: id(),
    hazardId: optId, // present when editing
    taskStep: optText(300),
    hazard: z.string().trim().min(3, 'Describe the hazard').max(500),
    consequence: z.string().trim().min(3, 'Describe what could happen').max(500),
    whoAtRisk: optText(200),
    initialLikelihood: rating('a likelihood'),
    initialSeverity: rating('a severity'),
    controlMeasures: z.string().trim().min(10, 'Describe the controls in at least 10 characters').max(3000),
    controlHierarchy: z.nativeEnum(ControlHierarchy, { errorMap: () => ({ message: 'Choose the strongest control type used' }) }),
    requiredPpe: lineList(15, 100),
    residualLikelihood: optRating,
    residualSeverity: optRating,
    responsibleId: z.preprocess(blankToUndefined, z.string().uuid('Choose a valid person').optional()),
  })
  .superRefine((d, ctx) => {
    const hasL = d.residualLikelihood != null;
    const hasS = d.residualSeverity != null;
    if (hasL !== hasS) {
      ctx.addIssue({ code: 'custom', path: ['residualLikelihood'], message: 'Rate both likelihood and severity for the residual risk, or leave it blank' });
    } else if (hasL && hasS && d.residualLikelihood! * d.residualSeverity! > d.initialLikelihood * d.initialSeverity) {
      ctx.addIssue({ code: 'custom', path: ['residualLikelihood'], message: 'The residual risk cannot be higher than the initial risk' });
    }
  });
export type HazardInput = z.infer<typeof hazardSchema>;

export const assessmentIdSchema = z.object({ assessmentId: id() });

export const reviewAssessmentSchema = z
  .object({
    assessmentId: id(),
    decision: z.enum(['approve', 'return'], { errorMap: () => ({ message: 'Choose approve or return' }) }),
    comments: optText(3000),
  })
  .refine((d) => d.decision === 'approve' || (d.comments && d.comments.length >= 10), {
    path: ['comments'],
    message: 'Explain what needs to change (at least 10 characters)',
  });

export const archiveAssessmentSchema = z.object({
  assessmentId: id(),
  reason: z.string().trim().min(5, 'Explain why (at least 5 characters)').max(1000),
});

export const hazardRefSchema = z.object({ hazardId: id() });
export const moveHazardSchema = z.object({ hazardId: id(), direction: z.enum(['up', 'down']) });
