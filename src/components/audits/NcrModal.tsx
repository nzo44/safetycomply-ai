'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import type { CapaType, NcrSeverity } from '@prisma/client';
import { CheckCircle2 } from 'lucide-react';
import { triggerNcrFromFinding } from '@/actions/audits/ncr';
import { Drawer, useCloseDrawer } from '@/components/ui/drawer';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';
import { NCR_PRIORITY, NCR_SEVERITY_LABEL } from '@/lib/audits/meta';
import { CAPA_DUE_DAYS } from '@/lib/compliance-meta';
import { CAPA_TYPE_LABEL, toOptions } from '@/lib/incidents-meta';
import { todayInput } from '@/lib/utils';
import type { NcrTarget } from '@/types/audits';
import type { Option } from '@/types/common';

export interface NcrModalProps {
  target: NcrTarget;
  people: Option[];
  linkable: Option[];
  canIssueCapa: boolean;
}

type Mode = 'none' | 'create' | 'link';

const suggestedDue = (s: NcrSeverity) =>
  new Date(Date.now() + CAPA_DUE_DAYS[NCR_PRIORITY[s]] * 86_400_000).toISOString().slice(0, 10);

function Form({ target, people, linkable, canIssueCapa }: NcrModalProps) {
  const close = useCloseDrawer();
  const [state, formAction] = useFormState(triggerNcrFromFinding, null);
  const existing = target.ncr;
  const [severity, setSeverity] = useState<NcrSeverity>(existing?.severity ?? 'MINOR');
  const [mode, setMode] = useState<Mode>(existing && canIssueCapa ? 'create' : 'none');
  const [due, setDue] = useState(suggestedDue(existing?.severity ?? 'MINOR'));
  const [dueTouched, setDueTouched] = useState(false);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="flex items-start gap-2 text-sm font-medium text-compliant">
          <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" /> {state.message}
        </p>
        <button type="button" onClick={close} className="rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90">Close</button>
      </div>
    );
  }

  if (!target.eligible) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm">{target.reason}</p>
        <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Close</button>
      </div>
    );
  }

  const modes: { value: Mode; label: string; hint: string; show: boolean }[] = [
    { value: 'none', label: 'Raise the NCR only', hint: 'An HSE manager issues the action later. Major and critical NCRs stay open until then.', show: !existing },
    { value: 'create', label: 'Raise and create a new action', hint: 'Creates a linked corrective or preventive action in the action board.', show: canIssueCapa },
    { value: 'link', label: 'Link to an existing action', hint: 'One open action can resolve several findings.', show: canIssueCapa && linkable.length > 0 },
  ];

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="responseId" value={target.responseId} />
      <input type="hidden" name="capaMode" value={mode} />

      {state && !state.ok && (
        <p role="alert" className="rounded border border-noncompliant/40 bg-noncompliant/5 px-3 py-2 text-sm text-noncompliant">{state.error}</p>
      )}

      <div className="rounded border border-line bg-canvas p-3 text-sm">
        <p className="text-xs text-steel">{target.category}</p>
        <p className="font-medium">{target.question}</p>
        <p className="mt-1 whitespace-pre-line text-steel">{target.finding}</p>
      </div>

      {existing ? (
        <>
          <input type="hidden" name="severity" value={existing.severity} />
          <input type="hidden" name="summary" value={existing.summary} />
          <p className="text-sm"><span className="font-semibold">{existing.referenceNo}</span> ({NCR_SEVERITY_LABEL[existing.severity].toLowerCase()}) is open and has no action yet.</p>
        </>
      ) : (
        <>
          <Field label="Severity" name="severity" error={err('severity')} hint="Sets the priority and suggested due date of any action.">
            <select id="severity" name="severity" value={severity}
              onChange={(e) => { const s = e.target.value as NcrSeverity; setSeverity(s); if (!dueTouched) setDue(suggestedDue(s)); }} className={inputCls}>
              {toOptions(NCR_SEVERITY_LABEL).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Non-conformance statement" name="summary" error={err('summary')}>
            <textarea id="summary" name="summary" rows={3} required defaultValue={target.finding} className={inputCls} />
          </Field>
          <Field label="Immediate containment actions" name="containmentActions" error={err('containmentActions')}
            hint="Optional. What was done on the spot to make the situation safe.">
            <textarea id="containmentActions" name="containmentActions" rows={3} className={inputCls} />
          </Field>
        </>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Corrective action</legend>
        {modes.filter((m) => m.show).map((m) => (
          <label key={m.value} className="flex cursor-pointer items-start gap-2 rounded border border-line p-3 text-sm has-[:checked]:border-plant has-[:checked]:bg-plant/5">
            <input type="radio" name="capaModeChoice" checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-1 h-4 w-4 accent-plant" />
            <span><span className="block font-medium">{m.label}</span><span className="text-xs text-steel">{m.hint}</span></span>
          </label>
        ))}
        {!canIssueCapa && <p className="text-xs text-steel">Only an HSE manager can issue or link an action.</p>}
      </fieldset>

      {mode === 'create' && (
        <div className="space-y-4 rounded border border-line p-3">
          <Field label="Action title" name="capaTitle" error={err('capaTitle')}>
            <input id="capaTitle" name="capaTitle" required defaultValue={`Resolve: ${target.question}`.slice(0, 200)} className={inputCls} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" name="capaType" error={err('capaType')}>
              <select id="capaType" name="capaType" defaultValue={'CORRECTIVE' satisfies CapaType} className={inputCls}>
                {toOptions(CAPA_TYPE_LABEL).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Due date" name="dueDate" error={err('dueDate')}>
              <input id="dueDate" name="dueDate" type="date" required min={todayInput()} value={due}
                onChange={(e) => { setDue(e.target.value); setDueTouched(true); }} className={inputCls} />
            </Field>
          </div>
          <Field label="Assigned owner" name="assigneeId" error={err('assigneeId')}>
            <select id="assigneeId" name="assigneeId" required defaultValue="" className={inputCls}>
              <option value="" disabled>Choose an owner</option>
              {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
        </div>
      )}

      {mode === 'link' && (
        <Field label="Existing action" name="existingCapaId" error={err('existingCapaId')}>
          <select id="existingCapaId" name="existingCapaId" required defaultValue="" className={inputCls}>
            <option value="" disabled>Choose an open action</option>
            {linkable.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
      )}

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-line bg-white px-5 py-4">
        <SubmitButton>{existing ? 'Issue action' : 'Raise NCR'}</SubmitButton>
        <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}

export function NcrModal(props: NcrModalProps) {
  return (
    <Drawer title={props.target.ncr ? 'Issue corrective action' : 'Raise non-conformance report'} subtitle={props.target.inspectionRef}>
      <Form {...props} />
    </Drawer>
  );
}
