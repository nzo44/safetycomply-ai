import { prisma } from '@/lib/prisma';
import { zonedLocalToUtc } from '@/lib/utils';

/** Interprets a `datetime-local` value as wall-clock time in the site's timezone. */
export async function resolveSiteTime(
  local: string,
  siteId: string,
  toleranceMin = 5,
): Promise<{ date: Date } | { error: string }> {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { timezone: true } });
  if (!site) return { error: 'Site not found' };
  const date = zonedLocalToUtc(local, site.timezone);
  if (!date) return { error: 'Enter a valid date and time' };
  if (date.getTime() > Date.now() + toleranceMin * 60_000) return { error: 'The date and time cannot be in the future' };
  return { date };
}
