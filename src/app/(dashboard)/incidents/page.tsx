import Link from 'next/link';
import { Plus, ListChecks } from 'lucide-react';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireUser } from '@/lib/auth/session';
import { getCapaStats } from '@/lib/data/capa';
import { getIncidents, getIncidentStats, parseIncidentFilters } from '@/lib/data/incidents';
import type { SearchParams } from '@/lib/data/params';
import {
  INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, SEVERITY_LABEL, SEVERITY_ORDER, toOptions,
} from '@/lib/incidents-meta';
import { fmtDateTime } from '@/lib/utils';
import { IncidentStatusBadge, SeverityBadge } from '@/components/incidents/badges';
import { UrlFilters, type FilterField } from '@/components/ui/url-filters';
import { ExportLink } from '@/components/ui/export-link';

const FIELDS: FilterField[] = [
  { kind: 'search', key: 'q', label: 'Search', placeholder: 'Reference, title or location' },
  { kind: 'select', key: 'type', label: 'Type', allLabel: 'All types', options: toOptions(INCIDENT_TYPE_LABEL) },
  { kind: 'select', key: 'severity', label: 'Severity', allLabel: 'All severities',
    options: SEVERITY_ORDER.map((s) => ({ value: s, label: SEVERITY_LABEL[s] })) },
  { kind: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: toOptions(INCIDENT_STATUS_LABEL) },
  { kind: 'checkbox', key: 'open', label: 'Open only' },
];

export default async function IncidentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const site = await getActiveSite(user);
  if (!site) return <p className="text-sm text-steel">No site is assigned to your account. Ask an administrator to add you to a site.</p>;

  const filters = parseIncidentFilters(searchParams);
  const [stats, capa, rows] = await Promise.all([
    getIncidentStats(site.id), getCapaStats(site.id), getIncidents(site.id, filters),
  ]);
  const hasFilters = Boolean(filters.q || filters.status || filters.severity || filters.type || filters.openOnly);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Incidents and corrective actions</h1>
          <p className="mt-1 text-sm text-steel">{site.name} ({site.code})</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ExportLink register="incidents" searchParams={searchParams} />
          <Link href="/incidents/capa" className="inline-flex items-center gap-2 rounded border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-canvas">
            <ListChecks size={16} aria-hidden /> Action board
          </Link>
          {can(user.role, 'incident:report') && (
            <Link href="/incidents/new" className="inline-flex items-center gap-2 rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90">
              <Plus size={16} aria-hidden /> Report incident
            </Link>
          )}
        </div>
      </header>

      <section aria-label="Safety summary" className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="rounded bg-ink p-6 text-white">
          <p className="font-display text-7xl font-bold leading-none">{stats.daysSinceLastLti ?? '—'}</p>
          <p className="mt-3 text-sm text-white/80">
            {stats.daysSinceLastLti === null ? 'No lost-time incident recorded' : 'days without a lost-time incident'}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4">
          {[
            ['Open incidents', stats.open, '/incidents?open=1'],
            ['Under investigation', stats.underInvestigation, '/incidents?status=UNDER_INVESTIGATION'],
            ['Overdue actions', capa.overdue, '/incidents/capa?overdue=1'],
            ['Recordable this year', stats.recordableYtd, null],
          ].map(([label, value, href]) => (
            <div key={label as string} className="bg-white p-4">
              <dt className="text-sm text-steel">{label}</dt>
              <dd className={`mt-1 font-display text-3xl font-semibold ${label === 'Overdue actions' && (value as number) > 0 ? 'text-noncompliant' : ''}`}>
                {href ? <Link href={href as string} className="hover:underline">{value}</Link> : value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <UrlFilters fields={FIELDS} ariaLabel="Filter incidents" />

      <div className="overflow-x-auto rounded border border-line bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-steel">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Incident</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Severity</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Occurred</th>
              <th scope="col" className="px-4 py-3 font-medium">Open actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-steel">
                {hasFilters ? 'No incidents match these filters.' : 'No incidents reported. Report one as soon as it happens, including near misses.'}
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-canvas/60">
                <td className="max-w-md px-4 py-3">
                  <Link href={`/incidents/${r.id}`} className="font-medium text-plant hover:underline">{r.title}</Link>
                  <p className="mt-0.5 text-xs text-steel">{r.referenceNo}{r.location ? `, ${r.location}` : ''}</p>
                  {(r.isRecordable || r.isReportableToAuthority) && (
                    <p className="mt-1 flex gap-2 text-xs font-medium text-steel">
                      {r.isRecordable && <span className="rounded border border-line px-1.5">Recordable</span>}
                      {r.isReportableToAuthority && <span className="rounded border border-line px-1.5">Reportable</span>}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">{INCIDENT_TYPE_LABEL[r.type]}</td>
                <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>
                <td className="px-4 py-3"><IncidentStatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap px-4 py-3">{fmtDateTime(r.occurredAt, site.timezone)}</td>
                <td className="px-4 py-3">{r._count.capaActions || <span className="text-steel">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
