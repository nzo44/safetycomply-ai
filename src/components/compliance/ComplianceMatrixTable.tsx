'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardPen } from 'lucide-react';
import type { ComplianceStatus } from '@prisma/client';
import type { MatrixRow } from '@/types/compliance';
import { fmtDate } from '@/lib/utils';
import { StatusBadge } from './status-badge';
import { DomainTag, EvidenceLinks, RiskChip } from './chips';

type SortKey = 'title' | 'status' | 'nextReview';
type SortDir = 'asc' | 'desc';

/** Worst first when sorting by status ascending. */
const STATUS_RANK: Record<ComplianceStatus, number> = {
  NON_COMPLIANT: 0, PARTIALLY_COMPLIANT: 1, PENDING_REVIEW: 2, COMPLIANT: 3, NOT_APPLICABLE: 4,
};

function compare(a: MatrixRow, b: MatrixRow, key: SortKey): number {
  switch (key) {
    case 'title':
      return a.title.localeCompare(b.title);
    case 'status':
      return STATUS_RANK[a.currentStatus] - STATUS_RANK[b.currentStatus];
    case 'nextReview': {
      // Rows with no review date always sort last.
      if (!a.nextReviewDate && !b.nextReviewDate) return 0;
      if (!a.nextReviewDate) return 1;
      if (!b.nextReviewDate) return -1;
      return a.nextReviewDate.getTime() - b.nextReviewDate.getTime();
    }
  }
}

export interface ComplianceMatrixTableProps {
  rows: MatrixRow[];
  canAudit: boolean;
  onAudit: (row: MatrixRow) => void;
  emptyMessage?: string;
}

export function ComplianceMatrixTable({
  rows,
  canAudit,
  onAudit,
  emptyMessage = 'No requirements to show.',
}: ComplianceMatrixTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const now = useMemo(() => Date.now(), []);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const nullsLast =
        sort.key === 'nextReview' && (!a.nextReviewDate || !b.nextReviewDate); // keep nulls last in both directions
      return nullsLast ? compare(a, b, sort.key) : factor * compare(a, b, sort.key);
    });
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));

  const isOverdue = (d: Date | null) => d !== null && d.getTime() < now;

  if (rows.length === 0) {
    return (
      <div className="rounded border border-line bg-white px-4 py-12 text-center text-sm text-steel">
        {emptyMessage}
      </div>
    );
  }

  const AuditButton = ({ row }: { row: MatrixRow }) =>
    canAudit ? (
      <button
        type="button"
        onClick={() => onAudit(row)}
        className="inline-flex items-center gap-1.5 rounded border border-plant px-2.5 py-1 text-xs font-semibold text-plant hover:bg-plant/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant"
      >
        <ClipboardPen size={14} aria-hidden />
        Audit
        <span className="sr-only"> {row.title}</span>
      </button>
    ) : null;

  const SortHeader = ({ k, children }: { k: SortKey; children: React.ReactNode }) => {
    const dir = sort?.key === k ? sort.dir : null;
    const Icon = dir === null ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        className="px-4 py-3 font-medium"
        aria-sort={dir === null ? 'none' : dir === 'asc' ? 'ascending' : 'descending'}
      >
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant"
        >
          {children}
          <Icon size={13} aria-hidden className={dir === null ? 'opacity-50' : 'text-plant'} />
        </button>
      </th>
    );
  };

  return (
    <>
      {/* Desktop and tablet: table */}
      <div className="hidden overflow-x-auto rounded border border-line bg-white md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-steel">
            <tr>
              <SortHeader k="title">Requirement</SortHeader>
              <th scope="col" className="px-4 py-3 font-medium">Domain</th>
              <SortHeader k="status">Status</SortHeader>
              <th scope="col" className="px-4 py-3 font-medium">Gap risk</th>
              <th scope="col" className="px-4 py-3 font-medium">Evidence</th>
              <SortHeader k="nextReview">Next review</SortHeader>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((r) => {
              const overdue = isOverdue(r.nextReviewDate);
              return (
                <tr key={r.id} className="align-top hover:bg-canvas/60">
                  <td className="max-w-sm px-4 py-3">
                    <Link href={`/compliance/${r.id}`} className="font-medium text-plant hover:underline">{r.title}</Link>
                    <p className="mt-0.5 text-xs text-steel">{r.citation}</p>
                    <p className="mt-0.5 text-xs text-steel">Owner: {r.ownerName ?? 'Unassigned'}</p>
                  </td>
                  <td className="px-4 py-3"><DomainTag category={r.category} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.currentStatus} /></td>
                  <td className="px-4 py-3"><RiskChip level={r.gapSeverity} /></td>
                  <td className="px-4 py-3"><EvidenceLinks urls={r.evidenceUrls} /></td>
                  <td className={`whitespace-nowrap px-4 py-3 ${overdue ? 'font-medium text-noncompliant' : ''}`}>
                    {fmtDate(r.nextReviewDate)}
                    {overdue && <span className="block text-xs">Overdue</span>}
                  </td>
                  <td className="px-4 py-3 text-right"><AuditButton row={r} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {sorted.map((r) => {
          const overdue = isOverdue(r.nextReviewDate);
          return (
            <li key={r.id} className="space-y-3 rounded border border-line bg-white p-4">
              <div>
                <Link href={`/compliance/${r.id}`} className="font-medium text-plant hover:underline">{r.title}</Link>
                <p className="mt-0.5 text-xs text-steel">{r.citation}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.currentStatus} />
                <DomainTag category={r.category} />
                {r.gapSeverity && <RiskChip level={r.gapSeverity} />}
              </div>
              <EvidenceLinks urls={r.evidenceUrls} max={3} />
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className={overdue ? 'font-medium text-noncompliant' : 'text-steel'}>
                  Next review: {fmtDate(r.nextReviewDate)}{overdue && ' (overdue)'}
                </span>
                <AuditButton row={r} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
