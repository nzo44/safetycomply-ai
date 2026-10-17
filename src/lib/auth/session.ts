import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { hasModule, isAppModule, type AppModule, type ModuleAccess } from './modules';

export const ACTIVE_SITE_COOKIE = 'active_site';

/** null = unrestricted. If the table is missing (SQL not run yet) the app stays usable and logs why. */
async function loadAllowedModules(userId: string, role: string): Promise<ModuleAccess> {
  if (role === 'ADMIN') return null;
  try {
    const rows = await prisma.userModule.findMany({ where: { userId }, select: { module: true } });
    const mods = rows.map((r) => r.module).filter(isAppModule);
    return mods.length > 0 ? mods : null;
  } catch (e) {
    console.error('Could not read user_modules. Run prisma/user-modules.sql in Supabase.', e);
    return null;
  }
}

export const getCurrentUser = cache(async () => {
  const supabase = createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const user = await prisma.user.findFirst({
    where: { id: authUser.id, isActive: true },
    include: { sites: { select: { siteId: true } } },
  });
  if (!user) return null;
  return { ...user, allowedModules: await loadAllowedModules(user.id, user.role) };
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Page guard for a module: signed in, and allowed to open this module. */
export async function requireModule(mod: AppModule): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasModule(user, mod)) redirect('/');
  return user;
}

export const getAccessibleSites = cache(async (user: SessionUser) =>
  prisma.site.findMany({
    where: {
      isActive: true,
      ...(user.role === 'ADMIN' ? {} : { id: { in: user.sites.map((s) => s.siteId) } }),
    },
    select: { id: true, code: true, name: true, timezone: true, country: true },
    orderBy: { name: 'asc' },
  }),
);

/** Cookie preference if the user still has access, otherwise their first site. */
export async function getActiveSite(user: SessionUser) {
  const sites = await getAccessibleSites(user);
  const preferred = cookies().get(ACTIVE_SITE_COOKIE)?.value;
  return sites.find((s) => s.id === preferred) ?? sites[0] ?? null;
}
