'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { invalid, type ActionResult } from '@/lib/action-result';
import { safeNext } from '@/lib/auth/redirect';
import { magicLinkSchema, signInSchema } from '@/lib/validations/auth';

/** Public origin used in emailed links. Prefer the configured value over request headers. */
function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function signInWithPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // One message for wrong email and wrong password, so the form can't be used to probe which accounts exist.
    return {
      ok: false,
      error: error.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'The email or password is incorrect.',
    };
  }
  redirect(safeNext(parsed.data.next));
}

/** Emails a one-time sign-in link. Never creates accounts, and never reveals whether the address is registered. */
export async function sendMagicLink(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createClient();
  const next = safeNext(parsed.data.next);
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl()}/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error?.status === 429) return { ok: false, error: 'Too many requests. Wait a minute and try again.' };
  return { ok: true, message: 'If that address belongs to an account, a sign-in link is on its way. Check your inbox.' };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
