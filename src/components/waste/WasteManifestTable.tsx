import Link from 'next/link';
import { Scale } from 'lucide-react';
import { updateManifestStatus } from '@/actions/waste/manifests';
import { EvidenceLinks } from '@/components/compliance/chips';
import { ActionPanel } from '@/components/ui/action-panel';
import { withParams, type SearchParams } from '@/lib/data/params';
import { fmtDayInZone, fmtKg } from '@/lib/utils';
import { DISPOSAL_LABEL } from '@/lib/waste/meta';
import type { WasteManifestRow } from '@/types/waste';
import { ManifestStatusBadge, WasteTypeTag } from './badges';

export interface WasteManifestTableProps {
  rows: WasteManifestRow[];
  canLog: boolean;
  canWeigh: boolean;
  /** Current URL params, so row links keep the active filters and page. */
  sp: SearchParams;
  timeZone: string;
  emptyMessage: string;
}

function WeightCell({ row }: { row: WasteManifestRow }) {
  if (row.netWeightKg !== null) {
    return (
      <>
        <span className="font-medium">{fmtKg(row.netWeightKg)} kg</span>
        <span className="block text-xs text-steel">net{row.estimatedWeightKg !== null && `, est. ${fmtKg(row.estimatedWeightKg)}`}</span>
      </>
    );
  }
  if (row.estimatedWeightKg !== null) {
    return <><span>{fmtKg(row.estimatedWeightKg)} kg</span><span className="block text-xs text-steel">estimated</span></>;
  }
  return <span className="text-steel">—</span>;
}

function TicketCell({ row }: { row: WasteManifestRow }) {
  if (!row.ticketNo) return <span className="text-steel">—</span>;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{row.ticketNo}</p>
      <EvidenceLinks urls={row.evidenceUrls} />
    </div>
  );
}

function RowActions({ row, canLog, canWeigh, sp }: { row: WasteManifestRow; canLog: boolean; canWeigh: boolean; sp: SearchParams }) {
  const open = row.status === 'DISPATCHED' || row.status === 'IN_TRANSIT';
  if (!open || (!canLog && !canWeigh)) return null;
  const reason = [{ name: 'note', label: 'Reason', kind: 'textarea' as const, required: true }];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        {canWeigh && (
          <Link
            href={withParams(sp, { discharge: row.id, new: undefined })}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded bg-plant px-2.5 py-1 text-xs font-semibold text-white hover:bg-plant/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant"
          >
            <Scale size={14} aria-hidden /> Weigh in<span className="sr-only"> {row.manifestCode}</span>
          </Link>
        )}
        {canLog && row.status === 'DISPATCHED' && (
          <ActionPanel immediate action={updateManifestStatus} label="Mark in transit"
            hidden={{ manifestId: row.id, toStatus: 'IN_TRANSIT' }} />
        )}
      </div>
      {canLog && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-steel hover:text-ink">More</summary>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            <ActionPanel tone="danger" action={updateManifestStatus} label="Reject load" submitLabel="Reject load"
              hidden={{ manifestId: row.id, toStatus: 'REJECTED' }} fields={reason}
              intro="Use when the destination refuses the load." />
            <ActionPanel tone="danger" action={updateManifestStatus} label="Cancel manifest" submitLabel="Cancel manifest"
              hidden={{ manifestId: row.id, toStatus: 'CANCELLED' }} fields={reason} />
          </div>
        </details>
      )}
    </div>
  );
}

export function WasteManifestTable({ rows, canLog, canWeigh, sp, timeZone, emptyMessage }: WasteManifestTableProps) {
  if (rows.length === 0) {
    return <div className="rounded border border-line bg-white px-4 py-12 text-center text-sm text-steel">{emptyMessage}</div>;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded border border-line bg-white md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <caption className="sr-only">Waste manifests</caption>
          <thead className="border-b border-line bg-canvas text-steel">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Manifest</th>
              <th scope="col" className="px-3 py-2 font-medium">Waste</th>
              <th scope="col" className="px-3 py-2 font-medium">Transporter and destination</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Dispatched</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Weight</th>
              <th scope="col" className="px-3 py-2 font-medium">Ticket and evidence</th>
              <th scope="col" className="min-w-[170px] px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-canvas/60">
                <td className="max-w-[16rem] px-3 py-2">
                  <p className="font-medium">{r.manifestCode}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-steel">{r.description}</p>
                </td>
                <td className="px-3 py-2"><WasteTypeTag type={r.wasteType} /></td>
                <td className="max-w-[15rem] px-3 py-2">
                  <p>{r.transporterName}</p>
                  <p className="text-xs text-steel">to {r.destinationFacility}</p>
                  <p className="text-xs text-steel">{DISPOSAL_LABEL[r.disposalMethod]}</p>
                </td>
                <td className="px-3 py-2">
                  <ManifestStatusBadge status={r.status} />
                  {r.statusNote && <p className="mt-1 max-w-[14rem] text-xs text-steel">{r.statusNote}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{fmtDayInZone(r.dispatchedAt, timeZone)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums"><WeightCell row={r} /></td>
                <td className="px-3 py-2"><TicketCell row={r} /></td>
                <td className="px-3 py-2"><RowActions row={r} canLog={canLog} canWeigh={canWeigh} sp={sp} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="space-y-3 rounded border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{r.manifestCode}</p>
                <p className="text-xs text-steel">{r.description}</p>
              </div>
              <ManifestStatusBadge status={r.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <WasteTypeTag type={r.wasteType} />
              <span className="text-xs text-steel">{DISPOSAL_LABEL[r.disposalMethod]}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-steel">Transporter</dt><dd className="font-medium">{r.transporterName}</dd></div>
              <div><dt className="text-steel">Destination</dt><dd className="font-medium">{r.destinationFacility}</dd></div>
              <div><dt className="text-steel">Dispatched</dt><dd className="font-medium">{fmtDayInZone(r.dispatchedAt, timeZone)}</dd></div>
              <div><dt className="text-steel">Weight</dt><dd className="font-medium"><WeightCell row={r} /></dd></div>
            </dl>
            {r.statusNote && <p className="border-l-2 border-line pl-3 text-xs text-steel">{r.statusNote}</p>}
            {r.ticketNo && <TicketCell row={r} />}
            <RowActions row={r} canLog={canLog} canWeigh={canWeigh} sp={sp} />
          </li>
        ))}
      </ul>
    </>
  );
}
