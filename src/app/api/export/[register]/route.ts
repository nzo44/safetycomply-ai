import { NextResponse } from 'next/server';
import { hasModule } from '@/lib/auth/modules';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, getCurrentUser } from '@/lib/auth/session';
import type { SearchParams } from '@/lib/data/params';
import { tableToCsv } from '@/lib/export/csv';
import { EXPORT_MODULE } from '@/lib/export/modules';
import { EXPORTS, isExportKey } from '@/lib/export/registers';
import { tableToXlsx, XLSX_CONTENT_TYPE } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export/<register>?<same filters as the page>[&format=xlsx]
 * Same rules as the pages: signed-in user, role permission, and only the active site's data.
 * The site never comes from the URL.
 */
export async function GET(req: Request, { params }: { params: { register: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to export.' }, { status: 401 });

  if (!isExportKey(params.register)) return NextResponse.json({ error: 'Unknown export.' }, { status: 404 });
  const def = EXPORTS[params.register];
  if (!can(user.role, def.permission)) return NextResponse.json({ error: 'Your role does not allow this export.' }, { status: 403 });

  if (!hasModule(user, EXPORT_MODULE[params.register])) {
    return NextResponse.json({ error: 'You do not have access to this module.' }, { status: 403 });
  }

  const site = await getActiveSite(user);
  if (!site) return NextResponse.json({ error: 'No site is assigned to your account.' }, { status: 403 });

  const url = new URL(req.url);
  const sp: SearchParams = Object.fromEntries(url.searchParams);
  const table = await def.build({ siteId: site.id, viewerId: user.id, sp });

  const safeSite = site.code.replace(/[^A-Za-z0-9_-]/g, '-');
  const day = new Date().toISOString().slice(0, 10);
  const base = `${safeSite}-${params.register}-${day}`;
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

  if (url.searchParams.get('format') === 'xlsx') {
    const file = await tableToXlsx(table, params.register);
    return new Response(file, {
      headers: { ...headers, 'Content-Type': XLSX_CONTENT_TYPE, 'Content-Disposition': `attachment; filename="${base}.xlsx"` },
    });
  }
  return new Response(tableToCsv(table), {
    headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${base}.csv"` },
  });
}
