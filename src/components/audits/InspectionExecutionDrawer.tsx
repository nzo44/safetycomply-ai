'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { InspectionResult } from '@prisma/client';
import { Check, CheckCircle2, Loader2, Minus, X, type LucideIcon } from 'lucide-react';
import { completeInspection, submitInspectionResponse } from '@/actions/audits/inspections';
import { Drawer, useCloseDrawer } from '@/components/ui/drawer';
import { EvidenceField } from '@/components/evidence/EvidenceField';
import { inputCls } from '@/components/ui/field';
import { WORKABLE_STATUSES } from '@/lib/audits/meta';
import { computeScore } from '@/lib/audits/score';
import type { ActionResult } from '@/lib/action-result';
import type { ExecutionData, ExecutionQuestion } from '@/types/audits';
import { StandardTag } from './badges';
import { ComplianceScoreCard } from './ComplianceScoreCard';

interface Local {
  result: InspectionResult | null;
  finding: string;
  evidence: string;
  saved: boolean;
  saving: boolean;
  hasNcr: boolean;
  error?: string;
}

const OPTIONS: { value: InspectionResult; label: string; Icon: LucideIcon; on: string }[] = [
  { value: 'COMPLIANT', label: 'Pass', Icon: Check, on: 'border-compliant bg-compliant text-white' },
  { value: 'NON_COMPLIANT', label: 'Fail', Icon: X, on: 'border-noncompliant bg-noncompliant text-white' },
  { value: 'NOT_APPLICABLE', label: 'N/A', Icon: Minus, on: 'border-steel bg-steel text-white' },
];

const MIN_FINDING = 10;

function QuestionRow({
  inspectionId, q, a, onPick, onText, onSaveText,
}: {
  inspectionId: string;
  q: ExecutionQuestion;
  a: Local;
  onPick: (r: InspectionResult) => void;
  onText: (field: 'finding' | 'evidence', value: string) => void;
  onSaveText: () => void;
}) {
  const failing = a.result === 'NON_COMPLIANT';
  const canSave = !a.saving && (!failing || a.finding.trim().length >= MIN_FINDING);

  const fields = (
    <div className="mt-3 space-y-2">
      <label htmlFor={`${q.id}-finding`} className="block text-xs font-medium">{failing ? 'Finding (required)' : 'Note'}</label>
      <textarea id={`${q.id}-finding`} rows={3} value={a.finding} onChange={(e) => onText('finding', e.target.value)} className={inputCls}
        placeholder={failing ? 'What was observed, where, and what should have been in place' : ''} />
      <EvidenceField label="Evidence" value={a.evidence} onChange={(v) => onText('evidence', v)} max={5} />
      <button type="button" onClick={onSaveText} disabled={!canSave}
        className="min-h-11 rounded border border-plant px-4 text-sm font-semibold text-plant hover:bg-plant/5 disabled:opacity-50">
        {failing ? 'Save finding' : 'Save note'}
      </button>
    </div>
  );

  return (
    <fieldset className="rounded border border-line bg-white p-3">
      <legend className="sr-only">{q.question}</legend>
      <p className="text-sm font-medium">{q.question}</p>
      {q.weight > 1 && <p className="text-xs text-steel">Weight {q.weight}</p>}
      {q.guidanceNote && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-medium text-plant">Guidance</summary>
          <p className="mt-1 text-xs text-steel">{q.guidanceNote}</p>
        </details>
      )}

      <div role="group" aria-label={`Result for: ${q.question}`} className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, Icon, on }) => (
          <button key={value} type="button" aria-pressed={a.result === value} onClick={() => onPick(value)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded border text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant ${
              a.result === value ? on : 'border-line bg-white text-ink hover:bg-canvas'
            }`}>
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>

      {failing ? fields : a.result && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-plant">Add a note or evidence</summary>
          {fields}
        </details>
      )}

      {failing && a.saved && (
        <p className="mt-2 text-xs">
          {a.hasNcr ? (
            <span className="font-medium text-steel">An NCR has been raised for this finding.</span>
          ) : (
            <Link href={`/audits/${inspectionId}?ncrq=${q.id}`}
              className="inline-flex min-h-9 items-center rounded border border-noncompliant px-3 font-semibold text-noncompliant hover:bg-noncompliant/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-noncompliant">
              Raise NCR for this fail<span className="sr-only">: {q.question}</span>
            </Link>
          )}
        </p>
      )}

      <p className="mt-2 min-h-4 text-xs" aria-live="polite">
        {a.saving ? <span className="inline-flex items-center gap-1 text-steel"><Loader2 size={12} className="animate-spin" aria-hidden /> Saving…</span>
          : a.error ? <span role="alert" className="font-medium text-noncompliant">{a.error}</span>
          : failing && !a.saved ? <span className="text-partial">Describe the finding to save this answer.</span>
          : a.saved && a.result ? <span className="text-compliant">Saved</span> : null}
      </p>
    </fieldset>
  );
}

function Execution({ data }: { data: ExecutionData }) {
  const close = useCloseDrawer();
  const { inspection, questions } = data;
  const seq = useRef<Record<string, number>>({});
  const [completion, setCompletion] = useState<ActionResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Local>>(() => {
    const byQ = new Map(data.responses.map((r) => [r.questionId, r]));
    return Object.fromEntries(
      questions.map((q) => {
        const r = byQ.get(q.id);
        return [q.id, {
          result: r?.result ?? null, finding: r?.findingDescription ?? '', evidence: r?.evidenceUrls.join('\n') ?? '',
          saved: Boolean(r), saving: false, hasNcr: r?.hasNcr ?? false,
        } satisfies Local];
      }),
    );
  });

  const patch = (id: string, p: Partial<Local>) => setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));

  async function save(qid: string, v: { result: InspectionResult; finding: string; evidence: string }) {
    const n = (seq.current[qid] = (seq.current[qid] ?? 0) + 1); // ignore out-of-order replies
    patch(qid, { ...v, saving: true, error: undefined });
    const fd = new FormData();
    fd.set('inspectionId', inspection.id);
    fd.set('questionId', qid);
    fd.set('result', v.result);
    fd.set('findingDescription', v.finding);
    fd.set('evidenceUrls', v.evidence);
    const res = await submitInspectionResponse(null, fd);
    if (seq.current[qid] !== n) return;
    if (res.ok) patch(qid, { saved: true, saving: false });
    else patch(qid, { saved: false, saving: false, error: res.fieldErrors?.findingDescription?.[0] ?? res.fieldErrors?.evidenceUrls?.[0] ?? res.error });
  }

  function pick(q: ExecutionQuestion, result: InspectionResult) {
    const cur = answers[q.id];
    if (cur.result === result && cur.saved) return;
    // A fail needs a finding first, so it is saved from the finding form, not on tap.
    if (result === 'NON_COMPLIANT' && cur.finding.trim().length < MIN_FINDING) {
      patch(q.id, { result, saved: false, error: undefined });
      return;
    }
    void save(q.id, { result, finding: cur.finding, evidence: cur.evidence });
  }

  const groups = useMemo(() => {
    const out: { category: string; items: ExecutionQuestion[] }[] = [];
    for (const q of questions) {
      const g = out.find((x) => x.category === q.category);
      if (g) g.items.push(q);
      else out.push({ category: q.category, items: [q] });
    }
    return out;
  }, [questions]);

  const summary = computeScore(questions.map((q) => ({ weight: q.weight, result: answers[q.id].saved ? answers[q.id].result : null })));
  const unsaved = questions.filter((q) => answers[q.id].result && !answers[q.id].saved).length;
  const busy = questions.some((q) => answers[q.id].saving);
  const ready = summary.answered === questions.length && unsaved === 0 && !busy;

  async function finish() {
    setCompleting(true);
    const fd = new FormData();
    fd.set('inspectionId', inspection.id);
    setCompletion(await completeInspection(null, fd));
    setCompleting(false);
  }

  if (!WORKABLE_STATUSES.includes(inspection.status)) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm">This inspection is {inspection.status === 'COMPLETED' ? 'completed' : 'cancelled'}, so it can no longer be edited.</p>
        <Link href={`/audits/${inspection.id}`} className="text-sm text-plant underline">View results</Link>
      </div>
    );
  }

  if (completion?.ok) {
    return (
      <div className="space-y-5">
        <p role="status" className="flex items-start gap-2 text-sm font-medium text-compliant">
          <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" /> {completion.message}
        </p>
        <ComplianceScoreCard score={summary.pct} size="lg" showLabel />
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/audits/${inspection.id}`}
            className="rounded bg-plant px-4 py-2.5 text-sm font-semibold text-white hover:bg-plant/90">Review findings and raise NCRs</Link>
          <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-line bg-white px-5 py-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{summary.answered} of {questions.length} answered</span>
          <span className="text-steel" aria-live="polite">{summary.pct === null ? 'No score yet' : `Score so far ${summary.pct.toFixed(1)}%`}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-sm bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length}
          aria-valuenow={summary.answered} aria-label="Questions answered">
          <div className="h-full bg-plant" style={{ width: `${(summary.answered / Math.max(1, questions.length)) * 100}%` }} />
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.category} aria-label={g.category} className="space-y-3">
          <h3 className="font-display text-lg font-semibold">{g.category}</h3>
          {g.items.map((q) => (
            <QuestionRow key={q.id} inspectionId={inspection.id} q={q} a={answers[q.id]} onPick={(r) => pick(q, r)}
              onText={(field, value) => patch(q.id, { [field]: value, saved: false, error: undefined })}
              onSaveText={() => answers[q.id].result && void save(q.id, { result: answers[q.id].result!, finding: answers[q.id].finding, evidence: answers[q.id].evidence })} />
          ))}
        </section>
      ))}

      <div className="sticky bottom-0 -mx-5 space-y-2 border-t border-line bg-white px-5 py-4">
        {completion && !completion.ok && <p role="alert" className="text-sm font-medium text-noncompliant">{completion.error}</p>}
        {!ready && <p className="text-xs text-steel">{unsaved > 0 ? `${unsaved} answer${unsaved === 1 ? ' is' : 's are'} not saved yet.` : 'Answer every question to complete the inspection.'}</p>}
        <div className="flex items-center gap-4">
          <button type="button" onClick={finish} disabled={!ready || completing}
            className="min-h-11 rounded bg-plant px-5 text-sm font-semibold text-white hover:bg-plant/90 disabled:opacity-50">
            {completing ? 'Completing…' : 'Complete inspection'}
          </button>
          <button type="button" onClick={close} className="text-sm text-steel underline hover:text-ink">Save and close</button>
        </div>
      </div>
    </div>
  );
}

export function InspectionExecutionDrawer({ data }: { data: ExecutionData }) {
  return (
    <Drawer title={data.inspection.checklistTitle}
      subtitle={<span className="flex flex-wrap items-center gap-2">{data.inspection.referenceNo} <StandardTag standard={data.inspection.standard} /></span>}>
      <Execution data={data} />
    </Drawer>
  );
}
