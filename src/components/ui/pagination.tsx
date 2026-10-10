import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}

export function Pagination({ page, pageCount, total, pageSize, hrefFor }: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'inline-flex items-center gap-1 rounded border border-line bg-white px-3 py-1.5 text-sm font-medium';

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-steel" aria-live="polite">Showing {from} to {to} of {total}</p>
      <div className="flex items-center gap-2">
        {page > 1
          ? <Link href={hrefFor(page - 1)} scroll={false} className={`${btn} hover:bg-canvas`}><ChevronLeft size={14} aria-hidden /> Previous</Link>
          : <span aria-disabled="true" className={`${btn} opacity-40`}><ChevronLeft size={14} aria-hidden /> Previous</span>}
        <span className="px-1 text-steel">Page {page} of {pageCount}</span>
        {page < pageCount
          ? <Link href={hrefFor(page + 1)} scroll={false} className={`${btn} hover:bg-canvas`}>Next <ChevronRight size={14} aria-hidden /></Link>
          : <span aria-disabled="true" className={`${btn} opacity-40`}>Next <ChevronRight size={14} aria-hidden /></span>}
      </div>
    </nav>
  );
}
