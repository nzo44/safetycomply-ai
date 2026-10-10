'use client';

import { useFormState } from 'react-dom';
import Link from 'next/link';
import type { RequirementCategory } from '@prisma/client';
import { CATEGORY_LABEL } from '@/lib/compliance-meta';
import type { FormAction } from '@/lib/action-result';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';

type Defaults = Partial<Record<
  'title' | 'citation' | 'authority' | 'jurisdiction' | 'category' | 'obligation' | 'description' |
  'sourceUrl' | 'ownerId' | 'effectiveDate' | 'reviewFrequencyDays' | 'nextReviewDate', string
>>;

export function RequirementForm({
  action, owners, defaults = {}, submitLabel, cancelHref,
}: {
  action: FormAction;
  owners: { id: string; fullName: string }[];
  defaults?: Defaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useFormState(action, null);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  return (
    <form action={formAction} className="space-y-5 rounded border border-line bg-white p-6">
      {state && !state.ok && (
        <p role="alert" className="rounded border border-noncompliant/40 bg-noncompliant/5 px-3 py-2 text-sm text-noncompliant">
          {state.error}
        </p>
      )}

      <Field label="Title" name="title" error={err('title')}>
        <input id="title" name="title" defaultValue={defaults.title} className={inputCls} required />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Legal citation" name="citation" error={err('citation')}>
          <input id="citation" name="citation" defaultValue={defaults.citation} className={inputCls} required />
        </Field>
        <Field label="Issuing authority" name="authority" error={err('authority')}>
          <input id="authority" name="authority" defaultValue={defaults.authority} className={inputCls} required />
        </Field>
        <Field label="Jurisdiction" name="jurisdiction" error={err('jurisdiction')} hint="For example National, Wilaya, ISO.">
          <input id="jurisdiction" name="jurisdiction" defaultValue={defaults.jurisdiction ?? 'National'} className={inputCls} required />
        </Field>
        <Field label="Category" name="category" error={err('category')}>
          <select id="category" name="category" defaultValue={defaults.category ?? ''} className={inputCls} required>
            <option value="" disabled>Choose a category</option>
            {(Object.keys(CATEGORY_LABEL) as RequirementCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Obligation" name="obligation" error={err('obligation')} hint="What the site must do to comply.">
        <textarea id="obligation" name="obligation" rows={4} defaultValue={defaults.obligation} className={inputCls} required />
      </Field>

      <Field label="Notes" name="description" error={err('description')}>
        <textarea id="description" name="description" rows={2} defaultValue={defaults.description} className={inputCls} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Owner" name="ownerId" error={err('ownerId')}>
          <select id="ownerId" name="ownerId" defaultValue={defaults.ownerId ?? ''} className={inputCls}>
            <option value="">Unassigned</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}
          </select>
        </Field>
        <Field label="Source URL" name="sourceUrl" error={err('sourceUrl')}>
          <input id="sourceUrl" name="sourceUrl" type="url" defaultValue={defaults.sourceUrl} className={inputCls} />
        </Field>
        <Field label="Effective date" name="effectiveDate" error={err('effectiveDate')}>
          <input id="effectiveDate" name="effectiveDate" type="date" defaultValue={defaults.effectiveDate} className={inputCls} />
        </Field>
        <Field label="Review every (days)" name="reviewFrequencyDays" error={err('reviewFrequencyDays')}>
          <input id="reviewFrequencyDays" name="reviewFrequencyDays" type="number" min={1} defaultValue={defaults.reviewFrequencyDays} className={inputCls} />
        </Field>
        <Field label="Next review date" name="nextReviewDate" error={err('nextReviewDate')} hint="Leave blank to calculate it from the review frequency.">
          <input id="nextReviewDate" name="nextReviewDate" type="date" defaultValue={defaults.nextReviewDate} className={inputCls} />
        </Field>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="text-sm text-steel underline">Cancel</Link>
      </div>
    </form>
  );
}
