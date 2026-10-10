'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import { reportIncident } from '@/actions/incidents/incidents';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL, SEVERITY_ORDER, toOptions } from '@/lib/incidents-meta';

export function IncidentForm({ nowLocal }: { nowLocal: string }) {
  const [state, formAction] = useFormState(reportIncident, null);
  const [reportable, setReportable] = useState(false);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  return (
    <form action={formAction} className="space-y-5 rounded border border-line bg-white p-6">
      {state && !state.ok && (
        <p role="alert" className="rounded border border-noncompliant/40 bg-noncompliant/5 px-3 py-2 text-sm text-noncompliant">{state.error}</p>
      )}

      <Field label="Title" name="title" error={err('title')}>
        <input id="title" name="title" required className={inputCls} placeholder="What happened, in one line" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Type" name="type" error={err('type')}>
          <select id="type" name="type" required defaultValue="" className={inputCls}>
            <option value="" disabled>Choose a type</option>
            {toOptions(INCIDENT_TYPE_LABEL).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Severity" name="severity" error={err('severity')}>
          <select id="severity" name="severity" required defaultValue="" className={inputCls}>
            <option value="" disabled>Choose severity</option>
            {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Occurred (site time)" name="occurredAt" error={err('occurredAt')}>
          <input id="occurredAt" name="occurredAt" type="datetime-local" required defaultValue={nowLocal} max={nowLocal} className={inputCls} />
        </Field>
      </div>

      <Field label="Location" name="location" error={err('location')} hint="Area, unit or equipment tag.">
        <input id="location" name="location" className={inputCls} />
      </Field>

      <Field label="Description" name="description" error={err('description')} hint="Facts only: what, who was involved, what was observed.">
        <textarea id="description" name="description" rows={5} required className={inputCls} />
      </Field>

      <Field label="Immediate actions taken" name="immediateActions" error={err('immediateActions')}>
        <textarea id="immediateActions" name="immediateActions" rows={3} className={inputCls} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="People injured" name="injuredCount" error={err('injuredCount')}>
          <input id="injuredCount" name="injuredCount" type="number" min={0} defaultValue={0} className={inputCls} />
        </Field>
        <Field label="Fatalities" name="fatalityCount" error={err('fatalityCount')}>
          <input id="fatalityCount" name="fatalityCount" type="number" min={0} defaultValue={0} className={inputCls} />
        </Field>
        <Field label="Lost-time days" name="lostTimeDays" error={err('lostTimeDays')}>
          <input id="lostTimeDays" name="lostTimeDays" type="number" min={0} defaultValue={0} className={inputCls} />
        </Field>
      </div>

      <fieldset className="space-y-3 rounded border border-line p-4">
        <legend className="px-1 text-sm font-medium">Regulatory flags</legend>
        <p className="text-xs text-steel">Fatalities and lost time are flagged automatically as recordable. Fatalities and catastrophic incidents are flagged as reportable.</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isRecordable" className="h-4 w-4 accent-plant" /> Recordable incident
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isReportableToAuthority" checked={reportable}
            onChange={(e) => setReportable(e.target.checked)} className="h-4 w-4 accent-plant" /> Reportable to the authority
        </label>
        {reportable && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reported on" name="authorityReportedAt" error={err('authorityReportedAt')}>
              <input id="authorityReportedAt" name="authorityReportedAt" type="date" className={inputCls} />
            </Field>
            <Field label="Authority reference" name="authorityReferenceNo" error={err('authorityReferenceNo')}>
              <input id="authorityReferenceNo" name="authorityReferenceNo" className={inputCls} />
            </Field>
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-4 pt-2">
        <SubmitButton>Report incident</SubmitButton>
        <Link href="/incidents" className="text-sm text-steel underline">Cancel</Link>
      </div>
    </form>
  );
}
