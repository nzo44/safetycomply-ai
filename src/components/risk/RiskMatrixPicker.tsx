'use client';

import { LEVEL_META, LIKELIHOOD_LABEL, RATINGS, SEVERITY_HINT, SEVERITY_LABEL, levelOf, scoreOf } from '@/lib/risk/matrix';

export interface RiskMatrixPickerProps {
  /** Form field prefix: produces `${name}Likelihood` and `${name}Severity`. */
  name: 'initial' | 'residual';
  legend: string;
  likelihood: number | null;
  severity: number | null;
  onChange: (likelihood: number | null, severity: number | null) => void;
  error?: string;
  /** Lets the user clear the rating (the residual rating is optional until approval). */
  clearable?: boolean;
}

export function RiskMatrixPicker({ name, legend, likelihood, severity, onChange, error, clearable }: RiskMatrixPickerProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <input type="hidden" name={`${name}Likelihood`} value={likelihood ?? ''} />
      <input type="hidden" name={`${name}Severity`} value={severity ?? ''} />

      <div className="grid grid-cols-[4.5rem_repeat(5,minmax(0,1fr))] gap-1 text-center">
        <span aria-hidden />
        {RATINGS.map((s) => (
          <span key={s} className="px-0.5 text-[10px] font-medium leading-tight text-steel" title={SEVERITY_HINT[s]}>
            {s}<br />{SEVERITY_LABEL[s]}
          </span>
        ))}
        {[...RATINGS].reverse().map((l) => (
          <div key={l} className="contents">
            <span className="self-center pr-1 text-right text-[10px] font-medium leading-tight text-steel">{l} {LIKELIHOOD_LABEL[l]}</span>
            {RATINGS.map((s) => {
              const score = scoreOf(l, s);
              const meta = LEVEL_META[levelOf(score)];
              const selected = likelihood === l && severity === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Likelihood ${l} ${LIKELIHOOD_LABEL[l]}, severity ${s} ${SEVERITY_LABEL[s]}: score ${score}, ${meta.label}`}
                  onClick={() => onChange(l, s)}
                  className={`h-10 rounded border text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-plant ${
                    selected ? 'ring-2 ring-ink ring-offset-1' : 'hover:brightness-95'
                  }`}
                  style={{ backgroundColor: meta.bg, borderColor: meta.border, color: meta.text }}
                >
                  {score} {meta.letter}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs" aria-live="polite">
        {likelihood && severity ? (
          <p>
            Likelihood <span className="font-semibold">{LIKELIHOOD_LABEL[likelihood]}</span>, severity{' '}
            <span className="font-semibold">{SEVERITY_LABEL[severity]}</span>: score{' '}
            <span className="font-semibold">{scoreOf(likelihood, severity)}</span>, {LEVEL_META[levelOf(scoreOf(likelihood, severity))].label}
          </p>
        ) : <p className="text-steel">Choose the cell that matches likelihood and severity.</p>}
        {clearable && likelihood && (
          <button type="button" onClick={() => onChange(null, null)} className="text-steel underline hover:text-ink">Clear</button>
        )}
      </div>
      {error && <p role="alert" className="text-xs font-medium text-noncompliant">{error}</p>}
    </fieldset>
  );
}
