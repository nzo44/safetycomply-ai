import { Download } from 'lucide-react';
import type { ExportKey } from '@/lib/export/registers';
import type { SearchParams } from '@/lib/data/params';

/** Params that change what is on screen but not which rows match. They are left out of the export. */
const VIEW_ONLY = new Set(['page', 'new', 'discharge', 'execute', 'view', 'format']);

const BTN =
  'inline-flex items-center gap-2 border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant';

/** Downloads the list the user is looking at, with the same filters applied, as CSV or Excel. */
export function ExportLink({ register, searchParams }: { register: ExportKey; searchParams: SearchParams }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val && !VIEW_ONLY.has(k)) qs.set(k, val);
  }
  const href = (format?: 'xlsx') => {
    const q = new URLSearchParams(qs);
    if (format) q.set('format', format);
    const s = q.toString();
    return `/api/export/${register}${s ? `?${s}` : ''}`;
  };
  return (
    <span className="inline-flex" role="group" aria-label="Export this list">
      <a href={href()} download className={`${BTN} rounded-l`}>
        <Download size={16} aria-hidden /> CSV
      </a>
      <a href={href('xlsx')} download className={`${BTN} -ml-px rounded-r`}>
        Excel
      </a>
    </span>
  );
}
