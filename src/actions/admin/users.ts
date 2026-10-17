'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { APP_MODULES, isAppModule } from '@/lib/auth/modules';
import { can } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Saves which modules a user may open. Everything ticked = unrestricted
 * (no rows). Administrators are never restricted.
 */
export async function saveUserModules(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me || !can(me.role, 'users:manage')) redirect('/');

  const userId = String(formData.get('userId') ?? '');
  if (!UUID.test(userId)) redirect('/admin/users?error=invalid');

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!target) redirect('/admin/users?error=invalid');
  if (target.role === 'ADMIN') redirect('/admin/users?error=admin');

  const picked = Array.from(new Set(formData.getAll('modules').map(String).filter(isAppModule)));
  if (picked.length === 0) redirect('/admin/users?error=none');

  const all = picked.length === APP_MODULES.length;
  await prisma.$transaction([
    prisma.userModule.deleteMany({ where: { userId } }),
    ...(all ? [] : [prisma.userModule.createMany({ data: picked.map((module) => ({ userId, module })) })]),
  ]);

  revalidatePath('/', 'layout');
  redirect('/admin/users?saved=1');
}
