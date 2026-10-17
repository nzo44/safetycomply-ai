import Link from 'next/link';
import { FileCheck } from 'lucide-react';
import { PermitModal } from '@/components/permits/PermitModal';
import { PermitTable } from '@/components/permits/PermitTable';
import { ExportLink } from '@/components/ui/export-link';
import { Pagination } from '@/components/ui/pagination';
import { UrlFilters, type FilterField } from '@/components/ui/url-filters';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import { getPermits, getPermitSummary, parsePermitParams } from '@/lib/data/permits';
import { one, withParams, type SearchParams } from '@/lib/data/params';
import { toOptions } from '@/lib/incidents-meta';
import { PERMIT_STATUS_LABEL, PERMIT_TYPE_LABEL } from '@/lib/permits/meta';
import { toZonedLocalInput } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const FIELDS: FilterField[] = [
  { kind: 'search', key: 'q', label: 'Search', placeholder: 'Code, title or location' },
  { kind: 'select', key: 'type', label: 'Type', allLabel: 'All types', options: toOptions(PERMIT_TYPE_LABEL) },
  { kind: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: toOptions(PERMIT_STATUS_LABEL) },
];

export default async function PermitsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireModule('permits');
  const site = await getActiveSite(user);
  if (!site) {
    return <p className="text-sm text-steel">No site is assigned to your account. Ask an administrator to add you to a site.</p>;
  }

  const params = parsePermitParams(searchParams);
  const [summary, list] = await Promise.all([getPermitSummary(site.id), getPermits(site.id, params)]);

  const canRequest = can(user.role, 'permit:request');
  const canApprove = can(user.role, 'permit:approve');
  const canOperate = can(user.role, 'permit:operate');
  const showNew = canRequest && one(searchParams, 'new') === '1';
  const now = new Date();
  const hasFilters = Boolean(params.q || params.type || params.status);
  const hrefFor = (p: number) =>
    withParams(searchParams, { page: p > 1 ? String(p) : undefined, new: undefined }, '/permits');

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Permits to work</h1>
          <p className="mt-1 text-sm text-steel">{site.name} ({site.code})</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportLink register="permits" searchParams={searchParams} />
          {canRequest && (
            <Link href={withParams(searchParams, { new: '1' }, '/permits')} scroll={false}
              className="inline-flex items-center gap-2 rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant">
              <FileCheck size={16} aria-hidden /> Request permit
            </Link>
          )}
        </div>
      </header>

      <section aria-label="Permit summary" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-line bg-white p-5">
          <p className="text-sm text-steel">Awaiting approval</p>
          <p className="font-display text-4xl font-semibold">{summary.awaiting}</p>
        </div>
        <div className="rounded border border-line bg-white p-5">
          <p className="text-sm text-steel">Work in progress</p>
          <p className="font-display text-4xl font-semibold">{summary.active}</p>
        </div>
        <div className="rounded border border-line bg-white p-5">
          <p className="text-sm text-steel">Expired, not closed out</p>
          <p className={`font-display text-4xl font-semibold ${summary.expired > 0 ? 'text-noncompliant' : ''}`}>{summary.expired}</p>
        </div>
      </section>

      <UrlFilters fields={FIELDS} ariaLabel="Filter permits" />

      <PermitTable
        rows={list.rows}
        userId={user.id}
        isAdmin={user.role === 'ADMIN'}
        canRequest={canRequest}
        canApprove={canApprove}
        canOperate={canOperate}
        timeZone={site.timezone}
        emptyMessage={hasFilters ? 'No permits match these filters.' : 'No permits yet. Request the first one before starting high-risk work.'}
      />

      <Pagination page={list.page} pageCount={list.pageCount} total={list.total} pageSize={list.pageSize} hrefFor={hrefFor} />

      {showNew && (
        <PermitModal
          siteId={site.id}
          nowLocal={toZonedLocalInput(now, site.timezone)}
          defaultEndLocal={toZonedLocalInput(new Date(now.getTime() + 8 * 3_600_000), site.timezone)}
        />
      )}
    </div>
  );
}
