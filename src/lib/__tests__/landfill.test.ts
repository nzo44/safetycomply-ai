import { describe, expect, it } from 'vitest';
import { netKg, projectFillDate, utilizationLevel, utilizationPct } from '@/lib/waste/capacity';
import { DAY_MS } from '@/lib/utils';

const now = new Date('2026-10-16T00:00:00Z');
const ago = (d: number) => new Date(now.getTime() - d * DAY_MS);

describe('landfill utilisation', () => {
  it('computes a percentage and survives a zero capacity', () => {
    expect(utilizationPct(50, 200)).toBe(25);
    expect(utilizationPct(10, 0)).toBe(0);
  });
  it('is green under 70, yellow from 70 to 85, red above 85', () => {
    expect(utilizationLevel(69.9)).toBe('OK');
    expect(utilizationLevel(70)).toBe('WARNING');
    expect(utilizationLevel(85)).toBe('WARNING');
    expect(utilizationLevel(85.1)).toBe('CRITICAL');
  });
  it('goes red when full is projected within 30 days, whatever the percentage', () => {
    expect(utilizationLevel(10, 30)).toBe('CRITICAL');
    expect(utilizationLevel(10, 31)).toBe('OK');
  });
});

describe('fill-date projection', () => {
  const base = { totalTons: 1000, currentTons: 400, now };
  it('projects linearly from recent intake', () => {
    const d = projectFillDate({ ...base, intakeTons: 90, firstIntakeAt: ago(90) });
    // 600 t left at 1 t/day
    expect(Math.round((d!.getTime() - now.getTime()) / DAY_MS)).toBe(600);
  });
  it('returns null with under 14 days of history, no intake, or no tickets', () => {
    expect(projectFillDate({ ...base, intakeTons: 5, firstIntakeAt: ago(13) })).toBeNull();
    expect(projectFillDate({ ...base, intakeTons: 0, firstIntakeAt: ago(60) })).toBeNull();
    expect(projectFillDate({ ...base, intakeTons: 5, firstIntakeAt: null })).toBeNull();
  });
  it('says "now" when already full, and null for absurdly distant dates', () => {
    expect(projectFillDate({ ...base, currentTons: 1000, intakeTons: 1, firstIntakeAt: null })).toEqual(now);
    expect(projectFillDate({ ...base, intakeTons: 0.001, firstIntakeAt: ago(90) })).toBeNull();
  });
});

describe('weighbridge net weight', () => {
  it('subtracts tare and rounds to grams', () => {
    expect(netKg(12000.5, 4000.25)).toBe(8000.25);
    expect(netKg(0.3, 0.1)).toBe(0.2);
  });
});
