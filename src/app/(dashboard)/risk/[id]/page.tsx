import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, FileText } from 'lucide-react';
import { archiveAssessment, reviewAssessment, reviseAssessment, submitAssessment, updateAssessmentDetails } from '@/actions/risk/assessments';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import { AssessmentStatusBadge, ReviewOverdueTag } from '@/components/risk/badges';
import { HazardDrawer } from '@/components/risk/HazardForm';
import { HazardList } from '@/components/risk/HazardList';
import { RiskMatrix, type RiskMatrixMarker } from '@/components/risk/RiskMatrix';
import { ActionPanel } from '@/components/ui/action-panel';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import { getSiteUsersWithRole } from '@/lib/data/incidents';
import { one, withParams, type SearchParams } from '@/lib/data/params';
import { getAssessmentDetail, getRiskTimeline } from '@/lib/data/risk';
import { approvalCheck, ASSESSMENT_TYPE_LABEL, isReviewOverdue } from '@/lib/risk/workflow';
import { fmtDate } from '@/lib/utils';

export default async function RiskAssessmentPage({ params, searchParams }: { params: { id: string }; searchParams: SearchParams }) {
  const user = await requireModule('risk');
  const site = await getActiveSite(user);
  if (!site) notFound();

  const a = await getAssessmentDetail(params.id, site.id);
  if (!a) notFound();
  const [people, timeline] = await Promise.all([getSiteUsersWithRole(site.id), getRiskTimeline(site.id, a.id)]);

  const isManager = can(user.role, 'risk:approve');
  const canWrite = can(user.role, 'risk:write');
  const draft = a.status === 'DRAFT';
  const canEdit = draft && canWrite && (a.assessorId === user.id || isManager);
  const check = approvalCheck(a.hazards);
  const overdue = isReviewOverdue(a);
  const openRevision = a.versions.find((v) => v.id !== a.id && (v.status === 'DRAFT' || v.status === 'IN_REVIEW'));
  const latestReturn = draft ? timeline.find((t) => t.action === 'risk.returned') : undefined;
  const base = `/risk/${a.id}`;

  const hazardParam = canEdit ? one(searchParams, 'hazard') : undefined;
  const editing = hazardParam && hazardParam !== 'new' ? a.hazards.find((h) => h.id === hazardParam) ?? null : null;
  const showDrawer = hazardParam === 'new' || (hazardParam && editing);

  const markers: RiskMatrixMarker[] = a.hazards.flatMap((h, i) => [
    { n: i + 1, likelihood: h.initialLikelihood, severity: h.initialSeverity, kind: 'initial' as const },
    ...(h.residualLikelihood && h.residualSeverity
      ? [{ n: i + 1, likelihood: h.residualLikelihood, severity: h.residualSeverity, kind: 'residual' as const }] : []),
  ]);

  const facts: [string, React.ReactNode][] = [
    ['Type', ASSESSMENT_TYPE_LABEL[a.type]],
    ['Activity', a.activity],
    ['Area', a.area ?? '—'],
    ['Assessor', a.assessorName],
    ['Assessed on', fmtDate(a.assessedAt)],
    ['Team', a.teamMembers.length ? a.teamMembers.join(', ') : '—'],
    ['Approved by', a.approverName ? `${a.approverName}, ${fmtDate(a.approvedAt)}` : '—'],
    ['Next review', <span key="n" className={overdue ? 'font-medium text-noncompliant' : ''}>{fmtDate(a.nextReviewDate)}{overdue && ' (overdue)'}</span>],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/risk" className="text-sm text-steel underline">Back to risk assessments</Link>

      <header className="space-y-2">
        <p className="text-sm text-steel">{a.referenceNo}, version {a.version}</p>
        <h1 className="font-display text-3xl font-semibold">{a.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <AssessmentStatusBadge status={a.status} />
          {overdue && <ReviewOverdueTag />}
          <Link href={`${base}/print`} className="inline-flex items-center gap-1.5 text-sm text-plant underline">
            <FileText size={14} aria-hidden /> Print view and PDF
          </Link>
        </div>
        {a.versions.length > 1 && (
          <p className="text-xs text-steel">
            Versions:{' '}
            {a.versions.map((v, i) => (
              <span key={v.id}>{i > 0 && ', '}{v.id === a.id ? <strong>{v.version}</strong> : <Link href={`/risk/${v.id}`} className="underline">{v.version}</Link>}</span>
            ))}
          </p>
        )}
        {openRevision && a.status === 'APPROVED' && (
          <p className="text-sm">Version {openRevision.version} is being revised. <Link href={`/risk/${openRevision.id}`} className="text-plant underline">Open it</Link></p>
        )}
      </header>

      {latestReturn && (
        <p role="status" className="border-l-4 border-partial bg-partial/5 p-3 text-sm">
          <span className="font-medium">Returned by the reviewer: </span>{String(latestReturn.metadata.comments ?? '')}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {a.scope && (
            <section aria-labelledby="scope" className="rounded border border-line bg-white p-5">
              <h2 id="scope" className="font-display text-xl font-semibold">Scope</h2>
              <p className="mt-2 max-w-prose whitespace-pre-line text-sm leading-relaxed">{a.scope}</p>
            </section>
          )}

          <section aria-labelledby="hazards">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="hazards" className="font-display text-xl font-semibold">Hazards ({a.hazards.length})</h2>
              {canEdit && (
                <Link href={withParams(searchParams, { hazard: 'new' }, base)} scroll={false}
                  className="rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant">
                  Add hazard
                </Link>
              )}
            </div>
            {hazardParam && !showDrawer && (
              <p role="status" className="mb-3 text-sm text-steel">That hazard was not found. <Link href={base} className="text-plant underline">Dismiss</Link></p>
            )}
            <HazardList hazards={a.hazards} type={a.type} canEdit={canEdit} assessmentId={a.id} sp={searchParams} />
          </section>

          <section aria-labelledby="activity">
            <h2 id="activity" className="mb-3 font-display text-xl font-semibold">Activity</h2>
            <IncidentTimeline entries={timeline} names={{}} capaRefs={{}} timeZone={site.timezone} />
          </section>
        </div>

        <aside aria-label="Assessment summary" className="space-y-4">
          <section aria-labelledby="matrix" className="rounded border border-line bg-white p-4">
            <h2 id="matrix" className="mb-3 font-display text-lg font-semibold">Risk matrix</h2>
            <RiskMatrix markers={markers} />
          </section>

          {draft && (
            <section aria-labelledby="ready" className="space-y-2 rounded border border-line bg-white p-4 text-sm">
              <h2 id="ready" className="font-display text-lg font-semibold">Ready for review?</h2>
              {check.blockers.length === 0
                ? <p className="font-medium text-compliant">All required ratings are complete.</p>
                : <ul className="space-y-1">{check.blockers.map((b) => <li key={b} className="text-noncompliant">{b}.</li>)}</ul>}
              {check.warnings.map((w) => (
                <p key={w} className="flex items-start gap-2 text-xs"><AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0 text-partial" />{w}.</p>
              ))}
            </section>
          )}

          <dl className="space-y-3 rounded border border-line bg-white p-5 text-sm">
            {facts.map(([k, v]) => <div key={k}><dt className="text-steel">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            {a.approvalNotes && <div><dt className="text-steel">Approval note</dt><dd className="font-medium">{a.approvalNotes}</dd></div>}
          </dl>

          <div className="space-y-2 rounded border border-line bg-white p-5">
            <h2 className="text-sm font-semibold">Workflow</h2>
            {canEdit && (
              <>
                <ActionPanel action={submitAssessment} label="Submit for review" submitLabel="Submit" hidden={{ assessmentId: a.id }}
                  intro="Reviewers see the assessment as it is now. It locks until they approve or return it." />
                <ActionPanel action={updateAssessmentDetails} label="Edit details" submitLabel="Save details" hidden={{ assessmentId: a.id }}
                  fields={[
                    { name: 'title', label: 'Title', kind: 'text', required: true, defaultValue: a.title },
                    { name: 'activity', label: 'Task or process assessed', kind: 'text', required: true, defaultValue: a.activity },
                    { name: 'area', label: 'Area or department', kind: 'text', defaultValue: a.area ?? '' },
                    { name: 'scope', label: 'Scope', kind: 'textarea', defaultValue: a.scope ?? '' },
                    { name: 'teamMembers', label: 'Assessment team', kind: 'textarea', hint: 'One name per line.', defaultValue: a.teamMembers.join('\n') },
                  ]} />
              </>
            )}
            {a.status === 'IN_REVIEW' && isManager && a.assessorId !== user.id && (
              <ActionPanel action={reviewAssessment} label="Review assessment" submitLabel="Record decision" hidden={{ assessmentId: a.id }}
                fields={[
                  { name: 'decision', label: 'Decision', kind: 'select', required: true,
                    options: [{ value: 'approve', label: 'Approve' }, { value: 'return', label: 'Return to the assessor' }] },
                  { name: 'comments', label: 'Comments', kind: 'textarea',
                    hint: 'Required when returning, and when any high residual risk remains.' },
                ]} />
            )}
            {a.status === 'IN_REVIEW' && a.assessorId === user.id && (
              <p className="text-xs text-steel">You prepared this assessment, so another HSE manager must review it.</p>
            )}
            {a.status === 'APPROVED' && canWrite && !openRevision && (
              <ActionPanel action={reviseAssessment} label="Revise (new version)" submitLabel="Create version" hidden={{ assessmentId: a.id }}
                intro={`Creates version ${a.version + 1} as a draft with all hazards copied. This version stays in force until the new one is approved.`} />
            )}
            {(a.status === 'DRAFT' || a.status === 'APPROVED') && isManager && (
              <ActionPanel tone="danger" action={archiveAssessment} label="Archive" hidden={{ assessmentId: a.id }}
                fields={[{ name: 'reason', label: 'Reason', kind: 'textarea', required: true }]} />
            )}
            {!canEdit && a.status === 'DRAFT' && <p className="text-xs text-steel">{a.assessorName} is still preparing this assessment.</p>}
          </div>
        </aside>
      </div>

      {showDrawer && (
        <HazardDrawer assessmentId={a.id} type={a.type} hazard={editing}
          people={people.map((p) => ({ value: p.id, label: p.fullName }))} />
      )}
    </div>
  );
}
