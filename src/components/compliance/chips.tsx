import type { Priority, RequirementCategory } from '@prisma/client';
import {
  BadgeCheck, Droplets, FlaskConical, Flame, HardHat, Paperclip, Tag, Trash2, Volume2, Wind,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORY_LABEL, PRIORITY_LABEL } from '@/lib/compliance-meta';
import { evidenceLabel, parseStorageRef } from '@/lib/evidence';

const CATEGORY_ICON: Record<RequirementCategory, LucideIcon> = {
  AIR_EMISSIONS: Wind,
  WATER_DISCHARGE: Droplets,
  WASTE_MANAGEMENT: Trash2,
  OCCUPATIONAL_SAFETY: HardHat,
  FIRE_SAFETY: Flame,
  CHEMICAL_MANAGEMENT: FlaskConical,
  NOISE: Volume2,
  PERMITS_LICENSES: BadgeCheck,
  OTHER: Tag,
};

export function DomainTag({ category }: { category: RequirementCategory }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-steel">
      <Icon size={13} aria-hidden />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

const RISK_CLASS: Record<Priority, string> = {
  CRITICAL: 'border-noncompliant bg-noncompliant text-white',
  HIGH: 'border-orange-300 bg-orange-100 text-orange-900',
  MEDIUM: 'border-amber-300 bg-amber-100 text-amber-900',
  LOW: 'border-line bg-canvas text-steel',
};

export function RiskChip({ level }: { level: Priority | null }) {
  if (!level) return <span className="text-xs text-steel">—</span>;
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${RISK_CLASS[level]}`}>
      {PRIORITY_LABEL[level]}
    </span>
  );
}

/** Returns a safe, display-ready description of an evidence reference. */
function describeEvidence(ref: string): { label: string; href: string | null; title: string } {
  if (parseStorageRef(ref)) {
    // Uploaded file: the page never holds a file URL. The route checks access and signs a 60-second link on click.
    return { label: evidenceLabel(ref), href: `/api/evidence?ref=${encodeURIComponent(ref)}`, title: evidenceLabel(ref) };
  }
  try {
    const u = new URL(ref);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '');
      return { label: last || u.hostname, href: ref, title: `${u.hostname}${u.pathname}` };
    }
  } catch {
    /* not a URL: treat as a storage path */
  }
  const last = ref.split('/').filter(Boolean).pop() ?? ref;
  return { label: last, href: null, title: ref }; // never render non-http(s) as a link
}

export function EvidenceLinks({ urls, max = 2 }: { urls: string[]; max?: number }) {
  if (urls.length === 0) return <span className="text-xs text-steel">No evidence</span>;

  const shown = urls.slice(0, max).map(describeEvidence);
  const hidden = urls.slice(max);
  const chip =
    'inline-flex max-w-[10rem] items-center gap-1 rounded border border-line bg-white px-1.5 py-0.5 text-xs';

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Evidence">
      {shown.map((e, i) => (
        <li key={i}>
          {e.href ? (
            <a href={e.href} target="_blank" rel="noopener noreferrer" title={e.title}
               className={`${chip} text-plant hover:bg-canvas hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant`}>
              <Paperclip size={12} aria-hidden className="shrink-0" />
              <span className="truncate">{e.label}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <span title={e.title} className={`${chip} text-steel`}>
              <Paperclip size={12} aria-hidden className="shrink-0" />
              <span className="truncate">{e.label}</span>
            </span>
          )}
        </li>
      ))}
      {hidden.length > 0 && (
        <li>
          <span title={hidden.join('\n')} className={`${chip} text-steel`}>+{hidden.length} more</span>
        </li>
      )}
    </ul>
  );
}
