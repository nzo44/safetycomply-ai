import Link from 'next/link';
import { Plus } from 'lucide-react';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import { getComplianceStats, getMatrix, parseFilters, toMatrixRow } from '@/lib/data/compliance';
import type { SearchParams } from '@/lib/data/params';
import { StatusBar } from '@/components/compliance/status-bar';
import { ExportLink } from '@/components/ui/export-link';
import { CategoryChart } from '@/components/compliance/category-chart';
import { ComplianceFilterBar } from '@/components/compliance/ComplianceFilterBar';
import { ComplianceWorkspace } from '@/components/compliance/ComplianceWorkspace';

export default async function CompliancePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireModule('compliance');
  const site = await getActiveSite(user);
  if (!site) {
    return <p className="text-sm text-steel">No site is assigned to your account. Ask an administrator to add you to a site.</p>;
  }

  const filters = parseFilters(searchParams);
  const [stats, rawRows] = await Promise.all([getComplianceStats(site.id), getMatrix(site.id, filters)]);
  const rows = rawRows.map(toMatrixRow);
  const hasFilters = Boolean(filters.q || filters.category || filters.status || filters.risk || filters.overdue);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Legal compliance matrix</h1>
          <p className="mt-1 text-sm text-steel">{site.name} ({site.code})</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <ExportLink register="compliance" searchParams={searchParams} />
        {can(user.role, 'requirement:write') && (
          <Link href="/compliance/new" className="inline-flex items-center gap-2 rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90">
            <Plus size={16} aria-hidden /> Add requirement
          </Link>
        )}
        </div>
      </header>

      <section aria-label="Compliance summary" className="grid gap-6 rounded border border-line bg-white p-6 lg:grid-cols-[200px_1fr]">
        <div>
          <p className="font-display text-6xl font-semibold leading-none">{stats.rate === null ? '—' : `${stats.rate}%`}</p>
          <p className="mt-2 text-sm text-steel" title="Compliant counts 1, partially compliant 0.5. Not applicable and pending review are excluded.">
            weighted compliance rate
          </p>
          <p className="mt-4 text-sm">
            <Link href="/compliance?overdue=1" className="font-medium text-noncompliant hover:underline">{stats.overdue} reviews overdue</Link>
            <br />
            <span className="text-steel">{stats.dueSoon} due in the next 30 days</span>
          </p>
        </div>
        <div className="space-y-6">
          <StatusBar counts={stats.counts} total={stats.total} />
          <CategoryChart data={stats.byCategory} />
        </div>
      </section>

      <ComplianceFilterBar />

      <p className="text-sm text-steel" aria-live="polite">
        Showing {rows.length} of {stats.total} requirements
      </p>

      <ComplianceWorkspace
        rows={rows}
        canAudit={can(user.role, 'audit:write')}
        emptyMessage={
          hasFilters
            ? 'No requirements match these filters.'
            : 'No requirements yet. Add the first one to start tracking compliance.'
        }
      />
    </div>
  );
}
