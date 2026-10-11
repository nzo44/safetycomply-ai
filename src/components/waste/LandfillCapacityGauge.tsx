import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fmtDayInZone, fmtTons } from '@/lib/utils';
import {
  CRITICAL_DAYS_TO_FULL, LANDFILL_CRITICAL_PCT, LANDFILL_WARN_PCT, PROJECTION_MIN_HISTORY_DAYS,
  type UtilizationLevel,
} from '@/lib/waste/capacity';
import type { WasteAnalytics } from '@/types/waste';

const COLOR: Record<UtilizationLevel, string> = { OK: '#1E7B4F', WARNING: '#C98A00', CRITICAL: '#B3261E' };
const LABEL: Record<UtilizationLevel, string> = {
  OK: 'Within safe range', WARNING: 'Approaching capacity', CRITICAL: 'Critical',
};
const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;

export interface LandfillCapacityGaugeProps {
  landfill: WasteAnalytics['landfill'];
  timeZone: string;
  /** Slot for the setup / adjust control, so this component stays presentational. */
  footer?: React.ReactNode;
  /** Shown instead of the setup hint when the viewer cannot configure capacity. */
  emptyHint?: string;
}

export function LandfillCapacityGauge({ landfill, timeZone, footer, emptyHint }: LandfillCapacityGaugeProps) {
  if (!landfill) {
    return (
      <section aria-labelledby="landfill-title" className="space-y-3 rounded border border-line bg-white p-6">
        <h2 id="landfill-title" className="font-display text-lg font-semibold">Landfill capacity</h2>
        <p className="text-sm text-steel">{emptyHint ?? 'Landfill capacity has not been set up for this site.'}</p>
        {footer}
      </section>
    );
  }

  const { utilizationPct: pct, level } = landfill;
  const shown = Math.min(100, Math.max(0, pct));
  const color = COLOR[level];
  const nearFull = landfill.daysToFull !== null && landfill.daysToFull <= CRITICAL_DAYS_TO_FULL;

  const reasons: string[] = [];
  if (pct > 100) reasons.push('Over capacity');
  else if (pct > LANDFILL_CRITICAL_PCT) reasons.push(`More than ${LANDFILL_CRITICAL_PCT}% of capacity is used`);
  else if (pct >= LANDFILL_WARN_PCT) reasons.push(`${LANDFILL_WARN_PCT}% or more of capacity is used`);
  if (nearFull) reasons.push(`Projected to fill within ${CRITICAL_DAYS_TO_FULL} days`);

  const Icon = level === 'OK' ? CheckCircle2 : AlertTriangle;

  return (
    <section aria-labelledby="landfill-title" className="space-y-4 rounded border border-line bg-white p-6">
      <h2 id="landfill-title" className="font-display text-lg font-semibold">Landfill capacity</h2>

      <div className="flex items-center gap-5">
        <div
          role="meter"
          aria-label="Landfill capacity used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(shown)}
          aria-valuetext={`${pct.toFixed(1)}% used. ${LABEL[level]}`}
          className="shrink-0"
        >
          <svg viewBox="0 0 120 120" className="h-36 w-36" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="#D3D9DC" strokeWidth="12" />
            <circle
              cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="12"
              strokeDasharray={`${(shown / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              transform="rotate(-90 60 60)"
            />
            {[LANDFILL_WARN_PCT, LANDFILL_CRITICAL_PCT].map((p) => (
              <line key={p} x1="60" y1="0" x2="60" y2="16" stroke="#14202B" strokeWidth="1.5"
                transform={`rotate(${p * 3.6} 60 60)`} />
            ))}
            <text x="60" y="63" textAnchor="middle" className="fill-ink font-display" style={{ fontSize: 28, fontWeight: 600 }}>
              {pct.toFixed(0)}%
            </text>
            <text x="60" y="80" textAnchor="middle" className="fill-steel" style={{ fontSize: 10 }}>used</text>
          </svg>
        </div>

        <div className="min-w-0 space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
            <Icon size={16} aria-hidden /> {LABEL[level]}
          </p>
          {level !== 'OK' && (
            <ul className="space-y-0.5 text-xs text-ink">
              {reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
          <p className="text-xs text-steel">Ticks mark {LANDFILL_WARN_PCT}% and {LANDFILL_CRITICAL_PCT}%.</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div><dt className="text-steel">Used</dt><dd className="font-medium">{fmtTons(landfill.currentTons)} of {fmtTons(landfill.totalTons)} t</dd></div>
        <div><dt className="text-steel">Remaining</dt><dd className="font-medium">{fmtTons(landfill.remainingTons)} t</dd></div>
        <div>
          <dt className="text-steel">Average intake</dt>
          <dd className="font-medium">{landfill.avgDailyIntakeTons !== null ? `${fmtTons(landfill.avgDailyIntakeTons)} t a day` : '—'}</dd>
        </div>
        <div>
          <dt className="text-steel">Projected full</dt>
          <dd className="font-medium">
            {landfill.projectedFillDate
              ? fmtDayInZone(landfill.projectedFillDate, timeZone)
              : <span className="font-normal text-steel">Needs {PROJECTION_MIN_HISTORY_DAYS} days of landfill intake</span>}
          </dd>
        </div>
      </dl>

      {footer}
    </section>
  );
}
