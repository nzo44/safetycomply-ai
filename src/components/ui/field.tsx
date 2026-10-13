'use client';

import { useFormStatus } from 'react-dom';

export const inputCls =
  'w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-steel/60 focus:border-plant focus:outline-none focus:ring-2 focus:ring-plant/30';

export function Field({
  label, name, htmlFor, error, hint, children,
}: { label: string; name: string; htmlFor?: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor ?? name} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-steel">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-noncompliant">{error}</p>}
    </div>
  );
}

export function SubmitButton({ children, pendingLabel = 'Saving…' }: { children: React.ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-plant px-4 py-2 text-sm font-semibold text-white hover:bg-plant/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plant disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
