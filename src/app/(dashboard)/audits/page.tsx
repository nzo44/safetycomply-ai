import Link from 'next/link';
import { createChecklist } from '@/actions/audits/checklists';
import { scheduleInspection } from '@/actions/audits/inspections';
import { NcrSeverityBadge, NcrStatusBadge } from '@/components/audits/badges';
import { ComplianceScoreCard } from '@/components/audits/ComplianceScoreCard';
import { InspectionExecutionDrawer } from '@/components/audits/InspectionExecutionDrawer';
import { InspectionTable } from '@/components/audits/InspectionTable';
import { ActionPanel } from '@/components/ui/action-panel';
import { Pagination } from '@/components/ui/pagination';
import { UrlFilters, type FilterField } from '@/components/ui/url-filters';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireUser } from '@/lib/auth/session';
import { INSPECTION_FILTER_LABEL, STANDARD_LABEL } from '@/lib/audits/meta';
import {
  getAuditStats, getChecklistOptions, getExecutionData, getInspections, getNcrRegister, parseInspectionFilters,
} from '@/lib/data/audits';
import { getSiteUsersWithRole } from '@/lib/data/incidents';
import { one, withParams, type SearchParams } from '@/lib/data/params';
import { toOptions } from '@/lib/incidents-meta';
import { fmtDayInZone, todayInput } from '@/lib/utils';

const FIELDS: FilterField[] = [
  { kind: 'search', key: 'q', label: 'Search', placeholder: 'Reference, checklist or inspector' },
  { kind: 'select', key: 'standard', label: 'Standard', allLabel: 'All standards', options: toOptions(STANDARD_LABEL) },
  { kind: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: toOptions(INSPECTION_FILTER_LABEL) },
  { kind: 'date', key: 'from', label: 'Scheduled from' },
  { kind: 'date', key: 'to', label: 'Scheduled to' },
];

export default async function AuditsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const site = await getActiveSite(user);
  if (!site) return <p className="text-sm text-steel">No site is assigned to your account. Ask an administrator to add you to a site.</p>;

  const view = one(searchParams, 'view') === 'ncrs' ? 'ncrs' : 'inspections';
  const filters = parseInspectionFilters(searchParams);
  const [stats, list, checklists, inspectors, ncrs] = await Promise.all([
    getAuditStats(site.id),
    view === 'inspections' ? getInspections(site.id, filters) : null,
    getChecklistOptions(),
    getSiteUsersWithRole(site.id, ['ADMIN', 'HSE_MANAGER', 'INSPECTOR', 'AUDITOR']),
    view === 'ncrs' ? getNcrRegister(site.id) : null,
  ]);

  const isManager = can(user.role, 'inspection:schedule');
  const canExecute = can(user.role, 'inspection:execute');
  const hasFilters = Boolean(filters.q || filters.standard || filters.status || filters.from || filters.to);

  // URL-driven drawer: mounted only while ?execute= is present, and only for someone allowed to work on it.
  const executeId = one(searchParams, 'execute');
  const exec = view === 'inspections' && executeId && canExecute ? await getExecutionData(executeId, site.id) : null;
  const mayExecute = exec !== null && (isManager || exec.inspection.inspectorId === user.id);

  const hrefFor = (p: number) => withParams(searchParams, { page: p > 1 ? String(p) : undefined, execute: undefined }, '/audits');
  const tabHref = (v: 'inspections' | 'ncrs') =>
    v === 'ncrs' ? '/audits?view=ncrs' : '/audits';
  const tabCls = (active: boolean) =>
    `rounded-t border-b-2 px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant ${
      active ? 'border-plant text-plant' : 'border-transparent text-steel hover:text-ink'
    }`;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Audits and inspections</h1>
          <p className="mt-1 text-sm text-steel">{site.name} ({site.code})</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {isManager && (
            <ActionPanel action={scheduleInspection} label="Schedule inspection" submitLabel="Schedule" hidden={{ siteId: site.id }}
              intro={checklists.length === 0 ? 'Create a checklist first. Inspections are run from a checklist.' : undefined}
              fields={[
                { name: 'checklistId', label: 'Checklist', kind: 'select', required: true, options: checklists },
                { name: 'inspectorId', label: 'Inspector', kind: 'select', required: true, options: inspectors.map((p) => ({ value: p.id, label: p.fullName })) },
                { name: 'scheduledDate', label: 'Inspection date', kind: 'date', required: true, min: todayInput() },
              ]} />
          )}
          {can(user.role, 'checklist:manage') && (
            <ActionPanel action={createChecklist} label="New checklist" submitLabel="Create checklist"
              intro="Checklists are shared across all sites and cannot be edited later. To change one, create a new version."
              fields={[
                { name: 'title', label: 'Title', kind: 'text', required: true },
                { name: 'standard', label: 'Standard', kind: 'select', required: true, options: toOptions(STANDARD_LABEL) },
                { name: 'description', label: 'Description', kind: 'textarea', required: true },
                { name: 'questions', label: 'Questions', kind: 'textarea', required: true,
                  hint: 'One per line: Category | Question | weight 1 to 5 (optional) | guidance (optional)' },
              ]} />
          )}
        </div>
      </header>

      <section aria-label="Audit summary" className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="rounded border border-line bg-white p-6">
          <ComplianceScoreCard score={stats.avgScore} size="lg" showLabel />
          <p className="mt-3 text-sm text-steel">Average compliance across {stats.completed} completed audit{stats.completed === 1 ? '' : 's'} in the last 12 months.</p>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line">
          <div className="bg-white p-4">
            <dt className="text-sm text-steel">Audits conducted</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{stats.completed}</dd>
            <dd className="text-xs text-steel">last 12 months</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-sm text-steel">Open NCRs</dt>
            <dd className={`mt-1 font-display text-3xl font-semibold ${stats.openNcrs ? 'text-noncompliant' : ''}`}>
              <Link href="/audits?view=ncrs" className="hover:underline">{stats.openNcrs}</Link>
            </dd>
            <dd className="text-xs text-steel">open or awaiting action closure</dd>
          </div>
          <div className="bg-white p-4">
            <dt className="text-sm text-steel">Overdue inspections</dt>
            <dd className={`mt-1 font-display text-3xl font-semibold ${stats.overdue ? 'text-noncompliant' : ''}`}>
              <Link href="/audits?status=OVERDUE" className="hover:underline">{stats.overdue}</Link>
            </dd>
            <dd className="text-xs text-steel">scheduled date has passed</dd>
          </div>
        </dl>
      </section>

      <nav aria-label="Register view" className="flex gap-2 border-b border-line">
        <Link href={tabHref('inspections')} aria-current={view === 'inspections' ? 'page' : undefined} className={tabCls(view === 'inspections')}>Inspections</Link>
        <Link href={tabHref('ncrs')} aria-current={view === 'ncrs' ? 'page' : undefined} className={tabCls(view === 'ncrs')}>Open NCRs</Link>
      </nav>

      {view === 'inspections' && list && (
        <>
          <UrlFilters fields={FIELDS} ariaLabel="Filter inspections" />
          <InspectionTable rows={list.rows} viewerId={user.id} canExecute={canExecute} isManager={isManager} sp={searchParams}
            emptyMessage={hasFilters ? 'No inspections match these filters.' : 'No inspections yet. Schedule the first one from a checklist.'} />
          <Pagination page={list.page} pageCount={list.pageCount} total={list.total} pageSize={list.pageSize} hrefFor={hrefFor} />
        </>
      )}

      {view === 'ncrs' && ncrs && (
        ncrs.length === 0 ? (
          <div className="rounded border border-line bg-white px-4 py-12 text-center text-sm text-steel">No open non-conformance reports.</div>
        ) : (
          <ul className="space-y-3">
            {ncrs.map((n) => (
              <li key={n.id} className="space-y-2 rounded border border-line bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{n.referenceNo}</span>
                  <NcrSeverityBadge severity={n.severity} />
                  <NcrStatusBadge status={n.status} />
                  <span className="text-xs text-steel">{fmtDayInZone(n.createdAt, site.timezone)}</span>
                </div>
                <p className="text-sm">{n.summary}</p>
                <p className="text-xs text-steel">
                  From <Link href={`/audits/${n.inspectionId}`} className="font-medium text-plant underline">{n.inspectionRef}</Link>
                  {n.capaRef ? `, action ${n.capaRef}` : ''}
                  {!n.capaRef && n.status === 'OPEN' && <span className="ml-2 font-medium text-noncompliant">Action needed</span>}
                </p>
              </li>
            ))}
          </ul>
        )
      )}

      {exec && mayExecute && <InspectionExecutionDrawer data={exec} />}
    </div>
  );
}
