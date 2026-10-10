import Link from 'next/link';
import { notFound } from 'next/navigation';
import { closeIncident, reopenIncident, startInvestigation } from '@/actions/incidents/incidents';
import { createCapa } from '@/actions/incidents/capa';
import { CapaProvider } from '@/components/incidents/CapaActions';
import { CapaCard } from '@/components/incidents/CapaCard';
import { IncidentStatusBadge, SeverityBadge } from '@/components/incidents/badges';
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline';
import { RcaSection } from '@/components/incidents/RcaSection';
import { ActionPanel } from '@/components/ui/action-panel';
import { PRIORITY_LABEL } from '@/lib/compliance-meta';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireUser } from '@/lib/auth/session';
import { getIncidentDetail, getIncidentTimeline, getSiteUsersWithRole } from '@/lib/data/incidents';
import { CAPA_TYPE_LABEL, INCIDENT_TYPE_LABEL, toOptions } from '@/lib/incidents-meta';
import { fmtDate, fmtDateTime, todayInput } from '@/lib/utils';

export default async function IncidentPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const site = await getActiveSite(user);
  if (!site) notFound();

  const detail = await getIncidentDetail(params.id, site.id);
  if (!detail) notFound();
  const { incident: inc, reporterName, rca, capas } = detail;

  const [people, timeline] = await Promise.all([
    getSiteUsersWithRole(site.id),
    getIncidentTimeline(site.id, { incidentId: inc.id, rcaId: rca?.id, capaIds: capas.map((c) => c.id) }),
  ]);

  const canManage = can(user.role, 'incident:manage');
  const closed = inc.status === 'CLOSED';
  const asOptions = (list: typeof people) => list.map((p) => ({ value: p.id, label: p.fullName }));
  const leads = people.filter((p) => ['ADMIN', 'HSE_MANAGER', 'INSPECTOR'].includes(p.role));
  const today = todayInput();

  const facts: [string, React.ReactNode][] = [
    ['Type', INCIDENT_TYPE_LABEL[inc.type]],
    ['Occurred', fmtDateTime(inc.occurredAt, site.timezone)],
    ['Location', inc.location ?? '—'],
    ['Reported by', reporterName],
    ['People injured', inc.injuredCount],
    ['Fatalities', inc.fatalityCount],
    ['Lost-time days', inc.lostTimeDays],
    ['Recordable', inc.isRecordable ? 'Yes' : 'No'],
    ['Reportable to authority',
      inc.isReportableToAuthority
        ? `Yes${inc.authorityReportedAt ? `, reported ${fmtDate(inc.authorityReportedAt)}` : ', not yet reported'}${inc.authorityReferenceNo ? ` (${inc.authorityReferenceNo})` : ''}`
        : 'No'],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/incidents" className="text-sm text-steel underline">Back to incidents</Link>

      <header className="space-y-2">
        <p className="text-sm text-steel">{inc.referenceNo}</p>
        <h1 className="font-display text-3xl font-semibold">{inc.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <SeverityBadge severity={inc.severity} />
          <IncidentStatusBadge status={inc.status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <section aria-labelledby="what" className="rounded border border-line bg-white p-5">
            <h2 id="what" className="font-display text-xl font-semibold">What happened</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-sm leading-relaxed">{inc.description}</p>
            {inc.immediateActions && (
              <>
                <h3 className="mt-4 text-sm font-semibold">Immediate actions</h3>
                <p className="mt-1 max-w-prose whitespace-pre-line text-sm">{inc.immediateActions}</p>
              </>
            )}
            {closed && inc.closureNotes && (
              <p className="mt-4 border-l-2 border-compliant pl-3 text-sm"><span className="font-medium">Closure summary: </span>{inc.closureNotes}</p>
            )}
          </section>

          <section aria-labelledby="rca">
            <h2 id="rca" className="mb-3 font-display text-xl font-semibold">Root cause analysis</h2>
            <RcaSection
              incidentId={inc.id}
              rca={rca}
              viewer={{ id: user.id, canManage, canWrite: can(user.role, 'rca:write'), canApprove: can(user.role, 'rca:approve') }}
            />
          </section>

          <section aria-labelledby="actions">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="actions" className="font-display text-xl font-semibold">Corrective and preventive actions</h2>
              {can(user.role, 'capa:manage') && !closed && (
                <ActionPanel action={createCapa} label="Add action" submitLabel="Create action"
                  hidden={{ incidentId: inc.id, ...(rca ? { rcaId: rca.id } : {}) }}
                  fields={[
                    { name: 'title', label: 'Title', kind: 'text', required: true },
                    { name: 'description', label: 'What must be done', kind: 'textarea', required: true },
                    { name: 'type', label: 'Type', kind: 'select', required: true, options: toOptions(CAPA_TYPE_LABEL) },
                    { name: 'priority', label: 'Priority', kind: 'select', required: true, options: toOptions(PRIORITY_LABEL), defaultValue: 'MEDIUM' },
                    { name: 'assigneeId', label: 'Assignee', kind: 'select', required: true, options: asOptions(people) },
                    { name: 'dueDate', label: 'Due date', kind: 'date', required: true, min: today },
                  ]} />
              )}
            </div>
            <CapaProvider
              value={{
                viewerId: user.id,
                canManage: can(user.role, 'capa:manage'),
                canVerify: can(user.role, 'capa:verify'),
                people: asOptions(people),
                escalationTargets: asOptions(people.filter((p) => p.role === 'HSE_MANAGER' || p.role === 'ADMIN')),
                today,
              }}
            >
              {capas.length === 0
                ? <p className="rounded border border-line bg-white p-5 text-sm text-steel">No actions yet. Add actions once the root cause is known.</p>
                : <div className="space-y-3">{capas.map((c) => <CapaCard key={c.id} capa={c} showStatus />)}</div>}
            </CapaProvider>
          </section>

          <section aria-labelledby="timeline">
            <h2 id="timeline" className="mb-3 font-display text-xl font-semibold">Activity</h2>
            <IncidentTimeline
              entries={timeline.entries}
              names={timeline.names}
              capaRefs={Object.fromEntries(capas.map((c) => [c.id, c.referenceNo]))}
              timeZone={site.timezone}
            />
          </section>
        </div>

        <aside aria-label="Incident details" className="space-y-4">
          <dl className="space-y-3 rounded border border-line bg-white p-5 text-sm">
            {facts.map(([k, v]) => (
              <div key={k}><dt className="text-steel">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>

          {canManage && (
            <div className="space-y-2 rounded border border-line bg-white p-5">
              <h2 className="text-sm font-semibold">Workflow</h2>
              {inc.status === 'REPORTED' && (
                <ActionPanel action={startInvestigation} label="Start investigation" hidden={{ incidentId: inc.id, method: 'FIVE_WHYS' }}
                  fields={[{ name: 'leadId', label: 'Investigation lead', kind: 'select', required: true, options: asOptions(leads) }]} />
              )}
              {!closed && (
                <ActionPanel action={closeIncident} label="Close incident" hidden={{ incidentId: inc.id }}
                  intro="Closing needs an approved analysis (for anything beyond a minor, injury-free event) and no open actions."
                  fields={[{ name: 'closureNotes', label: 'Closure summary', kind: 'textarea', required: true }]} />
              )}
              {closed && (
                <ActionPanel tone="danger" action={reopenIncident} label="Reopen incident" hidden={{ incidentId: inc.id }}
                  fields={[{ name: 'reason', label: 'Why is it being reopened?', kind: 'textarea', required: true }]} />
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
