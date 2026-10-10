'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER } from '@/lib/compliance-meta';
import { inputCls } from '@/components/ui/field';

const FILTER_KEYS = ['q', 'category', 'status', 'risk', 'overdue'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

interface FilterSelectProps {
  id: FilterKey;
  label: string;
  allLabel: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterSelect({ id, label, allLabel, value, options, onChange }: FilterSelectProps) {
  return (
    <div>
      <label htmlFor={`filter-${id}`} className="mb-1 block text-sm font-medium">{label}</label>
      <select id={`filter-${id}`} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

/** URL-driven filters: the server page re-queries whenever the search params change. */
export function ComplianceFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get('q') ?? '');

  const push = useCallback(
    (patch: Partial<Record<FilterKey, string>>) => {
      const next = new URLSearchParams(sp.toString());
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [sp, pathname, router],
  );

  // Debounce the search box; selects apply immediately.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get('q') ?? '') !== q.trim()) push({ q: q.trim() });
    }, 300);
    return () => clearTimeout(t);
  }, [q, sp, push]);

  const activeCount = FILTER_KEYS.filter((k) => sp.get(k)).length;
  const clearAll = () => {
    setQ('');
    startTransition(() => router.replace(pathname, { scroll: false }));
  };

  return (
    <div role="search" aria-label="Filter requirements" className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="filter-q" className="mb-1 block text-sm font-medium">Search</label>
        <div className="relative">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
          <input
            id="filter-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, citation or authority"
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      <FilterSelect
        id="category" label="Domain" allLabel="All domains"
        value={sp.get('category') ?? ''} options={toOptions(CATEGORY_LABEL)}
        onChange={(v) => push({ category: v })}
      />
      <FilterSelect
        id="status" label="Compliance status" allLabel="All statuses"
        value={sp.get('status') ?? ''}
        options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        onChange={(v) => push({ status: v })}
      />
      <FilterSelect
        id="risk" label="Risk level" allLabel="All risk levels"
        value={sp.get('risk') ?? ''} options={toOptions(PRIORITY_LABEL)}
        onChange={(v) => push({ risk: v })}
      />

      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          checked={sp.get('overdue') === '1'}
          onChange={(e) => push({ overdue: e.target.checked ? '1' : '' })}
          className="h-4 w-4 accent-plant"
        />
        Overdue only
      </label>

      <div className="flex items-center gap-3 pb-2">
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 text-sm text-steel underline hover:text-ink"
          >
            <RotateCcw size={14} aria-hidden />
            Clear {activeCount === 1 ? 'filter' : `${activeCount} filters`}
          </button>
        )}
        {pending && <Loader2 size={16} aria-label="Updating results" className="animate-spin text-plant" />}
      </div>
    </div>
  );
}
