import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export const ACTIVE_SITE_COOKIE = 'active_site';

export const getCurrentUser = cache(async () => {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  return prisma.user.findFirst({
    where: { id: authUser.id, isActive: true },
    include: { sites: { select: { siteId: true } } },
  });
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export const getAccessibleSites = cache(async (user: SessionUser) =>
  prisma.site.findMany({
    where: {
      isActive: true,
      ...(user.role === 'ADMIN' ? {} : { id: { in: user.sites.map((s) => s.siteId) } }),
    },
    select: { id: true, code: true, name: true, timezone: true },
    orderBy: { name: 'asc' },
  }),
);

/** Cookie preference if the user still has access, otherwise their first site. */
export async function getActiveSite(user: SessionUser) {
  const sites = await getAccessibleSites(user);
  const preferred = cookies().get(ACTIVE_SITE_COOKIE)?.value;
  return sites.find((s) => s.id === preferred) ?? sites[0] ?? null;
}
