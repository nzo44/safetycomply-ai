import type { AuditStandard, InspectionResult, InspectionStatus, NcrSeverity, NcrStatus, Priority } from '@prisma/client';
import { DAY_MS } from '@/lib/utils';

export const STANDARD_LABEL: Record<AuditStandard, string> = {
  ISO_14001: 'ISO 14001', ISO_45001: 'ISO 45001', LOCAL_REGULATORY: 'Local regulatory', INTERNAL_HSE: 'Internal HSE',
};
export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  SCHEDULED: 'Scheduled', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
/** Filter choices: the stored statuses plus the derived "Overdue". */
export const INSPECTION_FILTER_LABEL = { ...INSPECTION_STATUS_LABEL, OVERDUE: 'Overdue' } as const;

export const RESULT_LABEL: Record<InspectionResult, string> = { COMPLIANT: 'Pass', NON_COMPLIANT: 'Fail', NOT_APPLICABLE: 'N/A' };
export const NCR_SEVERITY_LABEL: Record<NcrSeverity, string> = { MINOR: 'Minor', MAJOR: 'Major', CRITICAL: 'Critical' };
export const NCR_STATUS_LABEL: Record<NcrStatus, string> = { OPEN: 'Open', CAPA_ISSUED: 'Action issued', CLOSED: 'Closed' };

/** NCR severity decides the priority (and so the suggested due date) of the action it spawns. */
export const NCR_PRIORITY: Record<NcrSeverity, Priority> = { MINOR: 'LOW', MAJOR: 'HIGH', CRITICAL: 'CRITICAL' };

export const WORKABLE_STATUSES: InspectionStatus[] = ['SCHEDULED', 'IN_PROGRESS'];

/** Same rule as CAPAs: late from the day after the scheduled date. */
export const isInspectionOverdue = (i: { status: InspectionStatus; scheduledDate: Date }, now = new Date()) =>
  WORKABLE_STATUSES.includes(i.status) && i.scheduledDate.getTime() <= now.getTime() - DAY_MS;
