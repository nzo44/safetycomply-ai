import type { RiskLevel } from '@prisma/client';

export const RATINGS = [1, 2, 3, 4, 5] as const;

export const LIKELIHOOD_LABEL: Record<number, string> = {
  1: 'Rare', 2: 'Unlikely', 3: 'Possible', 4: 'Likely', 5: 'Almost certain',
};
export const SEVERITY_LABEL: Record<number, string> = {
  1: 'Negligible', 2: 'Minor', 3: 'Moderate', 4: 'Major', 5: 'Catastrophic',
};
export const SEVERITY_HINT: Record<number, string> = {
  1: 'First aid at most', 2: 'Medical treatment', 3: 'Lost-time injury or contained release',
  4: 'Permanent disability or off-site impact', 5: 'Fatality or major environmental harm',
};

export const scoreOf = (likelihood: number, severity: number) => likelihood * severity;

/** 1 to 4 low, 5 to 9 medium, 10 to 16 high, 20 to 25 extreme (the only products a 5x5 can make). */
export function levelOf(score: number): RiskLevel {
  if (score >= 20) return 'EXTREME';
  if (score >= 10) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

export const LEVEL_ORDER: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];
export const levelRank = (l: RiskLevel) => LEVEL_ORDER.indexOf(l);

export function maxLevel(levels: (RiskLevel | null | undefined)[]): RiskLevel | null {
  let best: RiskLevel | null = null;
  for (const l of levels) if (l && (best === null || levelRank(l) > levelRank(best))) best = l;
  return best;
}

export const LEVEL_META: Record<RiskLevel, { label: string; letter: string; range: string; bg: string; border: string; text: string }> = {
  LOW:     { label: 'Low',     letter: 'L', range: '1 to 4',   bg: '#DDEFE5', border: '#1E7B4F', text: '#14532D' },
  MEDIUM:  { label: 'Medium',  letter: 'M', range: '5 to 9',   bg: '#FBEFC8', border: '#C98A00', text: '#6B4A00' },
  HIGH:    { label: 'High',    letter: 'H', range: '10 to 16', bg: '#FAD9C3', border: '#D9631E', text: '#7A3200' },
  EXTREME: { label: 'Extreme', letter: 'E', range: '20 to 25', bg: '#B3261E', border: '#B3261E', text: '#FFFFFF' },
};
