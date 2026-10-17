'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { requestPermit } from '@/actions/permits/permits';
import { Drawer, useCloseDrawer } from '@/components/ui/drawer';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';
import { toOptions } from '@/lib/incidents-meta';
import { PERMIT_TYPE_LABEL } from '@/lib/permits/meta';

export interface PermitModalProps {
  siteId: string;
  /** Site-local "now" and "now + 8 hours", as datetime-local values. */
  nowLocal: string;
  defaultEndLocal: string;
}

function PermitForm({ siteId, nowLocal, defaultEndLocal, onAnother }: PermitModalProps & { onAnother: () => void }) {
  const close = useCloseDrawer();
  const [state, formAction] = useFormState(requestPermit, null);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="flex items-start gap-2 text-sm font-medium text-compliant">
          <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" /> {state.message}
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onAnother}
            className="rounded border border-plant px-4 py-2 text-sm font-semibold text-plant hover:bg-plant/5">
            Request another
          </button>
          <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Close</button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="siteId" value={siteId} />
      {state && !state.ok && (
        <p role="alert" className="rounded border border-noncompliant/40 bg-noncompliant/5 px-3 py-2 text-sm text-noncompliant">
          {state.error}
        </p>
      )}

      <Field label="Permit type" name="type" error={err('type')}>
        <select id="type" name="type" required defaultValue="" className={inputCls}>
          <option value="" disabled>Choose a type</option>
          {toOptions(PERMIT_TYPE_LABEL).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Job title" name="title" error={err('title')}>
        <input id="title" name="title" required className={inputCls} />
      </Field>
      <Field label="Location" name="location" error={err('location')} hint="Where exactly the work happens.">
        <input id="location" name="location" required className={inputCls} />
      </Field>
      <Field label="Work description" name="description" error={err('description')}>
        <textarea id="description" name="description" rows={2} required className={inputCls} />
      </Field>
      <Field label="Hazards" name="hazards" error={err('hazards')} hint="What could go wrong.">
        <textarea id="hazards" name="hazards" rows={2} required className={inputCls} />
      </Field>
      <Field label="Precautions" name="precautions" error={err('precautions')} hint="Isolations, PPE, gas tests, fire watch, rescue plan.">
        <textarea id="precautions" name="precautions" rows={2} required className={inputCls} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valid from (site time)" name="validFrom" error={err('validFrom')}>
          <input id="validFrom" name="validFrom" type="datetime-local" required defaultValue={nowLocal} className={inputCls} />
        </Field>
        <Field label="Valid until (site time)" name="validTo" error={err('validTo')} hint="At most 7 days.">
          <input id="validTo" name="validTo" type="datetime-local" required defaultValue={defaultEndLocal} className={inputCls} />
        </Field>
      </div>

      <Field label="Crew or contractor (optional)" name="workers" error={err('workers')}>
        <textarea id="workers" name="workers" rows={2} className={inputCls} />
      </Field>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-line bg-white px-5 py-4">
        <SubmitButton>Request permit</SubmitButton>
        <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}

export function PermitModal(props: PermitModalProps) {
  const [run, setRun] = useState(0);
  return (
    <Drawer title="Request a permit to work" subtitle="A manager approves it before work can start.">
      <PermitForm key={run} {...props} onAnother={() => setRun((r) => r + 1)} />
    </Drawer>
  );
}
