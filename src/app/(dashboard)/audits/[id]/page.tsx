import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlayCircle } from 'lucide-react';
import { cancelInspection } from '@/actions/audits/inspections';
import { closeNcr } from '@/actions/audits/ncr';
import {
  InspectionStatusBadge, NcrSeverityBadge, NcrStatusBadge, ResultBadge, StandardTag,
} from '@/components/audits/badges';
import { ComplianceScoreCard } from '@/components/audits/ComplianceScoreCard';
import { InspectionExecutionDrawer } from '@/components/audits/InspectionExecutionDrawer';
import { NcrModal } from '@/components/audits/NcrModal';
import { EvidenceLinks } from '@/components/compliance/chips';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import { ActionPanel } from '@/components/ui/action-panel';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireUser } from '@/lib/auth/session';
import { computeScore } from '@/lib/audits/score';
import {
  getAuditTimeline, getExecutionData, getInspectionDetail, getLinkableCapas, getNcrTarget, getNcrTargetByQuestion,
} from '@/lib/data/audits';
import { getSiteUsersWithRole } from '@/lib/data/incidents';
import { one, withParams, type SearchParams } from '@/lib/data/params';
import { fmtDate, fmtDayInZone } from '@/lib/utils';

export default async function InspectionPage({ params, searchParams }: { params: { id: string }; searchParams: SearchParams }) {
  const user = await requireUser();
  const site = await getActiveSite(user);
  if (!site) notFound();

  const a = await getInspectionDetail(params.id, site.id);
  if (!a) notFound();

  const isManager = can(user.role, 'inspection:schedule');
  const mayExecute = can(user.role, 'inspection:execute') && (isManager || a.inspectorId === user.id);
  const workable = a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS';
  const base = `/audits/${a.id}`;

  // The NCR drawer opens from ?ncr=<responseId> (results list) or ?ncrq=<questionId> (execution drawer).
  const ncrParam = mayExecute ? one(searchParams, 'ncr') : undefined;
  const ncrQuestion = mayExecute ? one(searchParams, 'ncrq') : undefined;
  const wantsNcr = Boolean(ncrParam || ncrQuestion);

  const [timeline, exec, ncrTarget, people, linkable] = await Promise.all([
    getAuditTimeline(site.id, a.id, a.ncrs.map((n) => n.id)),
    mayExecute && one(searchParams, 'execute') === a.id ? getExecutionData(a.id, site.id) : null,
    ncrParam ? getNcrTarget(ncrParam, site.id) : ncrQuestion ? getNcrTargetByQuestion(a.id, ncrQuestion, site.id) : null,
    wantsNcr ? getSiteUsersWithRole(site.id) : [],
    wantsNcr && can(user.role, 'capa:manage') ? getLinkableCapas(site.id) : [],
  ]);

  const items = a.categories.flatMap((c) => c.items);
  const summary = computeScore(items.map((i) => ({ weight: i.weight, result: i.result })));
  const failedWithoutNcr = items.filter((i) => i.result === 'NON_COMPLIANT' && !i.ncr).length;
  const canRaise = (a.status === 'IN_PROGRESS' || a.status === 'COMPLETED') && mayExecute;

  const facts: [string, React.ReactNode][] = [
    ['Inspector', a.inspectorName],
    ['Scheduled for', fmtDate(a.scheduledDate)],
    ['Started', a.startedAt ? fmtDayInZone(a.startedAt, site.timezone) : '—'],
    ['Completed', a.completedDate ? fmtDayInZone(a.completedDate, site.timezone) : '—'],
    ['Scheduled by', a.createdByName],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/audits" className="text-sm text-steel underline">Back to inspections</Link>

      <header className="space-y-2">
        <p className="text-sm text-steel">{a.referenceNo}</p>
        <h1 className="font-display text-3xl font-semibold">{a.checklistTitle}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <InspectionStatusBadge status={a.status} overdue={a.overdue} />
          <StandardTag standard={a.standard} />
          <Link href={`${base}/report`} className="text-sm font-medium underline">Report (print or PDF)</Link>
        </div>
        <p className="max-w-prose text-sm text-steel">{a.checklistDescription}</p>
      </header>

      {a.status === 'COMPLETED' && failedWithoutNcr > 0 && (
        <p role="status" className="border-l-4 border-partial bg-partial/5 p-3 text-sm">
          {failedWithoutNcr} failed item{failedWithoutNcr === 1 ? ' has' : 's have'} no NCR yet.
          {mayExecute ? ' Use "Raise NCR" on each one below.' : ''}
        </p>
      )}
      {a.status === 'CANCELLED' && a.cancelReason && (
        <p role="status" className="border-l-4 border-line bg-white p-3 text-sm"><span className="font-medium">Cancelled: </span>{a.cancelReason}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section aria-labelledby="results" className="space-y-5">
            <h2 id="results" className="font-display text-xl font-semibold">Results</h2>
            {a.categories.map((c) => (
              <div key={c.category} className="space-y-3">
                <h3 className="font-display text-lg font-semibold">{c.category}</h3>
                {c.items.map((i) => (
                  <article key={i.questionId} className="space-y-2 rounded border border-line bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{i.question}</p>
                      <ResultBadge result={i.result} />
                    </div>
                    {i.findingDescription && <p className="whitespace-pre-line text-sm text-steel">{i.findingDescription}</p>}
                    {i.evidenceUrls.length > 0 && <EvidenceLinks urls={i.evidenceUrls} max={3} />}
                    {i.result === 'NON_COMPLIANT' && (
                      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm">
                        {i.ncr ? (
                          <>
                            <span className="font-semibold">{i.ncr.referenceNo}</span>
                            <NcrSeverityBadge severity={i.ncr.severity} />
                            <NcrStatusBadge status={i.ncr.status} />
                          </>
                        ) : <span className="text-steel">No NCR yet</span>}
                        {canRaise && i.responseId && (!i.ncr || (i.ncr.status === 'OPEN' && !i.ncr.capaId)) && (
                          <Link href={withParams(searchParams, { ncr: i.responseId, ncrq: undefined, execute: undefined }, base)} scroll={false}
                            className="rounded border border-plant px-3 py-1.5 text-xs font-semibold text-plant hover:bg-plant/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant">
                            {i.ncr ? 'Issue action' : 'Raise NCR'}<span className="sr-only"> for {i.question}</span>
                          </Link>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ))}
          </section>

          <section aria-labelledby="ncrs">
            <h2 id="ncrs" className="mb-3 font-display text-xl font-semibold">Non-conformance reports ({a.ncrs.length})</h2>
            {a.ncrs.length === 0 ? (
              <p className="rounded border border-line bg-white p-5 text-sm text-steel">No NCRs have been raised for this inspection.</p>
            ) : (
              <ul className="space-y-3">
                {a.ncrs.map((n) => (
                  <li key={n.id} className="space-y-2 rounded border border-line bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{n.referenceNo}</span>
                      <NcrSeverityBadge severity={n.severity} />
                      <NcrStatusBadge status={n.status} />
                    </div>
                    <p className="text-sm">{n.summary}</p>
                    {n.containmentActions && (
                      <p className="text-sm"><span className="font-medium">Containment: </span>{n.containmentActions}</p>
                    )}
                    <p className="text-xs text-steel">Item: {n.question}. Raised by {n.raisedByName}.</p>
                    <p className="text-xs">
                      {n.capaRef
                        ? <>Action <Link href={`/incidents/capa?q=${encodeURIComponent(n.capaRef)}`} className="font-medium text-plant underline">{n.capaRef}</Link></>
                        : n.status === 'OPEN' ? <span className="font-medium text-noncompliant">Action needed</span> : null}
                    </p>
                    {n.closureNotes && <p className="border-l-2 border-compliant pl-3 text-xs">{n.closureNotes}</p>}
                    {isManager && n.status === 'OPEN' && !n.capaId && n.severity === 'MINOR' && (
                      <ActionPanel action={closeNcr} label="Close on the spot" submitLabel="Close NCR" hidden={{ ncrId: n.id }}
                        intro="Use when a minor issue was fixed during the inspection."
                        fields={[{ name: 'closureNotes', label: 'How it was resolved', kind: 'textarea', required: true }]} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="activity">
            <h2 id="activity" className="mb-3 font-display text-xl font-semibold">Activity</h2>
            <IncidentTimeline entries={timeline.entries} names={timeline.names} capaRefs={{}} timeZone={site.timezone} />
          </section>
        </div>

        <aside aria-label="Inspection summary" className="space-y-4">
          <div className="space-y-3 rounded border border-line bg-white p-5">
            <ComplianceScoreCard score={a.status === 'COMPLETED' ? a.scorePercentage : summary.pct} size="lg" showLabel />
            <p className="text-xs text-steel">{a.status === 'COMPLETED' ? 'Final score.' : 'Score so far.'}</p>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><dt className="text-xs text-steel">Pass</dt><dd className="font-semibold text-compliant">{summary.compliant}</dd></div>
              <div><dt className="text-xs text-steel">Fail</dt><dd className="font-semibold text-noncompliant">{summary.nonCompliant}</dd></div>
              <div><dt className="text-xs text-steel">N/A</dt><dd className="font-semibold text-steel">{summary.notApplicable}</dd></div>
            </dl>
          </div>

          <dl className="space-y-3 rounded border border-line bg-white p-5 text-sm">
            {facts.map(([k, v]) => <div key={k}><dt className="text-steel">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>

          {(workable && (mayExecute || isManager)) && (
            <div className="space-y-2 rounded border border-line bg-white p-5">
              <h2 className="text-sm font-semibold">Workflow</h2>
              {mayExecute && (
                <Link href={withParams(searchParams, { execute: a.id, ncr: undefined, ncrq: undefined }, base)} scroll={false}
                  className="inline-flex items-center gap-1.5 rounded bg-plant px-3 py-2 text-sm font-semibold text-white hover:bg-plant/90">
                  <PlayCircle size={16} aria-hidden /> {a.status === 'SCHEDULED' ? 'Start inspection' : 'Continue inspection'}
                </Link>
              )}
              {isManager && (
                <ActionPanel tone="danger" action={cancelInspection} label="Cancel inspection" submitLabel="Cancel inspection"
                  hidden={{ inspectionId: a.id }} fields={[{ name: 'reason', label: 'Reason', kind: 'textarea', required: true }]} />
              )}
            </div>
          )}
        </aside>
      </div>

      {exec && <InspectionExecutionDrawer data={exec} />}
      {ncrTarget && (
        <NcrModal target={ncrTarget} people={people.map((p) => ({ value: p.id, label: p.fullName }))} linkable={linkable}
          canIssueCapa={can(user.role, 'capa:manage')} />
      )}
    </div>
  );
}
