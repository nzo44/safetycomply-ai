'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import type { Option } from '@/types/common';
import { inputCls } from './field';

export type FilterField =
  | { kind: 'search'; key: string; label: string; placeholder?: string }
  | { kind: 'select'; key: string; label: string; allLabel: string; options: Option[] }
  | { kind: 'date'; key: string; label: string }
  | { kind: 'checkbox'; key: string; label: string };

export function UrlFilters({ fields, ariaLabel }: { fields: FilterField[]; ariaLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const searchKey = fields.find((f) => f.kind === 'search')?.key;
  const [q, setQ] = useState(searchKey ? (sp.get(searchKey) ?? '') : '');

  const push = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(sp.toString());
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      next.delete('page'); // a filter change always returns to page 1
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [sp, pathname, router],
  );

  useEffect(() => {
    if (!searchKey) return;
    const t = setTimeout(() => {
      if ((sp.get(searchKey) ?? '') !== q.trim()) push({ [searchKey]: q.trim() });
    }, 300);
    return () => clearTimeout(t);
  }, [q, sp, push, searchKey]);

  const active = fields.filter((f) => sp.get(f.key)).length;

  return (
    <div role="search" aria-label={ariaLabel} className="flex flex-wrap items-end gap-3">
      {fields.map((f) => {
        const id = `filter-${f.key}`;
        if (f.kind === 'search') {
          return (
            <div key={f.key} className="min-w-[220px] flex-1">
              <label htmlFor={id} className="mb-1 block text-sm font-medium">{f.label}</label>
              <div className="relative">
                <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" />
                <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder={f.placeholder} className={`${inputCls} pl-9`} />
              </div>
            </div>
          );
        }
        if (f.kind === 'select') {
          return (
            <div key={f.key}>
              <label htmlFor={id} className="mb-1 block text-sm font-medium">{f.label}</label>
              <select id={id} value={sp.get(f.key) ?? ''} onChange={(e) => push({ [f.key]: e.target.value })} className={inputCls}>
                <option value="">{f.allLabel}</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          );
        }
        if (f.kind === 'date') {
          return (
            <div key={f.key}>
              <label htmlFor={id} className="mb-1 block text-sm font-medium">{f.label}</label>
              <input id={id} type="date" value={sp.get(f.key) ?? ''} onChange={(e) => push({ [f.key]: e.target.value })} className={inputCls} />
            </div>
          );
        }
        return (
          <label key={f.key} className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={sp.get(f.key) === '1'}
              onChange={(e) => push({ [f.key]: e.target.checked ? '1' : '' })} className="h-4 w-4 accent-plant" />
            {f.label}
          </label>
        );
      })}
      <div className="flex items-center gap-3 pb-2">
        {active > 0 && (
          <button type="button" onClick={() => { setQ(''); startTransition(() => router.replace(pathname, { scroll: false })); }}
            className="inline-flex items-center gap-1.5 text-sm text-steel underline hover:text-ink">
            <RotateCcw size={14} aria-hidden /> Clear {active === 1 ? 'filter' : `${active} filters`}
          </button>
        )}
        {pending && <Loader2 size={16} aria-label="Updating results" className="animate-spin text-plant" />}
      </div>
    </div>
  );
}
