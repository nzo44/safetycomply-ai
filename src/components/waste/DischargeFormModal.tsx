'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { processDischarge } from '@/actions/waste/discharge';
import { Drawer, useCloseDrawer } from '@/components/ui/drawer';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';
import type { DischargeTarget } from '@/lib/data/waste';
import { fmtKg, fmtTons } from '@/lib/utils';
import { netKg, utilizationLevel, utilizationPct } from '@/lib/waste/capacity';
import { DISPOSAL_LABEL, MANIFEST_STATUS_LABEL, PROCESSABLE_STATUSES, WASTE_TYPE_LABEL } from '@/lib/waste/meta';

export interface DischargeFormModalProps {
  manifest: DischargeTarget;
  /** Current landfill totals, for the "after this load" preview; null when not set up. */
  landfill: { totalTons: number; currentTons: number } | null;
  /** Site-local "now" for the date and time default. */
  nowLocal: string;
}

const VARIANCE_WARN_PCT = 15;

function DischargeForm({ manifest, landfill, nowLocal }: DischargeFormModalProps) {
  const close = useCloseDrawer();
  const [state, formAction] = useFormState(processDischarge, null);
  const [gross, setGross] = useState('');
  const [tare, setTare] = useState('');
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  // Success view stays mounted after revalidation (the manifest is now DISCHARGED).
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="flex items-start gap-2 text-sm font-medium text-compliant">
          <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" /> {state.message}
        </p>
        <button type="button" onClick={close}
          className="rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90">
          Close
        </button>
      </div>
    );
  }

  if (!PROCESSABLE_STATUSES.includes(manifest.status)) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm">
          {manifest.manifestCode} is {MANIFEST_STATUS_LABEL[manifest.status].toLowerCase()}, so it can no longer be weighed in.
        </p>
        <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Close</button>
      </div>
    );
  }

  // Live calculation: net = gross - tare, shown once both readings are entered.
  const g = Number(gross);
  const t = Number(tare);
  const entered = gross !== '' && tare !== '' && Number.isFinite(g) && Number.isFinite(t);
  const net = entered ? netKg(g, t) : null;
  const netValid = net !== null && net > 0;

  const est = manifest.estimatedWeightKg;
  const variancePct = netValid && est ? ((net - est) / est) * 100 : null;

  const toLandfill = manifest.disposalMethod === 'LANDFILL';
  const after = toLandfill && netValid && landfill
    ? utilizationPct(landfill.currentTons + net / 1000, landfill.totalTons)
    : null;
  const before = landfill ? utilizationPct(landfill.currentTons, landfill.totalTons) : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="manifestId" value={manifest.id} />

      {state && !state.ok && (
        <p role="alert" className="rounded border border-noncompliant/40 bg-noncompliant/5 px-3 py-2 text-sm text-noncompliant">
          {state.error}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 rounded border border-line bg-canvas p-3 text-sm">
        <div><dt className="text-steel">Waste</dt><dd className="font-medium">{WASTE_TYPE_LABEL[manifest.wasteType]}</dd></div>
        <div><dt className="text-steel">Disposal</dt><dd className="font-medium">{DISPOSAL_LABEL[manifest.disposalMethod]}</dd></div>
        <div><dt className="text-steel">Transporter</dt><dd className="font-medium">{manifest.transporterName}</dd></div>
        <div><dt className="text-steel">Estimated</dt><dd className="font-medium">{est ? `${fmtKg(est)} kg` : '—'}</dd></div>
      </dl>

      <Field label="Weighbridge ticket no." name="weighbridgeTicketNo" error={err('weighbridgeTicketNo')}>
        <input id="weighbridgeTicketNo" name="weighbridgeTicketNo" required autoComplete="off" className={inputCls} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gross weight (kg)" name="grossWeightKg" error={err('grossWeightKg')}>
          <input id="grossWeightKg" name="grossWeightKg" type="number" min="0.001" step="0.001" inputMode="decimal" required
            value={gross} onChange={(e) => setGross(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Tare weight (kg)" name="tareWeightKg" error={err('tareWeightKg')}>
          <input id="tareWeightKg" name="tareWeightKg" type="number" min="0" step="0.001" inputMode="decimal" required
            value={tare} onChange={(e) => setTare(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="rounded border border-line p-3" aria-live="polite">
        <p className="text-sm text-steel">Net weight</p>
        {net === null && <p className="font-display text-2xl font-semibold text-steel">Enter gross and tare</p>}
        {net !== null && netValid && <p className="font-display text-2xl font-semibold">{fmtKg(net)} kg</p>}
        {net !== null && !netValid && (
          <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-noncompliant">
            <AlertTriangle size={14} aria-hidden /> Gross weight must be greater than tare weight.
          </p>
        )}
        {variancePct !== null && (
          <p className={`mt-1 text-xs ${Math.abs(variancePct) > VARIANCE_WARN_PCT ? 'font-medium text-partial' : 'text-steel'}`}>
            {Math.abs(variancePct).toFixed(1)}% {variancePct >= 0 ? 'above' : 'below'} the estimate of {fmtKg(est!)} kg
            {Math.abs(variancePct) > VARIANCE_WARN_PCT && '. Check the readings.'}
          </p>
        )}
      </div>

      {toLandfill ? (
        !landfill ? (
          <p role="alert" className="flex items-start gap-2 rounded border border-partial/50 bg-partial/5 p-3 text-xs">
            <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
            Landfill capacity is not set up for this site, so this load cannot be recorded yet. An HSE manager can set it up on the waste page.
          </p>
        ) : (
          <p className="text-xs text-steel">
            This load counts toward landfill volume.
            {after !== null && before !== null && (
              <> Utilization would go from {before.toFixed(1)}% to <span className={`font-semibold ${
                utilizationLevel(after) === 'CRITICAL' ? 'text-noncompliant' : utilizationLevel(after) === 'WARNING' ? 'text-partial' : 'text-ink'
              }`}>{after.toFixed(1)}%</span> ({fmtTons(landfill.currentTons + (net ?? 0) / 1000)} of {fmtTons(landfill.totalTons)} t).</>
            )}
          </p>
        )
      ) : (
        <p className="text-xs text-steel">Disposal is by {DISPOSAL_LABEL[manifest.disposalMethod].toLowerCase()}, so this load is not counted toward landfill volume.</p>
      )}

      <Field label="Weighed at (site time)" name="dischargeDate" error={err('dischargeDate')}>
        <input id="dischargeDate" name="dischargeDate" type="datetime-local" required defaultValue={nowLocal} max={nowLocal} className={inputCls} />
      </Field>

      <Field label="Ticket evidence links" name="evidenceUrls" error={err('evidenceUrls')}
        hint="Optional. One http(s) link per line, up to 10: the scanned ticket, photos of the load.">
        <textarea id="evidenceUrls" name="evidenceUrls" rows={2} placeholder="https://…" className={inputCls} />
      </Field>

      <Field label="Notes" name="notes" error={err('notes')}>
        <textarea id="notes" name="notes" rows={2} className={inputCls} />
      </Field>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-line bg-white px-5 py-4">
        <SubmitButton>Record discharge</SubmitButton>
        <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}

export function DischargeFormModal(props: DischargeFormModalProps) {
  return (
    <Drawer
      title="Weigh in load"
      subtitle={<>{props.manifest.manifestCode}: {props.manifest.description}</>}
    >
      <DischargeForm {...props} />
    </Drawer>
  );
}
