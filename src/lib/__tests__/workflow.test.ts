import { describe, expect, it } from 'vitest';
import { DEFAULT_ESCALATION, daysOverdue, isCapaOverdue, requiresRca } from '@/lib/incidents/workflow';
import { DAY_MS } from '@/lib/utils';

const due = new Date('2026-10-10T00:00:00Z'); // due through the end of 10 Oct (UTC)

describe('CAPA overdue', () => {
  it('is not overdue during the due date', () => {
    expect(isCapaOverdue({ status: 'OPEN', dueDate: due }, new Date(due.getTime() + DAY_MS - 1))).toBe(false);
  });
  it('is overdue from the first instant after the due date', () => {
    expect(isCapaOverdue({ status: 'OPEN', dueDate: due }, new Date(due.getTime() + DAY_MS))).toBe(true);
    expect(isCapaOverdue({ status: 'IN_PROGRESS', dueDate: due }, new Date('2026-12-01'))).toBe(true);
  });
  it('is never overdue once submitted, closed or cancelled', () => {
    const late = new Date('2027-01-01');
    for (const status of ['PENDING_VERIFICATION', 'CLOSED', 'CANCELLED'] as const) {
      expect(isCapaOverdue({ status, dueDate: due }, late), status).toBe(false);
    }
  });
  it('counts days overdue from zero and never goes negative', () => {
    expect(daysOverdue(due, new Date(due.getTime() + DAY_MS))).toBe(0);
    expect(daysOverdue(due, new Date(due.getTime() + 4 * DAY_MS))).toBe(3);
    expect(daysOverdue(due, new Date(due.getTime() - 5 * DAY_MS))).toBe(0);
  });
});

describe('default escalation ladder', () => {
  it('has rising levels and delays for every priority, ending at an admin', () => {
    for (const [priority, steps] of Object.entries(DEFAULT_ESCALATION)) {
      expect(steps.length, priority).toBeGreaterThan(0);
      steps.forEach((s, i) => {
        expect(s.level, priority).toBe(i + 1);
        if (i > 0) expect(s.afterDaysOverdue, priority).toBeGreaterThan(steps[i - 1].afterDaysOverdue);
      });
      expect(steps[steps.length - 1].escalateToRole, priority).toBe('ADMIN');
    }
  });
  it('escalates critical work sooner than low-priority work', () => {
    expect(DEFAULT_ESCALATION.CRITICAL[0].afterDaysOverdue).toBeLessThan(DEFAULT_ESCALATION.LOW[0].afterDaysOverdue);
  });
});

describe('requiresRca', () => {
  const minor = { severity: 'MINOR', injuredCount: 0, fatalityCount: 0, isReportableToAuthority: false } as const;
  it('skips the RCA only for minor, harmless, non-reportable incidents', () => {
    expect(requiresRca(minor)).toBe(false);
  });
  it('requires it for any injury, fatality, authority report or higher severity', () => {
    expect(requiresRca({ ...minor, injuredCount: 1 })).toBe(true);
    expect(requiresRca({ ...minor, fatalityCount: 1 })).toBe(true);
    expect(requiresRca({ ...minor, isReportableToAuthority: true })).toBe(true);
    expect(requiresRca({ ...minor, severity: 'MAJOR' })).toBe(true);
  });
});
