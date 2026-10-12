'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';

/** URL params that open a drawer. Removing them closes it. */
export const MODAL_PARAMS = ['new', 'discharge', 'hazard', 'execute', 'ncr', 'ncrq'] as const;

export function useCloseDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return useCallback(() => {
    const next = new URLSearchParams(sp.toString());
    MODAL_PARAMS.forEach((k) => next.delete(k));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, sp]);
}

export interface DrawerProps {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The server renders this only while the matching URL param is present, so closing
 * (Esc, backdrop, X, Back) removes the param and the server unmounts it, which resets all form state.
 */
export function Drawer({ title, subtitle, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = useCloseDrawer();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal(); // guard: React Strict Mode runs effects twice in development
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={close} // fires on Esc
      onClick={(e) => {
        if (e.target === ref.current) close(); // backdrop click
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-full max-h-none w-full max-w-lg overflow-hidden bg-white p-0 shadow-2xl backdrop:bg-ink/40"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-xl font-semibold">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-steel">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded p-1.5 text-steel hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pt-5">{children}</div>
      </div>
    </dialog>
  );
}
