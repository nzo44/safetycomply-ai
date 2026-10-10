'use client';

import { useEffect, useId, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { FormAction } from '@/lib/action-result';
import type { Option } from '@/types/common';
import { Field, inputCls, SubmitButton } from './field';

export interface FieldSpec {
  name: string;
  label: string;
  kind: 'text' | 'textarea' | 'date' | 'number' | 'select';
  options?: Option[];
  required?: boolean;
  hint?: string;
  defaultValue?: string;
  min?: string;
  step?: string;
}

export interface ActionPanelProps {
  action: FormAction;
  label: string;
  submitLabel?: string;
  fields?: FieldSpec[];
  hidden?: Record<string, string>;
  /** Submit straight from the button, with no form (e.g. "Start work"). */
  immediate?: boolean;
  tone?: 'default' | 'danger';
  intro?: string;
}

function OutlineSubmit({ className, children }: { className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className={`rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${className}`}>
      {pending ? 'Working…' : children}
    </button>
  );
}

export function ActionPanel({
  action, label, submitLabel, fields = [], hidden = {}, immediate = false, tone = 'default', intro,
}: ActionPanelProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(action, null);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);
  const btn = tone === 'danger'
    ? 'border-noncompliant text-noncompliant hover:bg-noncompliant/5'
    : 'border-plant text-plant hover:bg-plant/5';

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  const hiddenInputs = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  const result = (
    <>
      {state?.ok && state.message && <p role="status" className="mt-1 text-xs font-medium text-compliant">{state.message}</p>}
      {state && !state.ok && !open && <p role="alert" className="mt-1 text-xs font-medium text-noncompliant">{state.error}</p>}
    </>
  );

  if (immediate) {
    return (
      <div>
        <form action={formAction}>
          {hiddenInputs}
          <OutlineSubmit className={btn}>{label}</OutlineSubmit>
        </form>
        {result}
      </div>
    );
  }

  return (
    <div className={open ? 'w-full' : undefined}>
      {!open ? (
        <>
          <button type="button" onClick={() => setOpen(true)}
            className={`rounded border px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant ${btn}`}>
            {label}
          </button>
          {result}
        </>
      ) : (
        <form action={formAction} className="space-y-3 rounded border border-line bg-canvas p-3">
          <p className="text-sm font-semibold">{label}</p>
          {intro && <p className="text-xs text-steel">{intro}</p>}
          {state && !state.ok && <p role="alert" className="text-xs font-medium text-noncompliant">{state.error}</p>}
          {hiddenInputs}
          {fields.map((f) => {
            const id = `${uid}-${f.name}`;
            return (
              <Field key={f.name} label={f.label} name={f.name} htmlFor={id} hint={f.hint} error={err(f.name)}>
                {f.kind === 'textarea' ? (
                  <textarea id={id} name={f.name} rows={3} required={f.required} defaultValue={f.defaultValue} className={inputCls} />
                ) : f.kind === 'select' ? (
                  <select id={id} name={f.name} required={f.required} defaultValue={f.defaultValue ?? ''} className={inputCls}>
                    <option value="" disabled>Choose…</option>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input id={id} name={f.name} type={f.kind} min={f.min} step={f.step} required={f.required} defaultValue={f.defaultValue} className={inputCls} />
                )}
              </Field>
            );
          })}
          <div className="flex items-center gap-3">
            <SubmitButton>{submitLabel ?? label}</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-steel underline">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
