import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { signOut } from '@/actions/auth/session';
import { getCurrentUser } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/redirect';
import type { SearchParams } from '@/lib/data/params';
import { one } from '@/lib/data/params';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNext(one(searchParams, 'next'));
  const linkFailed = one(searchParams, 'error') === 'link';

  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (authUser) {
    if (await getCurrentUser()) redirect(next);

    // Signed in with Supabase, but no active profile row: show why instead of looping back here.
    return (
      <div className="space-y-4 rounded border border-line bg-white p-6">
        <h1 className="font-display text-xl font-semibold">Your account is not set up yet</h1>
        <p className="text-sm text-steel">
          You are signed in as {authUser.email}, but this account has no active profile in SafetyComply AI.
          Ask an administrator to activate it, then sign in again.
        </p>
        <form action={signOut}>
          <button className="rounded border border-plant px-4 py-2 text-sm font-semibold text-plant hover:bg-plant/5">Sign out</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-center font-display text-xl font-semibold">Sign in</h1>
      {linkFailed && (
        <p role="alert" className="rounded border border-noncompliant/40 bg-noncompliant/5 px-3 py-2 text-sm text-noncompliant">
          That sign-in link is invalid or has expired. Request a new one below.
        </p>
      )}
      <LoginForm next={next === '/' ? undefined : next} />
      <p className="text-center text-xs text-steel">Accounts are created by your administrator.</p>
    </div>
  );
}
