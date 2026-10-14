'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import type { ActionResult } from '@/lib/action-result';

type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; message: string }
interface ToastApi { push: (kind: Kind, message: string) => void }

const Ctx = createContext<ToastApi | null>(null);
const MAX_VISIBLE = 4;
const LIFETIME_MS: Record<Kind, number> = { success: 5000, info: 5000, error: 9000 };

const STYLE: Record<Kind, { Icon: LucideIcon; border: string; icon: string }> = {
  success: { Icon: CheckCircle2, border: 'border-compliant/50', icon: 'text-compliant' },
  error: { Icon: AlertCircle, border: 'border-noncompliant/50', icon: 'text-noncompliant' },
  info: { Icon: Info, border: 'border-plant/50', icon: 'text-plant' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((kind: Kind, message: string) => {
    const id = seq.current++;
    setItems((prev) => [...prev, { id, kind, message }].slice(-MAX_VISIBLE));
    timers.current.set(id, setTimeout(() => dismiss(id), LIFETIME_MS[kind]));
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <Toaster items={items} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

/** Safe outside a provider: pushing does nothing. */
export function useToast(): ToastApi {
  return useContext(Ctx) ?? { push: () => {} };
}

/**
 * Turns a Server Action result into a toast. Success messages always show. Errors show only when
 * `errors` is set (for forms with no inline error area, such as one-tap action buttons); field errors
 * stay inline in their forms.
 */
export function useResultToast(state: ActionResult | null, opts: { errors?: boolean } = {}) {
  const { push } = useToast();
  const seen = useRef<ActionResult | null>(null);
  const errors = opts.errors ?? false;

  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok) {
      if (state.message) push('success', state.message);
    } else if (errors && !state.fieldErrors) {
      push('error', state.error);
    }
  }, [state, errors, push]);
}

function Toaster({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // A manual popover sits in the browser's top layer, so toasts stay visible above open drawers.
  // Re-showing it on every change moves it above any dialog opened after the previous toast.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (items.length > 0) el.showPopover();
    } catch {
      /* unsupported browser: the fixed-position fallback below still shows the toasts */
    }
  }, [items]);

  const last = items[items.length - 1];
  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{last && last.kind !== 'error' ? last.message : ''}</div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">{last && last.kind === 'error' ? last.message : ''}</div>

      <div
        ref={ref}
        {...({ popover: 'manual' } as Record<string, string>)}
        className="pointer-events-none fixed inset-auto bottom-4 right-4 z-[60] m-0 w-[min(24rem,calc(100vw-2rem))] overflow-visible border-0 bg-transparent p-0 print:hidden"
      >
        <ul aria-label="Notifications" className="flex flex-col gap-2">
          {items.map((t) => {
            const { Icon, border, icon } = STYLE[t.kind];
            return (
              <li key={t.id} className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-3 shadow-lg ${border}`}>
                <Icon size={18} aria-hidden className={`mt-0.5 shrink-0 ${icon}`} />
                <p className="min-w-0 flex-1 text-sm text-ink">{t.message}</p>
                <button
                  type="button"
                  onClick={() => onDismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded p-0.5 text-steel hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant"
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
