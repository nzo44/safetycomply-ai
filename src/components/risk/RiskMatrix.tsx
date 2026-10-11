import { LEVEL_META, LEVEL_ORDER, LIKELIHOOD_LABEL, RATINGS, SEVERITY_LABEL, levelOf, scoreOf } from '@/lib/risk/matrix';

export interface RiskMatrixMarker {
  n: number;                       // hazard number, matches the register order
  likelihood: number;
  severity: number;
  kind: 'initial' | 'residual';
}

export function RiskMatrix({ markers = [], caption = 'Risk matrix' }: { markers?: RiskMatrixMarker[]; caption?: string }) {
  const at = (l: number, s: number, kind: RiskMatrixMarker['kind']) =>
    markers.filter((m) => m.likelihood === l && m.severity === s && m.kind === kind);

  return (
    <figure className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] table-fixed border-separate border-spacing-1 text-center">
          <caption className="sr-only">{caption}. Likelihood runs from rare at the bottom to almost certain at the top. Severity runs from negligible on the left to catastrophic on the right.</caption>
          <thead>
            <tr>
              <th className="w-20 text-[11px] font-medium text-steel"><span className="sr-only">Likelihood and severity</span></th>
              {RATINGS.map((s) => (
                <th key={s} scope="col" className="px-0.5 pb-1 text-[11px] font-medium leading-tight text-steel">
                  {s}<br />{SEVERITY_LABEL[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...RATINGS].reverse().map((l) => (
              <tr key={l}>
                <th scope="row" className="pr-1 text-right text-[11px] font-medium leading-tight text-steel">
                  {l} {LIKELIHOOD_LABEL[l]}
                </th>
                {RATINGS.map((s) => {
                  const score = scoreOf(l, s);
                  const level = levelOf(score);
                  const m = LEVEL_META[level];
                  const here = [...at(l, s, 'initial'), ...at(l, s, 'residual')];
                  const label = `Likelihood ${l}, severity ${s}, score ${score}, ${m.label}.${
                    here.length ? ` ${here.map((x) => `Hazard ${x.n} ${x.kind}`).join(', ')}.` : ''
                  }`;
                  return (
                    <td key={s} aria-label={label} className="h-14 rounded border align-top"
                      style={{ backgroundColor: m.bg, borderColor: m.border, color: m.text }}>
                      <span className="block px-1 text-left text-[10px] font-semibold leading-4 opacity-80">{score} {m.letter}</span>
                      <span className="flex flex-wrap justify-center gap-0.5 pb-0.5">
                        {here.map((x) => (
                          <span key={`${x.kind}-${x.n}`}
                            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${
                              x.kind === 'initial' ? 'bg-ink text-white' : 'border-2 border-ink bg-white text-ink'
                            }`}>
                            {x.n}
                          </span>
                        ))}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">1</span> Initial risk
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-ink bg-white text-[10px] font-bold text-ink">1</span> Residual risk
        </span>
        {LEVEL_ORDER.map((lv) => (
          <span key={lv} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-sm border" style={{ backgroundColor: LEVEL_META[lv].bg, borderColor: LEVEL_META[lv].border }} />
            {LEVEL_META[lv].label} {LEVEL_META[lv].range}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
