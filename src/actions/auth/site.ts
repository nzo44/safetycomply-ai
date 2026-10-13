'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/action-result';
import { ACTIVE_SITE_COOKIE, getAccessibleSites, getCurrentUser } from '@/lib/auth/session';

/** Remembers the site the user is working in. The id is checked against the sites they can access. */
export async function setActiveSite(siteId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Your session has expired. Sign in again.' };

  const sites = await getAccessibleSites(user);
  if (typeof siteId !== 'string' || !sites.some((s) => s.id === siteId)) {
    return { ok: false, error: 'You do not have access to that site.' };
  }

  cookies().set(ACTIVE_SITE_COOKIE, siteId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
