import type { Prisma, Role } from '@prisma/client';
import { WorkflowError } from '@/lib/action-result';

/** The user must be active and have access to the site (admins have access to all). */
export async function requireSiteUser(
  db: Prisma.TransactionClient,
  userId: string,
  siteId: string,
  roles?: Role[],
  label = 'The selected user',
) {
  const u = await db.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      ...(roles && { role: { in: roles } }),
      OR: [{ role: 'ADMIN' }, { sites: { some: { siteId } } }],
    },
    select: { id: true, role: true, fullName: true },
  });
  if (!u) throw new WorkflowError(`${label} is not an active user with access to this site.`);
  return u;
}
