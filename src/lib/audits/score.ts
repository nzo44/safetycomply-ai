import type { InspectionResult } from '@prisma/client';

export const SCORE_GOOD = 85; // green at or above
export const SCORE_FAIR = 70; // yellow at or above, red below
export type ScoreLevel = 'GOOD' | 'FAIR' | 'POOR';

export const scoreLevel = (pct: number): ScoreLevel => (pct >= SCORE_GOOD ? 'GOOD' : pct >= SCORE_FAIR ? 'FAIR' : 'POOR');

/** Passes over passes plus fails, weighted. N/A and unanswered items are excluded. */
export function computeScore(items: { weight: number; result: InspectionResult | null }[]) {
  let earned = 0, possible = 0, answered = 0, compliant = 0, nonCompliant = 0, notApplicable = 0;
  for (const i of items) {
    if (!i.result) continue;
    answered++;
    if (i.result === 'NOT_APPLICABLE') { notApplicable++; continue; }
    possible += i.weight;
    if (i.result === 'COMPLIANT') { earned += i.weight; compliant++; } else nonCompliant++;
  }
  return {
    pct: possible > 0 ? Math.round((earned / possible) * 10_000) / 100 : null,
    earned, possible, answered, compliant, nonCompliant, notApplicable,
  };
}
