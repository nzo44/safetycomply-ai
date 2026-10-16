import { describe, expect, it } from 'vitest';
import { levelOf, maxLevel, RATINGS, scoreOf } from '@/lib/risk/matrix';

describe('5x5 risk matrix', () => {
  it('maps scores to the documented bands', () => {
    const cases: [number, string][] = [[1, 'LOW'], [4, 'LOW'], [5, 'MEDIUM'], [9, 'MEDIUM'], [10, 'HIGH'], [16, 'HIGH'], [20, 'EXTREME'], [25, 'EXTREME']];
    for (const [score, level] of cases) expect(levelOf(score), String(score)).toBe(level);
  });
  it('gives every likelihood x severity combination a level, rising with the score', () => {
    const rank = { LOW: 0, MEDIUM: 1, HIGH: 2, EXTREME: 3 } as const;
    const scores = new Set<number>();
    for (const l of RATINGS) for (const s of RATINGS) scores.add(scoreOf(l, s));
    const sorted = [...scores].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(rank[levelOf(sorted[i])]).toBeGreaterThanOrEqual(rank[levelOf(sorted[i - 1])]);
  });
  it('finds the highest level, ignoring blanks', () => {
    expect(maxLevel(['LOW', 'HIGH', 'MEDIUM'])).toBe('HIGH');
    expect(maxLevel([null, undefined, 'LOW'])).toBe('LOW');
    expect(maxLevel([])).toBeNull();
  });
});
