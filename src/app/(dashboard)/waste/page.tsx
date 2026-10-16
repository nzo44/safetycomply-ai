import Link from 'next/link';
import { Truck } from 'lucide-react';
import { updateLandfillCapacity } from '@/actions/waste/capacity';
import { ActionPanel } from '@/components/ui/action-panel';
import { Pagination } from '@/components/ui/pagination';
import { UrlFilters, type FilterField } from '@/components/ui/url-filters';
import { ExportLink } from '@/components/ui/export-link';
import { DischargeFormModal } from '@/components/waste/DischargeFormModal';
import { LandfillCapacityGauge } from '@/components/waste/LandfillCapacityGauge';
import { WasteManifestModal } from '@/components/waste/WasteManifestModal';
import { WasteManifestTable } from '@/components/waste/WasteManifestTable';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, requireUser } from '@/lib/auth/session';
import { getDischargeTarget, getWasteAnalytics, getWasteManifests, parseManifestParams } from '@/lib/data/waste';
import { one, withParams, type SearchParams } from '@/lib/data/params';
import { toOptions } from '@/lib/incidents-meta';
import { fmtTons, toZonedLocalInput } from '@/lib/utils';
import { HAZARDOUS_TYPES, MANIFEST_STATUS_LABEL, WASTE_TYPE_LABEL } from '@/lib/waste/meta';

const FIELDS: FilterField[] = [
  { kind: 'search', key: 'q', label: 'Search', placeholder: 'Manifest code or transporter' },
  { kind: 'select', key: 'wasteType', label: 'Waste type', allLabel: 'All types', options: toOptions(WASTE_TYPE_LABEL) },
  { kind: 'select', key: 'status', label: 'Status', allLabel: 'All statuses', options: toOptions(MANIFEST_STATUS_LABEL) },
];

export default async function WastePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const site = await getActiveSite(user);
  if (!site) {
    return <p className="text-sm text-steel">No site is assigned to your account. Ask an administrator to add you to a site.</p>;
  }

  const params = parseManifestParams(searchParams);
  const [analytics, list] = await Promise.all([getWasteAnalytics(site.id), getWasteManifests(site.id, params)]);

  const canLog = can(user.role, 'waste:log');
  const canWeigh = can(user.role, 'waste:weigh');
  const canConfigure = can(user.role, 'waste:capacity');

  // URL-driven drawers: rendered only while their param is present, so closing unmounts them.
  const showNew = canLog && one(searchParams, 'new') === '1';
  const dischargeId = canWeigh ? one(searchParams, 'discharge') : undefined;
  const dischargeTarget = dischargeId ? await getDischargeTarget(dischargeId, site.id) : null;
  const nowLocal = toZonedLocalInput(new Date(), site.timezone);

  // Header metrics (current month)
  const hazTons = analytics.byType.filter((t) => HAZARDOUS_TYPES.includes(t.wasteType)).reduce((s, t) => s + t.tons, 0);
  const nonHazTons = analytics.byType.filter((t) => !HAZARDOUS_TYPES.includes(t.wasteType)).reduce((s, t) => s + t.tons, 0);
  const totalTons = hazTons + nonHazTons;
  const hazShare = totalTons > 0 ? (hazTons / totalTons) * 100 : 0;
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: site.timezone }).format(analytics.periodStart);

  const hasFilters = Boolean(params.q || params.wasteType || params.status);
  const hrefFor = (p: number) =>
    withParams(searchParams, { page: p > 1 ? String(p) : undefined, new: undefined, discharge: undefined });

  const capacityPanel = canConfigure ? (
    <ActionPanel
      action={updateLandfillCapacity}
      label={analytics.landfill ? 'Adjust capacity' : 'Set up capacity'}
      submitLabel="Save capacity"
      hidden={{ siteId: site.id }}
      intro="Day-to-day volume updates automatically when landfill loads are weighed in. Adjust it here only to reconcile, for example after a survey."
      fields={[
        { name: 'totalCapacityTons', label: 'Total capacity (tons)', kind: 'number', required: true, min: '0.001', step: '0.001',
          defaultValue: analytics.landfill?.totalTons.toString() },
        { name: 'currentVolumeTons', label: 'Current volume (tons)', kind: 'number', required: true, min: '0', step: '0.001',
          defaultValue: (analytics.landfill?.currentTons ?? 0).toString(),
          hint: 'Changing an existing volume needs a reason.' },
        { name: 'reason', label: 'Reason for adjusting', kind: 'text' },
      ]}
    />
  ) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Waste and discharge</h1>
          <p className="mt-1 text-sm text-steel">{site.name} ({site.code})</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <ExportLink register="waste" searchParams={searchParams} />
        {canLog && (
          <Link href={withParams(searchParams, { new: '1', discharge: undefined })} scroll={false}
            className="inline-flex items-center gap-2 rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant">
            <Truck size={16} aria-hidden /> Log shipment
          </Link>
        )}
        </div>
      </header>

      <section aria-label="Waste summary" className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5 rounded border border-line bg-white p-6">
          <h2 className="font-display text-lg font-semibold">Discharged in {month}</h2>
          <dl className="grid gap-6 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-steel">Hazardous</dt>
              <dd className="font-display text-4xl font-semibold text-noncompliant">{fmtTons(hazTons)}<span className="ml-1 text-lg font-medium text-steel">t</span></dd>
            </div>
            <div>
              <dt className="text-sm text-steel">Non-hazardous</dt>
              <dd className="font-display text-4xl font-semibold">{fmtTons(nonHazTons)}<span className="ml-1 text-lg font-medium text-steel">t</span></dd>
            </div>
            <div>
              <dt className="text-sm text-steel">Active manifests</dt>
              <dd className="font-display text-4xl font-semibold">{analytics.pendingTransit}</dd>
              <dd className="text-xs text-steel">dispatched or in transit</dd>
            </div>
          </dl>

          {totalTons > 0 ? (
            <div>
              <div className="flex h-3 overflow-hidden rounded-sm bg-line" role="img"
                aria-label={`Hazardous ${hazShare.toFixed(0)}%, non-hazardous ${(100 - hazShare).toFixed(0)}% of this month's tonnage`}>
                <div style={{ width: `${hazShare}%`, backgroundColor: '#B3261E' }} />
                <div style={{ width: `${100 - hazShare}%`, backgroundColor: '#4B5966' }} />
              </div>
              <p className="mt-2 text-xs text-steel">
                {hazShare.toFixed(0)}% hazardous, {(100 - hazShare).toFixed(0)}% non-hazardous, by net weight across {analytics.byType.reduce((s, t) => s + t.loads, 0)} loads.
                Non-hazardous includes recyclable, inert, sludge and e-waste.
              </p>
            </div>
          ) : (
            <p className="text-sm text-steel">Nothing has been weighed in this month yet.</p>
          )}
        </div>

        <LandfillCapacityGauge
          landfill={analytics.landfill}
          timeZone={site.timezone}
          footer={capacityPanel}
          emptyHint={canConfigure ? 'Set the total capacity and current volume so landfill loads can be weighed in.' : 'Landfill capacity has not been set up. Ask an HSE manager to configure it.'}
        />
      </section>

      <UrlFilters fields={FIELDS} ariaLabel="Filter manifests" />

      {dischargeId && !dischargeTarget && (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded border border-line bg-white px-4 py-3 text-sm">
          That manifest was not found at this site.
          <Link href={withParams(searchParams, { discharge: undefined })} scroll={false} className="text-plant underline">Dismiss</Link>
        </p>
      )}

      <WasteManifestTable
        rows={list.rows}
        canLog={canLog}
        canWeigh={canWeigh}
        sp={searchParams}
        timeZone={site.timezone}
        emptyMessage={
          hasFilters
            ? 'No manifests match these filters.'
            : 'No manifests yet. Log the first outgoing shipment to start tracking waste.'
        }
      />

      <Pagination page={list.page} pageCount={list.pageCount} total={list.total} pageSize={list.pageSize} hrefFor={hrefFor} />

      {showNew && <WasteManifestModal siteId={site.id} nowLocal={nowLocal} />}
      {dischargeTarget && (
        <DischargeFormModal
          manifest={dischargeTarget}
          landfill={analytics.landfill ? { totalTons: analytics.landfill.totalTons, currentTons: analytics.landfill.currentTons } : null}
          nowLocal={nowLocal}
        />
      )}
    </div>
  );
}
