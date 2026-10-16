import Link from 'next/link';
import { createAssessment } from '@/actions/risk/assessments';
import { AssessmentStatusBadge, ReviewOverdueTag, RiskLevelChip } from '@/components/risk/badges';
import { ActionPanel } from '@/components/ui/action-panel';
import { UrlFilters, type FilterField } from '@/components/ui/url-filters';
import { ExportLink } from '@/components/ui/export-link';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireUser } from '@/lib/auth/session';
import type { SearchParams } from '@/lib/data/params';
import { getAssessments, getRiskStats, parseRiskFilters } from '@/lib/data/risk';
import { toOptions } from '@/lib/incidents-meta';
import { LEVEL_META } from '@/lib/risk/matrix';
import { ASSESSMENT_TYPE_LABEL } from '@/lib/risk/workflow';
import { fmtDate } from '@/lib/utils';

const levelOptions = (Object.keys(LEVEL_META) as (keyof typeof LEVEL_META)[]).map((k) => ({ value: k, label: LEVEL_META[k].label }));

const FIELDS: FilterField[] = [
  { kind: 'search', key: 'q', label: 'Search', placeholder: 'Reference, title, activity or area' },
  { kind: 'select', key: 'type', label: 'Type', allLabel: 'All types', options: toOptions({ JSA: 'JSA', HIRA: 'HIRA' }) },
  { kind: 'select', key: 'status', label: 'Status', allLabel: 'Active (not archived)',
    options: toOptions({ DRAFT: 'Draft', IN_REVIEW: 'In review', APPROVED: 'Approved', ARCHIVED: 'Archived' }) },
  { kind: 'select', key: 'level', label: 'Highest risk', allLabel: 'All levels', options: levelOptions },
  { kind: 'checkbox', key: 'overdue', label: 'Review overdue' },
];

export default async function RiskPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const site = await getActiveSite(user);
  if (!site) return <p className="text-sm text-steel">No site is assigned to your account. Ask an administrator to add you to a site.</p>;

  const filters = parseRiskFilters(searchParams);
  const [stats, rows] = await Promise.all([getRiskStats(site.id), getAssessments(site.id, filters)]);
  const hasFilters = Boolean(filters.q || filters.type || filters.status || filters.level || filters.overdue);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Risk assessments</h1>
          <p className="mt-1 text-sm text-steel">{site.name} ({site.code})</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
        <ExportLink register="risk" searchParams={searchParams} />
        {can(user.role, 'risk:write') && (
          <ActionPanel action={createAssessment} label="New assessment" submitLabel="Create assessment"
            intro="Start with the task or process. You add hazards and rate the risk on the next screen."
            fields={[
              { name: 'title', label: 'Title', kind: 'text', required: true },
              { name: 'type', label: 'Type', kind: 'select', required: true, options: toOptions(ASSESSMENT_TYPE_LABEL),
                hint: 'A JSA breaks one job into steps. A HIRA registers hazards across an area or process.' },
              { name: 'activity', label: 'Task or process assessed', kind: 'text', required: true },
              { name: 'area', label: 'Area or department', kind: 'text' },
              { name: 'scope', label: 'Scope', kind: 'textarea' },
              { name: 'teamMembers', label: 'Assessment team', kind: 'textarea', hint: 'One name per line.' },
            ]} />
        )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4">
        {([
          ['Approved', stats.approved, '/risk?status=APPROVED', false],
          ['Awaiting review', stats.inReview, '/risk?status=IN_REVIEW', false],
          ['Reviews overdue', stats.overdue, '/risk?overdue=1', stats.overdue > 0],
          ['High residual hazards', stats.openHigh, '/risk?level=HIGH&status=APPROVED', stats.openHigh > 0],
        ] as const).map(([label, value, href, alert]) => (
          <div key={label} className="bg-white p-4">
            <dt className="text-sm text-steel">{label}</dt>
            <dd className={`mt-1 font-display text-3xl font-semibold ${alert ? 'text-noncompliant' : ''}`}>
              <Link href={href} className="hover:underline">{value}</Link>
            </dd>
          </div>
        ))}
      </dl>

      <UrlFilters fields={FIELDS} ariaLabel="Filter assessments" />

      <div className="overflow-x-auto rounded border border-line bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Risk assessments</caption>
          <thead className="border-b border-line bg-canvas text-steel">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Assessment</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Highest risk</th>
              <th scope="col" className="px-4 py-3 font-medium">Hazards</th>
              <th scope="col" className="px-4 py-3 font-medium">Next review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-steel">
                {hasFilters ? 'No assessments match these filters.' : 'No risk assessments yet. Create one for a task or process that has not been assessed.'}
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-canvas/60">
                <td className="max-w-md px-4 py-3">
                  <Link href={`/risk/${r.id}`} className="font-medium text-plant hover:underline">{r.title}</Link>
                  <p className="mt-0.5 text-xs text-steel">{r.referenceNo}, version {r.version}{r.area ? `, ${r.area}` : ''}</p>
                </td>
                <td className="px-4 py-3">{r.type}</td>
                <td className="px-4 py-3"><AssessmentStatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  {r.peakResidual ? <><RiskLevelChip level={r.peakResidual} /><p className="mt-1 text-xs text-steel">after controls</p></>
                    : r.peakInitial ? <><RiskLevelChip level={r.peakInitial} /><p className="mt-1 text-xs text-steel">before controls</p></>
                    : <span className="text-steel">Not rated</span>}
                </td>
                <td className="px-4 py-3">{r.hazardCount}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {fmtDate(r.nextReviewDate)}
                  {r.reviewOverdue && <span className="block"><ReviewOverdueTag /></span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
