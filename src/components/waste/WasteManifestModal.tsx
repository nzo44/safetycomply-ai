'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { logWasteManifest } from '@/actions/waste/manifests';
import { Drawer, useCloseDrawer } from '@/components/ui/drawer';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';
import { toOptions } from '@/lib/incidents-meta';
import { DISPOSAL_LABEL, WASTE_TYPE_LABEL } from '@/lib/waste/meta';

export interface WasteManifestModalProps {
  siteId: string;
  /** Site-local "now" for the optional back-dating input's upper bound. */
  nowLocal: string;
}

function ManifestForm({ siteId, nowLocal, onAnother }: WasteManifestModalProps & { onAnother: () => void }) {
  const close = useCloseDrawer();
  const [state, formAction] = useFormState(logWasteManifest, null);
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
            Log another
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

      <Field label="Manifest code" name="manifestCode" hint="Generated automatically, for example WM-2026-0001.">
        <input id="manifestCode" value="Assigned when you save" readOnly disabled className={`${inputCls} bg-canvas text-steel`} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Waste category" name="wasteType" error={err('wasteType')}>
          <select id="wasteType" name="wasteType" required defaultValue="" className={inputCls}>
            <option value="" disabled>Choose a category</option>
            {toOptions(WASTE_TYPE_LABEL).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Estimated weight (kg)" name="estimatedWeightKg" error={err('estimatedWeightKg')}>
          <input id="estimatedWeightKg" name="estimatedWeightKg" type="number" min="0.001" step="0.001" inputMode="decimal" className={inputCls} />
        </Field>
      </div>

      <Field label="Description" name="description" error={err('description')} hint="What is being shipped.">
        <textarea id="description" name="description" rows={2} required className={inputCls} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Transporter" name="transporterName" error={err('transporterName')}>
          <input id="transporterName" name="transporterName" required className={inputCls} />
        </Field>
        <Field label="Destination facility" name="destinationFacility" error={err('destinationFacility')}>
          <input id="destinationFacility" name="destinationFacility" required className={inputCls} />
        </Field>
      </div>

      <Field label="Disposal method" name="disposalMethod" error={err('disposalMethod')}
        hint="Only landfill loads count toward the landfill's volume.">
        <select id="disposalMethod" name="disposalMethod" defaultValue="LANDFILL" className={inputCls}>
          {toOptions(DISPOSAL_LABEL).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      <details className="rounded border border-line p-3">
        <summary className="cursor-pointer text-sm font-medium">More details (optional)</summary>
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Waste code" name="wasteCode" error={err('wasteCode')} hint="For example an EWC code.">
              <input id="wasteCode" name="wasteCode" className={inputCls} />
            </Field>
            <Field label="Transporter licence no." name="transporterLicenseNo" error={err('transporterLicenseNo')}>
              <input id="transporterLicenseNo" name="transporterLicenseNo" className={inputCls} />
            </Field>
            <Field label="Vehicle registration" name="vehicleRegistration" error={err('vehicleRegistration')}>
              <input id="vehicleRegistration" name="vehicleRegistration" className={inputCls} />
            </Field>
            <Field label="Driver" name="driverName" error={err('driverName')}>
              <input id="driverName" name="driverName" className={inputCls} />
            </Field>
          </div>
          <Field label="Dispatched at (site time)" name="dispatchedAt" error={err('dispatchedAt')}
            hint="Leave blank to use the current time. Use this to log a load after the fact.">
            <input id="dispatchedAt" name="dispatchedAt" type="datetime-local" max={nowLocal} className={inputCls} />
          </Field>
          <Field label="Notes" name="notes" error={err('notes')}>
            <textarea id="notes" name="notes" rows={2} className={inputCls} />
          </Field>
        </div>
      </details>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-line bg-white px-5 py-4">
        <SubmitButton>Log shipment</SubmitButton>
        <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}

export function WasteManifestModal(props: WasteManifestModalProps) {
  const [run, setRun] = useState(0); // bumping the key remounts the form for "Log another"
  return (
    <Drawer title="Log outgoing shipment" subtitle="Record the load before it leaves the site.">
      <ManifestForm key={run} {...props} onAnother={() => setRun((r) => r + 1)} />
    </Drawer>
  );
}
