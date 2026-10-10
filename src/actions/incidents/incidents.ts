'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth/guard';
import { can, ForbiddenError } from '@/lib/auth/rbac';
import { failure, fieldError, invalid, WorkflowError, type ActionResult } from '@/lib/action-result';
import { changedKeys, logActivity } from '@/lib/activity';
import { nextReference } from '@/lib/reference';
import { resolveSiteTime } from '@/lib/site-time';
import { requireSiteUser } from '@/lib/incidents/access';
import { OPEN_CAPA_STATUSES, requiresRca } from '@/lib/incidents/workflow';
import {
  closeIncidentSchema, incidentSchema, reopenIncidentSchema, startInvestigationSchema,
  type IncidentInput,
} from '@/lib/validations/incident';

/** Maps validated input to DB columns and applies regulatory rules the form can't be trusted with. */
function toIncidentData(d: IncidentInput, occurredAt: Date) {
  const fatal = d.fatalityCount > 0;
  const isRecordable = d.isRecordable || fatal || d.lostTimeDays > 0;
  const isReportable = d.isReportableToAuthority || fatal || d.severity === 'CATASTROPHIC';
  return {
    title: d.title,
    description: d.description,
    type: d.type,
    severity: d.severity,
    occurredAt,
    location: d.location ?? null,
    immediateActions: d.immediateActions ?? null,
    injuredCount: d.injuredCount,
    fatalityCount: d.fatalityCount,
    lostTimeDays: d.lostTimeDays,
    isRecordable,
    isReportableToAuthority: isReportable,
    authorityReportedAt: isReportable ? (d.authorityReportedAt ?? null) : null,
    authorityReferenceNo: isReportable ? (d.authorityReferenceNo ?? null) : null,
  };
}

export async function reportIncident(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const { user, siteId } = await authorize('incident:report');
    const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    const when = await resolveSiteTime(d.occurredAt, siteId);
    if ('error' in when) return fieldError('occurredAt', when.error);

    const created = await prisma.$transaction(async (tx) => {
      const inc = await tx.incident.create({
        data: {
          referenceNo: await nextReference(tx, 'INC'),
          siteId,
          reportedById: user.id,
          ...toIncidentData(d, when.date),
        },
        select: { id: true, referenceNo: true },
      });
      await logActivity(tx, {
        siteId, actorId: user.id, entityType: 'INCIDENT', entityId: inc.id,
        action: 'incident.reported', metadata: { referenceNo: inc.referenceNo, severity: d.severity, type: d.type },
      });
      return inc;
    });
    id = created.id;
  } catch (e) {
    return failure(e);
  }
  revalidatePath('/incidents');
  redirect(`/incidents/${id}`);
}

/** Managers can edit until closure; the reporter only while the incident is still REPORTED. */
export async function updateIncident(
  incidentId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const before = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!before) throw new WorkflowError('This incident no longer exists.');
    const { user } = await authorize('incident:report', before.siteId);

    if (before.status === 'CLOSED') throw new WorkflowError('Closed incidents cannot be edited. Reopen the incident first.');
    const isManager = can(user.role, 'incident:manage');
    if (!isManager && !(before.reportedById === user.id && before.status === 'REPORTED')) {
      throw new ForbiddenError('Only the reporter can edit, and only before the investigation starts.');
    }

    const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const when = await resolveSiteTime(parsed.data.occurredAt, before.siteId);
    if ('error' in when) return fieldError('occurredAt', when.error);

    const data = toIncidentData(parsed.data, when.date);
    const changed = changedKeys(before as unknown as Record<string, unknown>, data);

    if (changed.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.incident.update({ where: { id: incidentId }, data });
        await logActivity(tx, {
          siteId: before.siteId, actorId: user.id, entityType: 'INCIDENT', entityId: incidentId,
          action: 'incident.updated', metadata: { changed },
        });
      });
    }
    revalidatePath('/incidents');
    revalidatePath(`/incidents/${incidentId}`);
    return { ok: true, message: changed.length ? 'Incident updated.' : 'No changes to save.' };
  } catch (e) {
    return failure(e);
  }
}

/** REPORTED -> UNDER_INVESTIGATION. Creates the RCA shell and assigns its lead. */
export async function startInvestigation(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = startInvestigationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { incidentId, leadId, method } = parsed.data;

    const inc = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, siteId: true, title: true, description: true, referenceNo: true },
    });
    if (!inc) throw new WorkflowError('This incident no longer exists.');
    const { user } = await authorize('incident:manage', inc.siteId);

    await prisma.$transaction(async (tx) => {
      const lead = await requireSiteUser(tx, leadId, inc.siteId, ['ADMIN', 'HSE_MANAGER', 'INSPECTOR'], 'The investigation lead');

      const moved = await tx.incident.updateMany({
        where: { id: inc.id, status: 'REPORTED' },
        data: { status: 'UNDER_INVESTIGATION' },
      });
      if (moved.count === 0) throw new WorkflowError('This incident is already under investigation or closed.');

      const rca = await tx.rcaAnalysis.create({
        data: {
          incidentId: inc.id,
          method,
          leadId: lead.id,
          problemStatement: `${inc.title}: ${inc.description}`.slice(0, 1000),
          whyChain: [],
        },
        select: { id: true },
      });
      await logActivity(tx, {
        siteId: inc.siteId, actorId: user.id, entityType: 'INCIDENT', entityId: inc.id,
        action: 'incident.investigation_started', metadata: { rcaId: rca.id, leadId: lead.id, method },
      });
    });

    revalidatePath('/incidents');
    revalidatePath(`/incidents/${inc.id}`);
    return { ok: true, message: 'Investigation started.' };
  } catch (e) {
    return failure(e);
  }
}

export async function closeIncident(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = closeIncidentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { incidentId, closureNotes } = parsed.data;

    const inc = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: { rca: { select: { status: true } }, capaActions: { select: { status: true } } },
    });
    if (!inc) throw new WorkflowError('This incident no longer exists.');
    const { user } = await authorize('incident:manage', inc.siteId);
    if (inc.status === 'CLOSED') throw new WorkflowError('This incident is already closed.');

    const blockers: string[] = [];
    const open = inc.capaActions.filter((c) => OPEN_CAPA_STATUSES.includes(c.status)).length;
    if (open > 0) blockers.push(`${open} corrective or preventive action${open === 1 ? ' is' : 's are'} still open`);
    if (requiresRca(inc)) {
      if (inc.rca?.status !== 'APPROVED') blockers.push('the root cause analysis must be approved');
      if (!inc.capaActions.some((c) => c.status !== 'CANCELLED')) blockers.push('add at least one corrective or preventive action');
    }
    if (blockers.length > 0) return { ok: false, error: `This incident can't be closed yet: ${blockers.join('; ')}.` };

    await prisma.$transaction(async (tx) => {
      const closed = await tx.incident.updateMany({
        where: { id: inc.id, status: inc.status },
        data: { status: 'CLOSED', closedAt: new Date(), closureNotes },
      });
      if (closed.count === 0) throw new WorkflowError('This incident was changed by someone else. Refresh and try again.');
      await logActivity(tx, {
        siteId: inc.siteId, actorId: user.id, entityType: 'INCIDENT', entityId: inc.id,
        action: 'incident.closed', metadata: { from: inc.status },
      });
    });

    revalidatePath('/incidents');
    revalidatePath(`/incidents/${inc.id}`);
    return { ok: true, message: 'Incident closed.' };
  } catch (e) {
    return failure(e);
  }
}

export async function reopenIncident(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const parsed = reopenIncidentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { incidentId, reason } = parsed.data;

    const inc = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, siteId: true, status: true, closureNotes: true, rca: { select: { status: true } } },
    });
    if (!inc) throw new WorkflowError('This incident no longer exists.');
    const { user } = await authorize('incident:manage', inc.siteId);
    if (inc.status !== 'CLOSED') throw new WorkflowError('Only closed incidents can be reopened.');

    const to = inc.rca?.status === 'APPROVED' ? 'CAPA_IN_PROGRESS' : 'UNDER_INVESTIGATION';
    await prisma.$transaction(async (tx) => {
      const r = await tx.incident.updateMany({
        where: { id: inc.id, status: 'CLOSED' },
        data: { status: to, closedAt: null, closureNotes: null },
      });
      if (r.count === 0) throw new WorkflowError('This incident was changed by someone else. Refresh and try again.');
      await logActivity(tx, {
        siteId: inc.siteId, actorId: user.id, entityType: 'INCIDENT', entityId: inc.id,
        action: 'incident.reopened', metadata: { reason, to, previousClosureNotes: inc.closureNotes },
      });
    });

    revalidatePath('/incidents');
    revalidatePath(`/incidents/${inc.id}`);
    return { ok: true, message: 'Incident reopened.' };
  } catch (e) {
    return failure(e);
  }
}
