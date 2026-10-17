/**
 * Permit-to-work rules. Pure functions (no database) so they can be unit-tested.
 * "Expired" is never stored. It is derived from the validity window.
 */
export const PERMIT_TYPES = ['HOT_WORK', 'CONFINED_SPACE', 'WORK_AT_HEIGHT', 'ELECTRICAL', 'EXCAVATION', 'OTHER'] as const;
export type PermitType = (typeof PERMIT_TYPES)[number];

export const PERMIT_STATUSES = ['REQUESTED', 'APPROVED', 'IN_PROGRESS', 'CLOSED', 'REJECTED', 'CANCELLED'] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];

/** What the screen shows: the stored status, or EXPIRED when the window has passed without close-out. */
export type PermitDisplayStatus = PermitStatus | 'EXPIRED';

export const PERMIT_TYPE_LABEL: Record<PermitType, string> = {
  HOT_WORK: 'Hot work', CONFINED_SPACE: 'Confined space', WORK_AT_HEIGHT: 'Work at height',
  ELECTRICAL: 'Electrical isolation', EXCAVATION: 'Excavation', OTHER: 'Other',
};

export const PERMIT_STATUS_LABEL: Record<PermitDisplayStatus, string> = {
  REQUESTED: 'Awaiting approval', APPROVED: 'Approved', IN_PROGRESS: 'In progress', CLOSED: 'Closed',
  REJECTED: 'Rejected', CANCELLED: 'Cancelled', EXPIRED: 'Expired',
};

export const isPermitType = (v: unknown): v is PermitType => typeof v === 'string' && (PERMIT_TYPES as readonly string[]).includes(v);
export const isPermitStatus = (v: unknown): v is PermitStatus => typeof v === 'string' && (PERMIT_STATUSES as readonly string[]).includes(v);

export const MAX_PERMIT_HOURS = 7 * 24;

export const PERMIT_TRANSITIONS: Record<PermitStatus, PermitStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['CLOSED'],
  CLOSED: [],
  REJECTED: [],
  CANCELLED: [],
};

type Windowed = { status: PermitStatus; validFrom: Date; validTo: Date };

/** A permit that was approved or started, but whose window has ended and was never closed out. */
export function displayStatus(p: Windowed, now: Date = new Date()): PermitDisplayStatus {
  const live = p.status === 'APPROVED' || p.status === 'IN_PROGRESS';
  return live && p.validTo.getTime() < now.getTime() ? 'EXPIRED' : p.status;
}

/** Is work allowed to be going on right now under this permit? */
export const isWorkable = (p: Windowed, now: Date = new Date()) =>
  p.status === 'IN_PROGRESS' && now.getTime() <= p.validTo.getTime();

/**
 * Returns the reason a move is not allowed, or null when it is.
 * `isOwnRequest` + `isAdmin` enforce that nobody approves their own permit (administrators are exempt).
 */
export function transitionError(
  p: Windowed & { requestedById: string },
  to: PermitStatus,
  ctx: { userId: string; isAdmin: boolean; now?: Date },
): string | null {
  const now = ctx.now ?? new Date();
  if (!PERMIT_TRANSITIONS[p.status].includes(to)) {
    return `A ${PERMIT_STATUS_LABEL[p.status].toLowerCase()} permit cannot move to ${PERMIT_STATUS_LABEL[to].toLowerCase()}.`;
  }
  if ((to === 'APPROVED' || to === 'REJECTED') && p.requestedById === ctx.userId && !ctx.isAdmin) {
    return 'You cannot decide on a permit you requested. Ask another manager.';
  }
  if (to === 'APPROVED' && p.validTo.getTime() <= now.getTime()) {
    return 'The validity window has already ended. Cancel this permit and request a new one.';
  }
  if (to === 'IN_PROGRESS') {
    if (now.getTime() < p.validFrom.getTime()) return 'Work cannot start before the permit is valid.';
    if (now.getTime() > p.validTo.getTime()) return 'This permit has expired. Cancel it and request a new one.';
  }
  return null;
}
