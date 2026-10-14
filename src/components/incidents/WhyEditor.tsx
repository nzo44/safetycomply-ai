'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Minus, Plus } from 'lucide-react';
import { saveRcaDraft, submitRca } from '@/actions/incidents/rca';
import { Field, inputCls } from '@/components/ui/field';
import { useResultToast } from '@/components/ui/toast';
import type { FormAction } from '@/lib/action-result';
import { MAX_WHYS, MIN_WHYS_TO_SUBMIT } from '@/lib/incidents/rca-limits';
import { ROOT_CAUSE_LABEL, toOptions } from '@/lib/incidents-meta';

/** One form, two server actions: the hidden `intent` field picks which one runs. */
const dispatch: FormAction = (prev, fd) => (fd.get('intent') === 'submit' ? submitRca : saveRcaDraft)(prev, fd);

function Buttons({ onIntent }: { onIntent: (i: 'draft' | 'submit') => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} onClick={() => onIntent('draft')}
        className="rounded border border-plant px-4 py-2 text-sm font-semibold text-plant hover:bg-plant/5 disabled:opacity-60">
        Save draft
      </button>
      <button type="submit" disabled={pending} onClick={() => onIntent('submit')}
        className="rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90 disabled:opacity-60">
        {pending ? 'Working…' : 'Submit for review'}
      </button>
    </div>
  );
}

export interface WhyEditorProps {
  incidentId: string;
  defaults: {
    problemStatement: string;
    answers: string[];
    rootCause: string;
    rootCauseCategory: string;
    contributingFactors: string;
  };
}

export function WhyEditor({ incidentId, defaults }: WhyEditorProps) {
  const [state, formAction] = useFormState(dispatch, null);
  useResultToast(state);
  const intent = useRef<HTMLInputElement>(null);
  const [answers, setAnswers] = useState<string[]>(() => {
    const a = [...defaults.answers];
    while (a.length < MIN_WHYS_TO_SUBMIT) a.push('');
    return a;
  });
  const [rootCause, setRootCause] = useState(defaults.rootCause);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  // The question for each level is derived from the previous answer, so only answers are typed.
  const question = (i: number) =>
    i === 0 ? 'Why did this incident happen?'
      : answers[i - 1].trim() ? `Why: ${answers[i - 1].trim()}`.slice(0, 480)
      : 'Why did the previous answer happen?';
  const chain = answers.map((a, i) => ({ why: a.trim() ? question(i) : '', answer: a.trim() }));
  const complete = answers.filter((a) => a.trim().length >= 5).length;
  const lastAnswer = [...answers].reverse().find((a) => a.trim()) ?? '';

  const setAnswer = (i: number, v: string) => setAnswers((p) => p.map((x, j) => (j === i ? v : x)));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="incidentId" value={incidentId} />
      <input type="hidden" name="method" value="FIVE_WHYS" />
      <input type="hidden" name="whyChain" value={JSON.stringify(chain)} />
      <input ref={intent} type="hidden" name="intent" defaultValue="draft" />

      {state && !state.ok && <p role="alert" className="text-sm font-medium text-noncompliant">{state.error}</p>}

      <Field label="Problem statement" name="problemStatement" error={err('problemStatement')}>
        <textarea id="problemStatement" name="problemStatement" rows={3} defaultValue={defaults.problemStatement} className={inputCls} />
      </Field>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display text-lg font-semibold">Why chain</h3>
          <p className="text-xs text-steel" aria-live="polite">{complete} of {MIN_WHYS_TO_SUBMIT} required whys complete</p>
        </div>
        <ol className="space-y-3">
          {answers.map((a, i) => {
            const locked = i > 0 && !answers[i - 1].trim();
            return (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-plant text-sm font-semibold text-white">{i + 1}</span>
                <div className="flex-1">
                  <label htmlFor={`why-${i}`} className="mb-1 block text-sm text-steel">{question(i)}</label>
                  <textarea id={`why-${i}`} rows={2} value={a} disabled={locked}
                    onChange={(e) => setAnswer(i, e.target.value)}
                    placeholder={locked ? 'Answer the previous why first' : 'Because…'}
                    className={`${inputCls} disabled:bg-canvas`} />
                </div>
              </li>
            );
          })}
        </ol>
        {err('whyChain') && <p role="alert" className="mt-2 text-xs font-medium text-noncompliant">{err('whyChain')}</p>}
        <div className="mt-3 flex gap-3">
          <button type="button" disabled={answers.length >= MAX_WHYS} onClick={() => setAnswers((p) => [...p, ''])}
            className="inline-flex items-center gap-1 text-sm text-plant underline disabled:opacity-40">
            <Plus size={14} aria-hidden /> Add a why
          </button>
          <button type="button" disabled={answers.length <= MIN_WHYS_TO_SUBMIT} onClick={() => setAnswers((p) => p.slice(0, -1))}
            className="inline-flex items-center gap-1 text-sm text-steel underline disabled:opacity-40">
            <Minus size={14} aria-hidden /> Remove last
          </button>
        </div>
      </div>

      <Field label="Root cause" name="rootCause" error={err('rootCause')}
        hint="Usually the last answer in the chain, restated as something you can fix.">
        <textarea id="rootCause" name="rootCause" rows={3} value={rootCause} onChange={(e) => setRootCause(e.target.value)} className={inputCls} />
        {lastAnswer && lastAnswer !== rootCause && (
          <button type="button" onClick={() => setRootCause(lastAnswer)} className="mt-1 text-xs text-plant underline">
            Use the last answer as the root cause
          </button>
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Root cause category" name="rootCauseCategory" error={err('rootCauseCategory')}>
          <select id="rootCauseCategory" name="rootCauseCategory" defaultValue={defaults.rootCauseCategory} className={inputCls}>
            <option value="">Choose a category</option>
            {toOptions(ROOT_CAUSE_LABEL).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Contributing factors" name="contributingFactors" error={err('contributingFactors')} hint="One per line.">
          <textarea id="contributingFactors" name="contributingFactors" rows={3} defaultValue={defaults.contributingFactors} className={inputCls} />
        </Field>
      </div>

      <Buttons onIntent={(i) => { if (intent.current) intent.current.value = i; }} />
    </form>
  );
}
