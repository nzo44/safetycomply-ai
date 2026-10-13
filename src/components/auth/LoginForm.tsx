'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Eye, EyeOff } from 'lucide-react';
import { sendMagicLink, signInWithPassword } from '@/actions/auth/session';
import { Field, inputCls, SubmitButton } from '@/components/ui/field';

type Mode = 'password' | 'link';

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<Mode>('password');
  const [show, setShow] = useState(false);
  const [signInState, signInAction] = useFormState(signInWithPassword, null);
  const [linkState, linkAction] = useFormState(sendMagicLink, null);

  const state = mode === 'password' ? signInState : linkState;
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k]?.[0] : undefined);

  const tab = (m: Mode) =>
    `flex-1 rounded px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant ${
      mode === m ? 'bg-plant text-white' : 'text-steel hover:bg-canvas'
    }`;

  return (
    <div className="space-y-5 rounded border border-line bg-white p-6">
      <div className="flex gap-1 rounded border border-line p-1" role="group" aria-label="Sign-in method">
        <button type="button" aria-pressed={mode === 'password'} onClick={() => setMode('password')} className={tab('password')}>Password</button>
        <button type="button" aria-pressed={mode === 'link'} onClick={() => setMode('link')} className={tab('link')}>Email link</button>
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded border border-noncompliant/40 bg-noncompliant/5 px-3 py-2 text-sm text-noncompliant">{state.error}</p>
      )}
      {state?.ok && <p role="status" className="rounded border border-compliant/40 bg-compliant/5 px-3 py-2 text-sm text-compliant">{state.message}</p>}

      {mode === 'password' ? (
        <form action={signInAction} className="space-y-4" noValidate>
          <input type="hidden" name="next" value={next ?? ''} />
          <Field label="Email" name="email" error={err('email')}>
            <input id="email" name="email" type="email" required autoFocus autoComplete="email" inputMode="email" className={inputCls} />
          </Field>
          <Field label="Password" name="password" error={err('password')}>
            <div className="relative">
              <input id="password" name="password" type={show ? 'text' : 'password'} required autoComplete="current-password" className={`${inputCls} pr-10`} />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-steel hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-plant"
              >
                {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
          </Field>
          <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
        </form>
      ) : (
        <form action={linkAction} className="space-y-4" noValidate>
          <input type="hidden" name="next" value={next ?? ''} />
          <Field label="Email" name="link-email" htmlFor="link-email" error={err('email')}
            hint="We email a one-time link. It only works for existing accounts.">
            <input id="link-email" name="email" type="email" required autoComplete="email" inputMode="email" className={inputCls} />
          </Field>
          <SubmitButton pendingLabel="Sending…">Email me a sign-in link</SubmitButton>
        </form>
      )}
    </div>
  );
}
