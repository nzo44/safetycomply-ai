import { DAY_MS } from '@/lib/utils';

export const LANDFILL_WARN_PCT = 70;       // yellow from here
export const LANDFILL_CRITICAL_PCT = 85;   // red above this
export const CRITICAL_DAYS_TO_FULL = 30;   // red when the projected fill date is this close
export const PROJECTION_WINDOW_DAYS = 90;
export const PROJECTION_MIN_HISTORY_DAYS = 14;
export const MAX_PROJECTION_YEARS = 50;

export type UtilizationLevel = 'OK' | 'WARNING' | 'CRITICAL';

export const utilizationPct = (currentTons: number, totalTons: number) =>
  totalTons > 0 ? (currentTons / totalTons) * 100 : 0;

/** Green below 70%, yellow 70 to 85%, red above 85% or when full is projected within 30 days. */
export const utilizationLevel = (pct: number, daysToFull: number | null = null): UtilizationLevel =>
  pct > LANDFILL_CRITICAL_PCT || (daysToFull !== null && daysToFull <= CRITICAL_DAYS_TO_FULL)
    ? 'CRITICAL'
    : pct >= LANDFILL_WARN_PCT ? 'WARNING' : 'OK';

export const daysUntil = (date: Date, now = new Date()) =>
  Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));

/** Live preview for the weighbridge form (the server recomputes with Decimal). */
export const netKg = (grossKg: number, tareKg: number) => Math.round((grossKg - tareKg) * 1000) / 1000;

/**
 * Linear projection from the trailing 90-day landfill intake.
 * Returns null when there is not enough history (under 14 days) or no intake.
 */
export function projectFillDate(i: {
  totalTons: number;
  currentTons: number;
  intakeTons: number;          // landfilled in the window
  firstIntakeAt: Date | null;  // earliest landfill ticket inside the window
  now: Date;
}): Date | null {
  const remaining = i.totalTons - i.currentTons;
  if (remaining <= 0) return i.now; // already full
  if (!i.firstIntakeAt) return null;

  const spanDays = Math.min(PROJECTION_WINDOW_DAYS, (i.now.getTime() - i.firstIntakeAt.getTime()) / DAY_MS);
  if (spanDays < PROJECTION_MIN_HISTORY_DAYS || i.intakeTons <= 0) return null;

  const daysLeft = remaining / (i.intakeTons / spanDays);
  if (!Number.isFinite(daysLeft) || daysLeft > MAX_PROJECTION_YEARS * 365) return null;
  return new Date(i.now.getTime() + daysLeft * DAY_MS);
}
