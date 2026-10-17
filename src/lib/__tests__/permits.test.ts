import { describe, expect, it } from 'vitest';
import { displayStatus, isWorkable, transitionError, type PermitStatus } from '@/lib/permits/meta';

const H = 3_600_000;
const now = new Date('2026-10-17T12:00:00Z');
const at = (h: number) => new Date(now.getTime() + h * H);
const permit = (status: PermitStatus, from = -1, to = 7, requestedById = 'req') => ({
  status, validFrom: at(from), validTo: at(to), requestedById,
});
const ctx = (userId = 'mgr', isAdmin = false) => ({ userId, isAdmin, now });

describe('displayStatus', () => {
  it('shows EXPIRED only for approved or in-progress permits past their window', () => {
    expect(displayStatus(permit('APPROVED', -10, -1), now)).toBe('EXPIRED');
    expect(displayStatus(permit('IN_PROGRESS', -10, -1), now)).toBe('EXPIRED');
    expect(displayStatus(permit('APPROVED'), now)).toBe('APPROVED');
    expect(displayStatus(permit('CLOSED', -10, -1), now)).toBe('CLOSED');
    expect(displayStatus(permit('REQUESTED', -10, -1), now)).toBe('REQUESTED');
  });
});

describe('isWorkable', () => {
  it('needs an in-progress permit inside its window', () => {
    expect(isWorkable(permit('IN_PROGRESS'), now)).toBe(true);
    expect(isWorkable(permit('IN_PROGRESS', -10, -1), now)).toBe(false);
    expect(isWorkable(permit('APPROVED'), now)).toBe(false);
  });
});

describe('transitionError', () => {
  it('follows the workflow', () => {
    expect(transitionError(permit('REQUESTED'), 'APPROVED', ctx())).toBeNull();
    expect(transitionError(permit('APPROVED'), 'IN_PROGRESS', ctx())).toBeNull();
    expect(transitionError(permit('IN_PROGRESS'), 'CLOSED', ctx())).toBeNull();
    expect(transitionError(permit('REQUESTED'), 'IN_PROGRESS', ctx())).not.toBeNull();
    expect(transitionError(permit('CLOSED'), 'APPROVED', ctx())).not.toBeNull();
    expect(transitionError(permit('REJECTED'), 'APPROVED', ctx())).not.toBeNull();
  });
  it('stops people deciding on their own request, except admins', () => {
    expect(transitionError(permit('REQUESTED'), 'APPROVED', ctx('req'))).not.toBeNull();
    expect(transitionError(permit('REQUESTED'), 'REJECTED', ctx('req'))).not.toBeNull();
    expect(transitionError(permit('REQUESTED'), 'APPROVED', ctx('req', true))).toBeNull();
    expect(transitionError(permit('REQUESTED'), 'CANCELLED', ctx('req'))).toBeNull();
  });
  it('blocks starting outside the window and approving an ended one', () => {
    expect(transitionError(permit('APPROVED', 2, 9), 'IN_PROGRESS', ctx())).not.toBeNull();
    expect(transitionError(permit('APPROVED', -10, -1), 'IN_PROGRESS', ctx())).not.toBeNull();
    expect(transitionError(permit('REQUESTED', -10, -1), 'APPROVED', ctx())).not.toBeNull();
  });
  it('lets an expired in-progress permit still be closed out', () => {
    expect(transitionError(permit('IN_PROGRESS', -10, -1), 'CLOSED', ctx())).toBeNull();
  });
});
