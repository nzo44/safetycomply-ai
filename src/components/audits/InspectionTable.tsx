import Link from 'next/link';
import { PlayCircle } from 'lucide-react';
import { withParams, type SearchParams } from '@/lib/data/params';
import { fmtDate } from '@/lib/utils';
import type { InspectionRow } from '@/types/audits';
import { InspectionStatusBadge, StandardTag } from './badges';
import { ComplianceScoreCard } from './ComplianceScoreCard';

export interface InspectionTableProps {
  rows: InspectionRow[];
  viewerId: string;
  canExecute: boolean;   // has the execute permission at all
  isManager: boolean;    // can work on any inspection
  sp: SearchParams;
  emptyMessage: string;
}

function Progress({ r }: { r: InspectionRow }) {
  if (r.status === 'COMPLETED' || r.status === 'CANCELLED') return null;
  return <p className="text-xs text-steel">{r.answered} of {r.totalQuestions} answered</p>;
}

function Actions({ r, sp, mayExecute }: { r: InspectionRow; sp: SearchParams; mayExecute: boolean }) {
  const workable = r.status === 'SCHEDULED' || r.status === 'IN_PROGRESS';
  return (
    <div className="flex flex-wrap items-center gap-3">
      {workable && mayExecute && (
        <Link href={withParams(sp, { execute: r.id }, '/audits')} scroll={false}
          className="inline-flex items-center gap-1.5 rounded bg-plant px-2.5 py-1 text-xs font-semibold text-white hover:bg-plant/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant">
          <PlayCircle size={14} aria-hidden /> {r.status === 'SCHEDULED' ? 'Start' : 'Continue'}<span className="sr-only"> {r.referenceNo}</span>
        </Link>
      )}
      <Link href={`/audits/${r.id}`} className="text-xs font-medium text-plant underline">View<span className="sr-only"> {r.referenceNo}</span></Link>
    </div>
  );
}

export function InspectionTable({ rows, viewerId, canExecute, isManager, sp, emptyMessage }: InspectionTableProps) {
  if (rows.length === 0) {
    return <div className="rounded border border-line bg-white px-4 py-12 text-center text-sm text-steel">{emptyMessage}</div>;
  }
  const may = (r: InspectionRow) => canExecute && (isManager || r.inspectorId === viewerId);

  return (
    <>
      <div className="hidden overflow-x-auto rounded border border-line bg-white md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Inspections</caption>
          <thead className="border-b border-line bg-canvas text-steel">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Inspection</th>
              <th scope="col" className="px-4 py-3 font-medium">Inspector</th>
              <th scope="col" className="px-4 py-3 font-medium">Scheduled</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Score</th>
              <th scope="col" className="px-4 py-3 font-medium">Open NCRs</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-middle hover:bg-canvas/60">
                <td className="max-w-sm px-4 py-3">
                  <Link href={`/audits/${r.id}`} className="font-medium text-plant hover:underline">{r.checklistTitle}</Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-steel">{r.referenceNo} <StandardTag standard={r.standard} /></p>
                </td>
                <td className="px-4 py-3">{r.inspectorName}</td>
                <td className="whitespace-nowrap px-4 py-3">{fmtDate(r.scheduledDate)}</td>
                <td className="px-4 py-3"><InspectionStatusBadge status={r.status} overdue={r.overdue} /><Progress r={r} /></td>
                <td className="px-4 py-3">{r.status === 'COMPLETED' ? <ComplianceScoreCard score={r.scorePercentage} size="sm" /> : <span className="text-steel">—</span>}</td>
                <td className="px-4 py-3">{r.openNcrs > 0 ? <span className="font-semibold text-noncompliant">{r.openNcrs}</span> : <span className="text-steel">0</span>}</td>
                <td className="px-4 py-3"><Actions r={r} sp={sp} mayExecute={may(r)} /></td>
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
                <Link href={`/audits/${r.id}`} className="font-medium text-plant hover:underline">{r.checklistTitle}</Link>
                <p className="mt-0.5 text-xs text-steel">{r.referenceNo}</p>
              </div>
              {r.status === 'COMPLETED' && <ComplianceScoreCard score={r.scorePercentage} size="sm" />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <InspectionStatusBadge status={r.status} overdue={r.overdue} />
              <StandardTag standard={r.standard} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-steel">Inspector</dt><dd className="font-medium">{r.inspectorName}</dd></div>
              <div><dt className="text-steel">Scheduled</dt><dd className="font-medium">{fmtDate(r.scheduledDate)}</dd></div>
              <div><dt className="text-steel">Open NCRs</dt><dd className={`font-medium ${r.openNcrs ? 'text-noncompliant' : ''}`}>{r.openNcrs}</dd></div>
            </dl>
            <Progress r={r} />
            <Actions r={r} sp={sp} mayExecute={may(r)} />
          </li>
        ))}
      </ul>
    </>
  );
}
