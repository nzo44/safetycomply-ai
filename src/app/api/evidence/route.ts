import { NextResponse } from 'next/server';
import { hasSiteAccess } from '@/lib/auth/rbac';
import { getCurrentUser } from '@/lib/auth/session';
import { EVIDENCE_BUCKET, parseStorageRef } from '@/lib/evidence';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const SIGNED_URL_SECONDS = 60;

/**
 * Opens an uploaded file. The page never contains a file URL: this route checks the signed-in user's
 * access to the file's site on every click, then redirects to a signed URL that expires in a minute.
 */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('ref') ?? '';
  const parsed = parseStorageRef(ref);
  if (!parsed) return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to view this file' }, { status: 401 });
  // 404 rather than 403, so the response doesn't reveal which files exist at other sites.
  if (!hasSiteAccess(user, parsed.siteId)) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const { data, error } = await createAdminClient().storage.from(EVIDENCE_BUCKET).createSignedUrl(parsed.objectPath, SIGNED_URL_SECONDS);
  if (error || !data) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}
