'use client';

import { useId, useState, useTransition } from 'react';
import { setActiveSite } from '@/actions/auth/site';

export interface SiteOption { id: string; name: string; code: string }

export function SiteSwitcher({ sites, activeId }: { sites: SiteOption[]; activeId: string | null }) {
  const id = useId();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-slate-500">Site</label>
      <select
        id={id}
        value={activeId ?? ''}
        disabled={pending}
        onChange={(e) => {
          const value = e.target.value;
          setError(null);
          start(async () => {
            const res = await setActiveSite(value);
            if (!res.ok) setError(res.error);
          });
        }}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-60"
      >
        {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
      </select>
      {error && <p role="alert" className="mt-1 text-rose-400">{error}</p>}
    </div>
  );
}
