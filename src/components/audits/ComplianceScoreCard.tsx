import { SCORE_FAIR, SCORE_GOOD, scoreLevel, type ScoreLevel } from '@/lib/audits/score';

const COLOR: Record<ScoreLevel, string> = { GOOD: '#1E7B4F', FAIR: '#C98A00', POOR: '#B3261E' };
const LABEL: Record<ScoreLevel, string> = { GOOD: 'Good', FAIR: 'Needs attention', POOR: 'Poor' };
const SIZE = { sm: 'h-12 w-12', md: 'h-24 w-24', lg: 'h-36 w-36' } as const;
const R = 52;
const C = 2 * Math.PI * R;

export interface ComplianceScoreCardProps {
  score: number | null;
  size?: keyof typeof SIZE;
  /** Show the rating word and thresholds beside the ring. */
  showLabel?: boolean;
}

export function ComplianceScoreCard({ score, size = 'md', showLabel = false }: ComplianceScoreCardProps) {
  const level = score === null ? null : scoreLevel(score);
  const color = level ? COLOR[level] : '#9AA5B1';
  const shown = score === null ? 0 : Math.min(100, Math.max(0, score));
  const text = score === null ? 'No score' : `${score.toFixed(1)}% compliance, ${LABEL[level!].toLowerCase()}`;

  return (
    <div className="inline-flex items-center gap-3">
      <svg viewBox="0 0 120 120" className={`${SIZE[size]} shrink-0`} role="img" aria-label={text}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#D3D9DC" strokeWidth="12" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${(shown / 100) * C} ${C}`} transform="rotate(-90 60 60)" />
        <text x="60" y={size === 'sm' ? 68 : 66} textAnchor="middle" className="fill-ink font-display"
          style={{ fontSize: size === 'sm' ? 34 : 30, fontWeight: 600 }}>
          {score === null ? '—' : score.toFixed(1)}
        </text>
        {size !== 'sm' && score !== null && (
          <text x="60" y="84" textAnchor="middle" className="fill-steel" style={{ fontSize: 11 }}>percent</text>
        )}
      </svg>
      {showLabel && (
        <div className="text-sm">
          <p className="font-semibold" style={{ color }}>{level ? LABEL[level] : 'Not scored'}</p>
          <p className="text-xs text-steel">Good at {SCORE_GOOD}% or more. Poor below {SCORE_FAIR}%.</p>
        </div>
      )}
    </div>
  );
}
