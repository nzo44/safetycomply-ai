import Link from 'next/link';
import type { CapaStatus } from '@prisma/client';
import { CapaCard } from '@/components/incidents/CapaCard';
import { CapaProvider } from '@/components/incidents/CapaActions';
import { UrlFilters, type FilterField } from '@/components/ui/url-filters';
import { ExportLink } from '@/components/ui/export-link';
import { PRIORITY_LABEL } from '@/lib/compliance-meta';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireModule } from '@/lib/auth/session';
import { getCapaBoard, getCapaStats, parseCapaFilters } from '@/lib/data/capa';
import { getSiteUsersWithRole } from '@/lib/data/incidents';
import type { SearchParams } from '@/lib/data/params';
import { toOptions } from '@/lib/incidents-meta';
import { todayInput } from '@/lib/utils';

const COLUMNS: { status: CapaStatus; title: string; note?: string }[] = [
  { status: 'OPEN', title: 'Open' },
  { status: 'IN_PROGRESS', title: 'In progress' },
  { status: 'PENDING_VERIFICATION', title: 'Pending verification' },
  { status: 'CLOSED', title: 'Closed', note: 'Last 30 days' },
];

export default async function CapaBoardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireModule('incidents');
  const site = await getActiveSite(user);
  if (!site) return <p className="text-sm text-steel">No site is assigned to your account.</p>;

  const filters = parseCapaFilters(searchParams);
  const [cards, stats, people] = await Promise.all([
    getCapaBoard(site.id, filters, user.id), getCapaStats(site.id), getSiteUsersWithRole(site.id),
  ]);

  const fields: FilterField[] = [
    { kind: 'search', key: 'q', label: 'Search', placeholder: 'Reference or title' },
    { kind: 'select', key: 'priority', label: 'Priority', allLabel: 'All priorities', options: toOptions(PRIORITY_LABEL) },
    { kind: 'select', key: 'assignee', label: 'Assignee', allLabel: 'Everyone',
      options: [{ value: 'me', label: 'Assigned to me' }, ...people.map((p) => ({ value: p.id, label: p.fullName }))] },
    { kind: 'checkbox', key: 'overdue', label: 'Overdue only' },
    { kind: 'checkbox', key: 'escalated', label: 'Escalated only' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/incidents" className="text-sm text-steel underline">Back to incidents</Link>
          <h1 className="mt-1 font-display text-3xl font-semibold">Action board</h1>
          <p className="mt-1 text-sm text-steel">{site.name} ({site.code})</p>
        </div>
        <dl className="flex gap-6 text-sm">
          <div><dt className="text-steel">Open</dt><dd className="font-display text-2xl font-semibold">{stats.open}</dd></div>
          <div><dt className="text-steel">Overdue</dt><dd className={`font-display text-2xl font-semibold ${stats.overdue ? 'text-noncompliant' : ''}`}>{stats.overdue}</dd></div>
          <div><dt className="text-steel">Escalated</dt><dd className="font-display text-2xl font-semibold">{stats.escalated}</dd></div>
        </dl>
        <ExportLink register="capa" searchParams={searchParams} />
      </header>

      <UrlFilters fields={fields} ariaLabel="Filter actions" />

      <CapaProvider
        value={{
          viewerId: user.id,
          canManage: can(user.role, 'capa:manage'),
          canVerify: can(user.role, 'capa:verify'),
          people: people.map((p) => ({ value: p.id, label: p.fullName })),
          escalationTargets: people.filter((p) => p.role === 'HSE_MANAGER' || p.role === 'ADMIN').map((p) => ({ value: p.id, label: p.fullName })),
          today: todayInput(),
        }}
      >
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = cards.filter((c) => c.status === col.status);
            return (
              <section key={col.status} aria-label={col.title} className="min-w-0 space-y-3 rounded bg-white/50 p-3">
                <h2 className="flex items-baseline justify-between font-display text-lg font-semibold">
                  {col.title}
                  <span className="text-sm font-normal text-steel">{items.length}{col.note ? `, ${col.note.toLowerCase()}` : ''}</span>
                </h2>
                {items.length === 0
                  ? <p className="px-1 py-4 text-sm text-steel">No actions here.</p>
                  : items.map((c) => <CapaCard key={c.id} capa={c} />)}
              </section>
            );
          })}
        </div>
      </CapaProvider>
    </div>
  );
}
