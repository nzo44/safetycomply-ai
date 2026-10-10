import type {
  CapaStatus, CapaType, IncidentSeverity, IncidentStatus, IncidentType, RcaStatus, RootCauseCategory,
} from '@prisma/client';

export const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  INJURY: 'Injury', ILLNESS: 'Illness', NEAR_MISS: 'Near miss', PROPERTY_DAMAGE: 'Property damage',
  ENVIRONMENTAL_RELEASE: 'Environmental release', FIRE_EXPLOSION: 'Fire or explosion',
  PROCESS_SAFETY: 'Process safety', SECURITY: 'Security', OTHER: 'Other',
};

export const SEVERITY_ORDER: IncidentSeverity[] = ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL', 'CATASTROPHIC'];
export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  MINOR: 'Minor', MODERATE: 'Moderate', MAJOR: 'Major', CRITICAL: 'Critical', CATASTROPHIC: 'Catastrophic',
};
export const SEVERITY_CLASS: Record<IncidentSeverity, string> = {
  MINOR: 'border-line bg-canvas text-steel',
  MODERATE: 'border-amber-300 bg-amber-100 text-amber-900',
  MAJOR: 'border-orange-300 bg-orange-100 text-orange-900',
  CRITICAL: 'border-noncompliant bg-noncompliant text-white',
  CATASTROPHIC: 'border-ink bg-ink text-white',
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  REPORTED: 'Reported', UNDER_INVESTIGATION: 'Under investigation', RCA_COMPLETE: 'Analysis complete',
  CAPA_IN_PROGRESS: 'Actions in progress', CLOSED: 'Closed',
};
export const INCIDENT_STATUS_COLOR: Record<IncidentStatus, string> = {
  REPORTED: '#4A6FA5', UNDER_INVESTIGATION: '#C98A00', RCA_COMPLETE: '#0B5C8A',
  CAPA_IN_PROGRESS: '#0B5C8A', CLOSED: '#1E7B4F',
};

export const CAPA_STATUS_TITLE: Record<CapaStatus, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In progress', PENDING_VERIFICATION: 'Pending verification',
  CLOSED: 'Closed', CANCELLED: 'Cancelled',
};
export const CAPA_STATUS_COLOR: Record<CapaStatus, string> = {
  OPEN: '#4A6FA5', IN_PROGRESS: '#0B5C8A', PENDING_VERIFICATION: '#C98A00', CLOSED: '#1E7B4F', CANCELLED: '#9AA5B1',
};
export const CAPA_TYPE_LABEL: Record<CapaType, string> = { CORRECTIVE: 'Corrective', PREVENTIVE: 'Preventive' };

export const RCA_STATUS_LABEL: Record<RcaStatus, string> = {
  DRAFT: 'Draft', SUBMITTED: 'Awaiting review', APPROVED: 'Approved',
};
export const ROOT_CAUSE_LABEL: Record<RootCauseCategory, string> = {
  HUMAN_FACTORS: 'Human factors', EQUIPMENT_FAILURE: 'Equipment failure', PROCEDURE_GAP: 'Procedure gap',
  TRAINING_GAP: 'Training gap', MANAGEMENT_SYSTEM: 'Management system',
  MATERIAL_OR_SUPPLIER: 'Material or supplier', ENVIRONMENTAL_CONDITIONS: 'Environmental conditions',
  DESIGN_OR_ENGINEERING: 'Design or engineering',
};

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const status = (v: unknown) => CAPA_STATUS_TITLE[v as CapaStatus]?.toLowerCase() ?? String(v ?? '');
const date = (v: unknown) => {
  const s = str(v);
  return s ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(s)) : '—';
};
const withReason = (base: string, reason: unknown) => (str(reason) ? `${base}: ${str(reason)}` : base);

/** One readable sentence per ActivityLog action. `who` resolves user ids to names. */
export function describeActivity(action: string, m: Record<string, unknown>, who: (id: unknown) => string): string {
  switch (action) {
    case 'incident.reported': return 'Incident reported';
    case 'incident.updated': return `Details updated (${Array.isArray(m.changed) ? m.changed.join(', ') : 'fields'})`;
    case 'incident.investigation_started': return `Investigation started, led by ${who(m.leadId)}`;
    case 'incident.closed': return 'Incident closed';
    case 'incident.reopened': return withReason('Incident reopened', m.reason);
    case 'rca.draft_saved': return `Analysis draft saved (${Number(m.whys ?? 0)} whys)`;
    case 'rca.submitted': return 'Analysis submitted for review';
    case 'rca.approved': return 'Analysis approved';
    case 'rca.returned': return withReason('Analysis returned to the lead', m.comments);
    case 'capa.created': return `Action created and assigned to ${who(m.assigneeId)}, due ${date(m.dueDate)}`;
    case 'capa.status_changed': return `Status changed from ${status(m.from)} to ${status(m.to)}`;
    case 'capa.reopened': return withReason('Action reopened', m.notes);
    case 'capa.verified_closed': return 'Verified effective and closed';
    case 'capa.verification_failed': return withReason('Verification failed, returned to the assignee', m.effectivenessNotes);
    case 'capa.reassigned': return `Reassigned from ${who(m.from)} to ${who(m.to)}`;
    case 'capa.due_date_changed': return withReason(`Due date moved from ${date(m.from)} to ${date(m.to)}`, m.reason);
    case 'capa.escalated':
      return `Escalated to level ${Number(m.level)} (${who(m.toUserId)}), ${m.trigger === 'AUTOMATIC' ? `automatically, ${Number(m.daysOverdue ?? 0)} days overdue` : 'manually'}`;

    // Module 4: risk assessments
    case 'risk.created': return 'Assessment created';
    case 'risk.updated': return `Details updated (${Array.isArray(m.changed) ? m.changed.join(', ') : 'fields'})`;
    case 'risk.hazard_saved': return `${m.created ? 'Hazard added' : 'Hazard updated'}: ${str(m.hazard) ?? ''}`;
    case 'risk.hazard_removed': return `Hazard removed: ${str(m.hazard) ?? ''}`;
    case 'risk.submitted': return 'Submitted for review';
    case 'risk.approved': return withReason(`Approved, next review ${date(m.nextReviewDate)}`, m.comments);
    case 'risk.returned': return withReason('Returned to the assessor', m.comments);
    case 'risk.revised': return `Version ${Number(m.version)} created from version ${Number(m.fromVersion)}`;
    case 'risk.archived': return withReason('Archived', m.reason);

    // Module 5: audits and inspections
    case 'checklist.created': return `Checklist created with ${Number(m.questions)} questions`;
    case 'inspection.scheduled': return `Inspection scheduled for ${date(m.scheduledDate)}, assigned to ${who(m.inspectorId)}`;
    case 'inspection.started': return 'Inspection started';
    case 'inspection.completed':
      return `Inspection completed, ${m.score == null ? 'no scorable questions' : `score ${Number(m.score).toFixed(1)}%`}`;
    case 'inspection.cancelled': return withReason('Inspection cancelled', m.reason);
    case 'ncr.raised':
      return `${str(m.referenceNo) ?? 'NCR'} raised (${(str(m.severity) ?? '').toLowerCase()})${str(m.capaRef) ? `, action ${str(m.capaRef)}` : ', action needed'}`;
    case 'ncr.action_issued': return `Action ${str(m.capaRef) ?? ''} ${m.linked ? 'linked to' : 'issued for'} ${str(m.referenceNo) ?? 'NCR'}`;
    case 'ncr.closed': return `${str(m.referenceNo) ?? 'NCR'} closed on the spot`;
    case 'ncr.status_synced':
      return m.event === 'CLOSED' ? `${str(m.referenceNo)} closed with action ${str(m.capaRef)}`
        : m.event === 'REOPENED' ? `${str(m.referenceNo)} reopened with action ${str(m.capaRef)}`
        : `${str(m.referenceNo)} is open again because action ${str(m.capaRef)} was cancelled`;
    default: return action;
  }
}
