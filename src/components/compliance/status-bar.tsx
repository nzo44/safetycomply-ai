import type { ComplianceStatus } from '@prisma/client';
import Link from 'next/link';
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '@/lib/compliance-meta';

export function StatusBar({ counts, total }: { counts: Record<ComplianceStatus, number>; total: number }) {
  if (total === 0) return <p className="text-sm text-steel">No requirements yet.</p>;

  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded-sm bg-line" role="img"
        aria-label={STATUS_ORDER.map((s) => `${STATUS_LABEL[s]}: ${counts[s]}`).join(', ')}>
        {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <div key={s} style={{ width: `${(counts[s] / total) * 100}%`, backgroundColor: STATUS_COLOR[s] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {STATUS_ORDER.map((s) => (
          <li key={s}>
            <Link href={`/compliance?status=${s}`} className="inline-flex items-center gap-1.5 hover:underline">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLOR[s] }} />
              {STATUS_LABEL[s]} <span className="font-semibold">{counts[s]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
