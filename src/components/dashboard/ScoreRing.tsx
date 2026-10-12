import { scoreLevel, SCORE_FAIR, SCORE_GOOD, type ScoreLevel } from '@/lib/audits/score';

const COLOR: Record<ScoreLevel, string> = { GOOD: '#34d399', FAIR: '#fbbf24', POOR: '#fb7185' }; // emerald / amber / rose
const WORD: Record<ScoreLevel, string> = { GOOD: 'Healthy', FAIR: 'Needs attention', POOR: 'Critical' };
const R = 52;
const C = 2 * Math.PI * R;

export interface ScoreRingProps {
  /** 0 to 100, or null when nothing has been assessed yet. */
  score: number | null;
  /** Accessible description of what the score measures. */
  label: string;
  /** Show the score with one decimal (audit scores) instead of a whole number. */
  decimals?: 0 | 1;
}

/** Dark-surface variant of the score ring. Green at 85 or more, amber from 70, rose below. */
export function ScoreRing({ score, label, decimals = 0 }: ScoreRingProps) {
  const level = score === null ? null : scoreLevel(score);
  const color = level ? COLOR[level] : '#475569';
  const shown = score === null ? 0 : Math.min(100, Math.max(0, score));
  const text = score === null ? `${label}: no data yet` : `${label}: ${score.toFixed(decimals)}%, ${WORD[level!].toLowerCase()}`;

  return (
    <div className="shrink-0 text-center">
      <svg viewBox="0 0 120 120" className="h-28 w-28" role="img" aria-label={text}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * C} ${C}`} transform="rotate(-90 60 60)"
        />
        <text x="60" y="64" textAnchor="middle" fill="#f1f5f9" className="font-display" style={{ fontSize: 28, fontWeight: 600 }}>
          {score === null ? '—' : score.toFixed(decimals)}
        </text>
        {score !== null && <text x="60" y="82" textAnchor="middle" fill="#94a3b8" style={{ fontSize: 10 }}>percent</text>}
      </svg>
      <p className="mt-1 text-xs font-medium" style={{ color }}>{level ? WORD[level] : 'Not assessed'}</p>
      <p className="sr-only">Healthy from {SCORE_GOOD} percent, critical below {SCORE_FAIR} percent.</p>
    </div>
  );
}
