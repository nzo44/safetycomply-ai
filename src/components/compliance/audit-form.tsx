'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState } from 'react-dom';
import type { ComplianceStatus, Priority } from '@prisma/client';
import { PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER } from '@/lib/compliance-meta';
import type { FormAction } from '@/lib/action-result';
import { EvidenceField } from '@/components/evidence/EvidenceField';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';
import { useResultToast } from '@/components/ui/toast';

export interface AuditFormProps {
  requirementId: string;
  action: FormAction;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AuditForm({ requirementId, action, onSuccess, onCancel }: AuditFormProps) {
  const [state, formAction] = useFormState(action, null);
  useResultToast(state);
  const [status, setStatus] = useState<ComplianceStatus>('COMPLIANT');
  const formRef = useRef<HTMLFormElement>(null);
  const hasGap = status === 'NON_COMPLIANT' || status === 'PARTIALLY_COMPLIANT';
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    setStatus('COMPLIANT');
    onSuccess?.();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="requirementId" value={requirementId} />

      {state && !state.ok && <p role="alert" className="text-sm font-medium text-noncompliant">{state.error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Result" name="status" error={err('status')}>
          <select id="status" name="status" value={status}
            onChange={(e) => setStatus(e.target.value as ComplianceStatus)} className={inputCls}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Audit date" name="auditDate" error={err('auditDate')}>
          <input id="auditDate" name="auditDate" type="date" required
            defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </Field>
      </div>

      <Field label="Evidence notes and findings" name="findings" error={err('findings')}
        hint="What was inspected, who was interviewed, which records were checked.">
        <textarea id="findings" name="findings" rows={4} className={inputCls} />
      </Field>

      <EvidenceField name="evidenceUrls" label="Evidence" error={err('evidenceUrls')}
        hint="Optional. Up to 10 files or links. Files are stored privately and open only for people with access to this site." />

      {hasGap && (
        <div className="space-y-4 rounded border border-partial/50 bg-partial/5 p-4">
          <Field label="Gap description" name="gapDescription" error={err('gapDescription')}>
            <textarea id="gapDescription" name="gapDescription" rows={3} className={inputCls} />
          </Field>
          <Field label="Gap severity" name="gapSeverity" error={err('gapSeverity')}>
            <select id="gapSeverity" name="gapSeverity" defaultValue="" className={inputCls}>
              <option value="" disabled>Choose severity</option>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="createCapa" defaultChecked className="h-4 w-4 accent-plant" />
            Raise a corrective action for this gap
          </label>
        </div>
      )}

      <Field label="Next audit due" name="nextAuditDue" error={err('nextAuditDue')}
        hint="Leave blank to use the requirement's review frequency.">
        <input id="nextAuditDue" name="nextAuditDue" type="date" className={inputCls} />
      </Field>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t border-line bg-white px-5 py-4">
        <SubmitButton>Record audit</SubmitButton>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-steel underline hover:text-ink">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
