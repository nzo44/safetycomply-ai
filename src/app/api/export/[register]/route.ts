import { NextResponse } from 'next/server';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, getCurrentUser } from '@/lib/auth/session';
import type { SearchParams } from '@/lib/data/params';
import { EXPORTS, isExportKey } from '@/lib/export/registers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export/<register>?<same filters as the page>
 * Same rules as the pages: signed-in user, role permission, and only the active site's data.
 * The site never comes from the URL.
 */
export async function GET(req: Request, { params }: { params: { register: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to export.' }, { status: 401 });

  if (!isExportKey(params.register)) return NextResponse.json({ error: 'Unknown export.' }, { status: 404 });
  const def = EXPORTS[params.register];
  if (!can(user.role, def.permission)) return NextResponse.json({ error: 'Your role does not allow this export.' }, { status: 403 });

  const site = await getActiveSite(user);
  if (!site) return NextResponse.json({ error: 'No site is assigned to your account.' }, { status: 403 });

  const sp: SearchParams = Object.fromEntries(new URL(req.url).searchParams);
  const csv = await def.build({ siteId: site.id, viewerId: user.id, sp });

  const safeSite = site.code.replace(/[^A-Za-z0-9_-]/g, '-');
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeSite}-${params.register}-${day}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
