import { z } from 'zod';
import {
  CapaType, IncidentSeverity, IncidentType, Priority, RcaMethod, RootCauseCategory,
} from '@prisma/client';
import { MAX_WHYS, MIN_WHYS_TO_SUBMIT } from '@/lib/incidents/rca-limits';
import {
  blankToUndefined, checkbox, count, dueDateField, id, jsonField, lineList,
  optDate, optId, optText, uuid,
} from './helpers';

/* ───────────── Incident ───────────── */

export const incidentSchema = z
  .object({
    title: z.string().trim().min(5, 'Enter a title of at least 5 characters').max(200),
    description: z.string().trim().min(20, 'Describe what happened in at least 20 characters').max(5000),
    type: z.nativeEnum(IncidentType, { errorMap: () => ({ message: 'Choose an incident type' }) }),
    severity: z.nativeEnum(IncidentSeverity, { errorMap: () => ({ message: 'Choose a severity' }) }),
    /** `datetime-local` value; converted to UTC in the action using the site's timezone. */
    occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter the date and time the incident occurred'),
    location: optText(200),
    immediateActions: optText(3000),
    injuredCount: count(10_000),
    fatalityCount: count(10_000),
    lostTimeDays: count(3650),
    isRecordable: checkbox,
    isReportableToAuthority: checkbox,
    authorityReportedAt: optDate,
    authorityReferenceNo: optText(100),
  })
  .superRefine((d, ctx) => {
    if (d.fatalityCount > 0 && d.severity !== 'CRITICAL' && d.severity !== 'CATASTROPHIC') {
      ctx.addIssue({ code: 'custom', path: ['severity'], message: 'A fatality must be rated Critical or Catastrophic' });
    }
    if (d.type === 'NEAR_MISS' && (d.injuredCount > 0 || d.fatalityCount > 0 || d.lostTimeDays > 0)) {
      ctx.addIssue({ code: 'custom', path: ['type'], message: 'A near miss cannot involve injuries, fatalities or lost time. Choose Injury instead.' });
    }
    if (d.type === 'INJURY' && d.injuredCount + d.fatalityCount < 1) {
      ctx.addIssue({ code: 'custom', path: ['injuredCount'], message: 'Record at least one injured person' });
    }
  });
export type IncidentInput = z.infer<typeof incidentSchema>;

export const startInvestigationSchema = z.object({
  incidentId: id(),
  leadId: uuid('Choose an investigation lead'),
  method: z.nativeEnum(RcaMethod).default('FIVE_WHYS'),
});

export const closeIncidentSchema = z.object({
  incidentId: id(),
  closureNotes: z.string().trim().min(10, 'Summarize the outcome in at least 10 characters').max(3000),
});

export const reopenIncidentSchema = z.object({
  incidentId: id(),
  reason: z.string().trim().min(10, 'Explain why this incident is being reopened').max(2000),
});

/* ───────────── RCA ───────────── */

/** Levels are assigned from array order in the action, so clients can't send inconsistent numbering. */
const whyStep = z.object({
  why: z.string().trim().max(500),
  answer: z.string().trim().max(1000),
});

const rcaBase = z.object({
  incidentId: id(),
  method: z.nativeEnum(RcaMethod).default('FIVE_WHYS'),
  problemStatement: z.string().trim().min(10, 'Describe the problem in at least 10 characters').max(2000),
  whyChain: jsonField(z.array(whyStep).max(MAX_WHYS, `Use ${MAX_WHYS} whys or fewer`).default([])),
  diagramData: jsonField(
    z.unknown().refine((v) => JSON.stringify(v ?? null).length <= 50_000, 'The diagram is too large'),
  ),
  rootCause: optText(3000),
  rootCauseCategory: z.preprocess(blankToUndefined, z.nativeEnum(RootCauseCategory).optional()),
  contributingFactors: lineList(20, 300),
});

/** Saving a draft only needs a problem statement; everything else can be partial. */
export const rcaDraftSchema = rcaBase;

export const rcaSubmitSchema = rcaBase.superRefine((d, ctx) => {
  if (d.method === 'FIVE_WHYS') {
    if (d.whyChain.length < MIN_WHYS_TO_SUBMIT) {
      ctx.addIssue({ code: 'custom', path: ['whyChain'], message: `Complete at least ${MIN_WHYS_TO_SUBMIT} whys before submitting` });
    } else {
      const bad = d.whyChain.findIndex((s) => s.why.length < 5 || s.answer.length < 5);
      if (bad >= 0) ctx.addIssue({ code: 'custom', path: ['whyChain'], message: `Why ${bad + 1} needs both a question and an answer` });
    }
  } else if (d.diagramData == null) {
    ctx.addIssue({ code: 'custom', path: ['diagramData'], message: 'Add the analysis diagram before submitting' });
  }
  if (!d.rootCause || d.rootCause.length < 10) {
    ctx.addIssue({ code: 'custom', path: ['rootCause'], message: 'State the root cause (at least 10 characters)' });
  }
  if (!d.rootCauseCategory) {
    ctx.addIssue({ code: 'custom', path: ['rootCauseCategory'], message: 'Choose a root cause category' });
  }
});
export type RcaInput = z.infer<typeof rcaBase>;

export const reviewRcaSchema = z
  .object({
    rcaId: id(),
    decision: z.enum(['approve', 'return'], { errorMap: () => ({ message: 'Choose approve or return' }) }),
    comments: optText(3000),
  })
  .refine((d) => d.decision === 'approve' || (d.comments && d.comments.length >= 10), {
    path: ['comments'],
    message: 'Explain what needs to change (at least 10 characters)',
  });

/* ───────────── CAPA ───────────── */

export const capaCreateSchema = z
  .object({
    incidentId: optId,
    rcaId: optId,
    auditId: optId,
    title: z.string().trim().min(5, 'Enter a title of at least 5 characters').max(200),
    description: z.string().trim().min(10, 'Describe the action in at least 10 characters').max(5000),
    type: z.nativeEnum(CapaType, { errorMap: () => ({ message: 'Choose corrective or preventive' }) }),
    priority: z.nativeEnum(Priority, { errorMap: () => ({ message: 'Choose a priority' }) }),
    assigneeId: uuid('Choose an assignee'),
    dueDate: dueDateField,
  })
  .refine((d) => d.incidentId || d.rcaId || d.auditId, {
    path: ['incidentId'],
    message: 'Link the action to an incident, an RCA or an audit',
  });
export type CapaCreateInput = z.infer<typeof capaCreateSchema>;

export const capaTransitionSchema = z
  .object({
    capaId: id(),
    toStatus: z.enum(['IN_PROGRESS', 'PENDING_VERIFICATION', 'CANCELLED'], {
      errorMap: () => ({ message: 'Choose a status' }),
    }),
    notes: optText(3000),
  })
  .refine((d) => d.toStatus === 'IN_PROGRESS' || (d.notes && d.notes.length >= 5), {
    path: ['notes'],
    message: 'Add notes: completion details, or the reason for cancelling',
  });

export const verifyCapaSchema = z.object({
  capaId: id(),
  outcome: z.enum(['effective', 'ineffective'], { errorMap: () => ({ message: 'Choose an outcome' }) }),
  effectivenessNotes: z.string().trim().min(10, 'Explain how you checked effectiveness (at least 10 characters)').max(3000),
});

export const reassignCapaSchema = z.object({
  capaId: id(),
  assigneeId: uuid('Choose an assignee'),
  reason: optText(1000),
});

export const extendCapaSchema = z.object({
  capaId: id(),
  newDueDate: dueDateField,
  reason: z.string().trim().min(10, 'Explain why the date is moving (at least 10 characters)').max(2000),
});

export const escalateCapaSchema = z.object({
  capaId: id(),
  toUserId: uuid('Choose who to escalate to'),
  reason: z.string().trim().min(10, 'Explain the escalation (at least 10 characters)').max(2000),
});
