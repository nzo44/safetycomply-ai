import { can, ForbiddenError, hasSiteAccess, type Permission } from './rbac';
import { getActiveSite, getCurrentUser } from './session';

/** Call at the top of every Server Action. Throws ForbiddenError. */
export async function authorize(permission: Permission, siteId?: string) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError('Your session has expired. Sign in again.');
  if (!can(user.role, permission)) throw new ForbiddenError('Your role does not allow this action.');

  if (siteId) {
    if (!hasSiteAccess(user, siteId)) throw new ForbiddenError('You do not have access to this site.');
    return { user, siteId };
  }

  const site = await getActiveSite(user);
  if (!site) throw new ForbiddenError('No site is assigned to your account.');
  return { user, siteId: site.id };
}
