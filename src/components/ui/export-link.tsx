import { Download } from 'lucide-react';
import type { ExportKey } from '@/lib/export/registers';
import type { SearchParams } from '@/lib/data/params';

/** Params that change what is on screen but not which rows match. They are left out of the export. */
const VIEW_ONLY = new Set(['page', 'new', 'discharge', 'execute', 'view']);

/** Downloads the list the user is looking at, with the same filters applied. */
export function ExportLink({ register, searchParams }: { register: ExportKey; searchParams: SearchParams }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val && !VIEW_ONLY.has(k)) qs.set(k, val);
  }
  const query = qs.toString();
  return (
    <a
      href={`/api/export/${register}${query ? `?${query}` : ''}`}
      download
      className="inline-flex items-center gap-2 rounded border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant"
    >
      <Download size={16} aria-hidden /> Export CSV
    </a>
  );
}
