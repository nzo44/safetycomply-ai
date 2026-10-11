'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AssessmentType } from '@prisma/client';
import { saveHazard } from '@/actions/risk/hazards';
import { Drawer, useCloseDrawer } from '@/components/ui/drawer';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';
import { levelOf, scoreOf } from '@/lib/risk/matrix';
import { CONTROL_LABEL } from '@/lib/risk/workflow';
import { toOptions } from '@/lib/incidents-meta';
import type { Option } from '@/types/common';
import type { HazardView } from '@/types/risk';
import { RiskLevelChip } from './badges';
import { RiskMatrixPicker } from './RiskMatrixPicker';

export interface HazardDrawerProps {
  assessmentId: string;
  type: AssessmentType;
  hazard: HazardView | null; // null = adding
  people: Option[];
}

const WEAK = ['PPE', 'ADMINISTRATIVE'];

function Form({ assessmentId, type, hazard, people, onAnother }: HazardDrawerProps & { onAnother: () => void }) {
  const close = useCloseDrawer();
  const [state, formAction] = useFormState(saveHazard, null);
  const [init, setInit] = useState({ l: hazard?.initialLikelihood ?? null, s: hazard?.initialSeverity ?? null });
  const [res, setRes] = useState({ l: hazard?.residualLikelihood ?? null, s: hazard?.residualSeverity ?? null });
  const [control, setControl] = useState<string>(hazard?.controlHierarchy ?? '');
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="flex items-start gap-2 text-sm font-medium text-compliant">
          <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" /> {state.message}
        </p>
        <div className="flex items-center gap-4">
          {!hazard && (
            <button type="button" onClick={onAnother}
              className="rounded border border-plant px-4 py-2 text-sm font-semibold text-plant hover:bg-plant/5">Add another hazard</button>
          )}
          <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Close</button>
        </div>
      </div>
    );
  }

  const initScore = init.l && init.s ? scoreOf(init.l, init.s) : null;
  const resScore = res.l && res.s ? scoreOf(res.l, res.s) : null;
  const worse = initScore !== null && resScore !== null && resScore > initScore;
  const weakControl = initScore !== null && levelOf(initScore) !== 'LOW' && levelOf(initScore) !== 'MEDIUM' && WEAK.includes(control);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      {hazard && <input type="hidden" name="hazardId" value={hazard.id} />}

      {state && !state.ok && (
        <p role="alert" className="rounded border border-noncompliant/40 bg-noncompliant/5 px-3 py-2 text-sm text-noncompliant">{state.error}</p>
      )}

      {type === 'JSA' && (
        <Field label="Task step" name="taskStep" error={err('taskStep')} hint="The step of the job where this hazard occurs.">
          <input id="taskStep" name="taskStep" defaultValue={hazard?.taskStep ?? ''} className={inputCls} />
        </Field>
      )}

      <Field label="Hazard" name="hazard" error={err('hazard')}>
        <textarea id="hazard" name="hazard" rows={2} required defaultValue={hazard?.hazard} className={inputCls} placeholder="The source of harm, for example: unguarded rotating shaft" />
      </Field>
      <Field label="Consequence" name="consequence" error={err('consequence')}>
        <textarea id="consequence" name="consequence" rows={2} required defaultValue={hazard?.consequence} className={inputCls} placeholder="What could happen" />
      </Field>
      <Field label="Who is at risk" name="whoAtRisk" error={err('whoAtRisk')}>
        <input id="whoAtRisk" name="whoAtRisk" defaultValue={hazard?.whoAtRisk ?? ''} className={inputCls} placeholder="Operators, contractors, visitors" />
      </Field>

      <RiskMatrixPicker name="initial" legend="Initial risk (before controls)" likelihood={init.l} severity={init.s}
        onChange={(l, s) => setInit({ l, s })} error={err('initialLikelihood') ?? err('initialSeverity')} />

      <Field label="Control measures" name="controlMeasures" error={err('controlMeasures')}>
        <textarea id="controlMeasures" name="controlMeasures" rows={3} required defaultValue={hazard?.controlMeasures} className={inputCls} />
      </Field>

      <Field label="Strongest control type used" name="controlHierarchy" error={err('controlHierarchy')}
        hint="From strongest to weakest: elimination, substitution, engineering, administrative, PPE.">
        <select id="controlHierarchy" name="controlHierarchy" required value={control} onChange={(e) => setControl(e.target.value)} className={inputCls}>
          <option value="" disabled>Choose a control type</option>
          {toOptions(CONTROL_LABEL).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      {weakControl && (
        <p role="status" className="flex items-start gap-2 rounded border border-partial/50 bg-partial/5 p-3 text-xs">
          <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
          This risk is high or extreme, but the strongest control is administrative or PPE. Consider elimination, substitution or engineering controls.
        </p>
      )}

      <Field label="Required PPE" name="requiredPpe" error={err('requiredPpe')} hint="One item per line.">
        <textarea id="requiredPpe" name="requiredPpe" rows={2} defaultValue={hazard?.requiredPpe.join('\n') ?? ''} className={inputCls} />
      </Field>

      <RiskMatrixPicker name="residual" legend="Residual risk (after controls)" likelihood={res.l} severity={res.s} clearable
        onChange={(l, s) => setRes({ l, s })} error={err('residualLikelihood') ?? err('residualSeverity')} />
      {worse && (
        <p role="alert" className="text-xs font-medium text-noncompliant">The residual risk cannot be higher than the initial risk.</p>
      )}

      {initScore !== null && (
        <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <RiskLevelChip level={levelOf(initScore)} score={initScore} />
          <span className="text-steel">before controls</span>
          {resScore !== null ? <><RiskLevelChip level={levelOf(resScore)} score={resScore} /><span className="text-steel">after</span></>
            : <span className="text-steel">Residual risk not rated yet (required before approval)</span>}
        </p>
      )}

      <Field label="Responsible person" name="responsibleId" error={err('responsibleId')} hint="Owns keeping these controls in place.">
        <select id="responsibleId" name="responsibleId" defaultValue={hazard?.responsibleId ?? ''} className={inputCls}>
          <option value="">Unassigned</option>
          {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-line bg-white px-5 py-4">
        <SubmitButton>{hazard ? 'Save hazard' : 'Add hazard'}</SubmitButton>
        <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}

export function HazardDrawer(props: HazardDrawerProps) {
  const [run, setRun] = useState(0);
  return (
    <Drawer title={props.hazard ? 'Edit hazard' : 'Add hazard'} subtitle="Rate the risk before and after controls.">
      <Form key={run} {...props} onAnother={() => setRun((r) => r + 1)} />
    </Drawer>
  );
}
