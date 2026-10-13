import { NextResponse } from 'next/server';
import { safeNext } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Landing point for emailed sign-in links: swaps the one-time code for a session, then continues. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '');
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
  }
  return NextResponse.redirect(`${base}/login?error=link`);
}
