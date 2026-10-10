import type { CapaStatus, Incident, Priority, Role } from '@prisma/client';
import { DAY_MS } from '@/lib/utils';

export const ACTIVE_CAPA_STATUSES: CapaStatus[] = ['OPEN', 'IN_PROGRESS'];
export const OPEN_CAPA_STATUSES: CapaStatus[] = ['OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION'];
export const MAX_ESCALATION_LEVEL = 3;

export const CAPA_STATUS_LABEL: Record<CapaStatus, string> = {
  OPEN: 'open', IN_PROGRESS: 'in progress', PENDING_VERIFICATION: 'pending verification',
  CLOSED: 'closed', CANCELLED: 'cancelled',
};

/**
 * Moves available through `transitionCapa`. Closing is NOT here: it only happens
 * through `verifyCapa`, so no one can close their own work.
 */
export const CAPA_TRANSITIONS: Record<CapaStatus, CapaStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_VERIFICATION', 'CANCELLED'],
  PENDING_VERIFICATION: ['IN_PROGRESS'], // assignee withdraws submission
  CLOSED: ['IN_PROGRESS'],               // manager reopen, reason required
  CANCELLED: [],
};

/** Incidents that need an approved RCA before they can be closed. */
export const requiresRca = (
  i: Pick<Incident, 'severity' | 'injuredCount' | 'fatalityCount' | 'isReportableToAuthority'>,
) => i.severity !== 'MINOR' || i.injuredCount > 0 || i.fatalityCount > 0 || i.isReportableToAuthority;

/** A CAPA is due through the end of its due date (UTC), then overdue. */
export const capaDueEnd = (due: Date) => new Date(due.getTime() + DAY_MS);

export const isCapaOverdue = (c: { status: CapaStatus; dueDate: Date }, now = new Date()) =>
  ACTIVE_CAPA_STATUSES.includes(c.status) && now.getTime() >= capaDueEnd(c.dueDate).getTime();

/** 0 = first day overdue. */
export const daysOverdue = (due: Date, now = new Date()) =>
  Math.max(0, Math.floor((now.getTime() - capaDueEnd(due).getTime()) / DAY_MS));

export interface EscalationStep { level: number; afterDaysOverdue: number; escalateToRole: Role }

/** Used when a site has no EscalationRule rows for a priority. */
export const DEFAULT_ESCALATION: Record<Priority, EscalationStep[]> = {
  CRITICAL: [
    { level: 1, afterDaysOverdue: 0, escalateToRole: 'HSE_MANAGER' },
    { level: 2, afterDaysOverdue: 3, escalateToRole: 'ADMIN' },
  ],
  HIGH: [
    { level: 1, afterDaysOverdue: 1, escalateToRole: 'HSE_MANAGER' },
    { level: 2, afterDaysOverdue: 7, escalateToRole: 'ADMIN' },
  ],
  MEDIUM: [
    { level: 1, afterDaysOverdue: 3, escalateToRole: 'HSE_MANAGER' },
    { level: 2, afterDaysOverdue: 14, escalateToRole: 'ADMIN' },
  ],
  LOW: [
    { level: 1, afterDaysOverdue: 7, escalateToRole: 'HSE_MANAGER' },
    { level: 2, afterDaysOverdue: 30, escalateToRole: 'ADMIN' },
  ],
};
