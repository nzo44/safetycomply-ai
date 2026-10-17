import { updatePermitStatus } from '@/actions/permits/permits';
import { ActionPanel } from '@/components/ui/action-panel';
import { fmtDateTime } from '@/lib/utils';
import type { PermitRow } from '@/types/permits';
import { PermitStatusBadge, PermitTypeTag } from './badges';

export interface PermitTableProps {
  rows: PermitRow[];
  userId: string;
  isAdmin: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canOperate: boolean;
  timeZone: string;
  emptyMessage: string;
}

function RowActions({ row, userId, isAdmin, canRequest, canApprove, canOperate }: Omit<PermitTableProps, 'rows' | 'timeZone' | 'emptyMessage'> & { row: PermitRow }) {
  const hidden = (toStatus: string) => ({ permitId: row.id, toStatus });
  const reason = [{ name: 'note', label: 'Reason', kind: 'textarea' as const, required: true }];
  const canDecide = canApprove && (isAdmin || row.requestedById !== userId);
  const expired = row.displayStatus === 'EXPIRED';

  return (
    <div className="flex flex-wrap items-start gap-2">
      {row.status === 'REQUESTED' && (
        <>
          {canDecide && <ActionPanel immediate action={updatePermitStatus} label="Approve" hidden={hidden('APPROVED')} />}
          {canDecide && (
            <ActionPanel tone="danger" action={updatePermitStatus} label="Reject" submitLabel="Reject permit"
              hidden={hidden('REJECTED')} fields={reason} />
          )}
          {canRequest && (
            <ActionPanel tone="danger" action={updatePermitStatus} label="Cancel" submitLabel="Cancel permit"
              hidden={hidden('CANCELLED')} fields={reason} />
          )}
        </>
      )}
      {row.status === 'APPROVED' && canOperate && (
        <>
          {!expired && <ActionPanel immediate action={updatePermitStatus} label="Start work" hidden={hidden('IN_PROGRESS')} />}
          <ActionPanel tone="danger" action={updatePermitStatus} label="Cancel" submitLabel="Cancel permit"
            hidden={hidden('CANCELLED')} fields={reason} />
        </>
      )}
      {row.status === 'IN_PROGRESS' && canOperate && (
        <ActionPanel action={updatePermitStatus} label="Close out" submitLabel="Close permit"
          hidden={hidden('CLOSED')}
          intro="Confirm the area is left safe and isolations are removed."
          fields={[{ name: 'note', label: 'Close-out notes', kind: 'textarea', required: true }]} />
      )}
    </div>
  );
}

export function PermitTable(props: PermitTableProps) {
  const { rows, timeZone, emptyMessage } = props;
  if (rows.length === 0) {
    return <div className="rounded border border-line bg-white px-4 py-12 text-center text-sm text-steel">{emptyMessage}</div>;
  }

  const note = (r: PermitRow) => r.closeoutNotes ?? r.statusNote;

  return (
    <>
      <div className="hidden overflow-x-auto rounded border border-line bg-white md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <caption className="sr-only">Permits to work</caption>
          <thead className="border-b border-line bg-canvas text-steel">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Permit</th>
              <th scope="col" className="px-3 py-2 font-medium">Type</th>
              <th scope="col" className="px-3 py-2 font-medium">Valid</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">People</th>
              <th scope="col" className="min-w-[170px] px-3 py-2 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-canvas/60">
                <td className="max-w-[18rem] px-3 py-2">
                  <p className="font-medium">{r.permitCode}: {r.title}</p>
                  <p className="text-xs text-steel">{r.location}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-steel hover:text-ink">Hazards and precautions</summary>
                    <p className="mt-1 text-xs"><span className="font-medium">Hazards:</span> {r.hazards}</p>
                    <p className="mt-1 text-xs"><span className="font-medium">Precautions:</span> {r.precautions}</p>
                  </details>
                </td>
                <td className="px-3 py-2"><PermitTypeTag type={r.type} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  <p>{fmtDateTime(r.validFrom, timeZone)}</p>
                  <p className="text-steel">to {fmtDateTime(r.validTo, timeZone)}</p>
                </td>
                <td className="px-3 py-2">
                  <PermitStatusBadge status={r.displayStatus} />
                  {note(r) && <p className="mt-1 max-w-[14rem] text-xs text-steel">{note(r)}</p>}
                </td>
                <td className="px-3 py-2 text-xs">
                  <p>Requested by {r.requestedByName}</p>
                  {r.approvedByName && <p className="text-steel">Approved by {r.approvedByName}</p>}
                  {r.workers && <p className="text-steel">Crew: {r.workers}</p>}
                </td>
                <td className="px-3 py-2"><RowActions row={r} {...props} /></td>
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
                <p className="font-medium">{r.permitCode}: {r.title}</p>
                <p className="text-xs text-steel">{r.location}</p>
              </div>
              <PermitStatusBadge status={r.displayStatus} />
            </div>
            <PermitTypeTag type={r.type} />
            <p className="text-xs text-steel">{fmtDateTime(r.validFrom, timeZone)} to {fmtDateTime(r.validTo, timeZone)}</p>
            <p className="text-xs"><span className="font-medium">Hazards:</span> {r.hazards}</p>
            <p className="text-xs"><span className="font-medium">Precautions:</span> {r.precautions}</p>
            {note(r) && <p className="border-l-2 border-line pl-3 text-xs text-steel">{note(r)}</p>}
            <p className="text-xs text-steel">Requested by {r.requestedByName}{r.approvedByName && `, approved by ${r.approvedByName}`}</p>
            <RowActions row={r} {...props} />
          </li>
        ))}
      </ul>
    </>
  );
}
