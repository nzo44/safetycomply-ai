'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { can } from '@/lib/auth/rbac';
import { getActiveSite, getCurrentUser } from '@/lib/auth/session';
import { EVIDENCE_BUCKET, EVIDENCE_TYPES, MAX_EVIDENCE_BYTES, safeFileBase } from '@/lib/evidence';
import { createAdminClient } from '@/lib/supabase/admin';

export type UploadTicket =
  | { ok: true; ref: string; path: string; token: string }
  | { ok: false; error: string };

const inputSchema = z.object({
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_EVIDENCE_BYTES, 'Files can be up to 10 MB'),
  type: z.string().refine((t) => Object.hasOwn(EVIDENCE_TYPES, t), 'This file type is not allowed'),
});

/**
 * Step 1 of an upload: checks who is asking and what they want to send, then returns a one-time
 * signed upload URL token. The browser sends the file straight to storage, so it never passes through
 * this server. The returned `ref` is what gets saved on the record.
 */
export async function createEvidenceUpload(input: { fileName: string; size: number; type: string }): Promise<UploadTicket> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'Your session has expired. Sign in again.' };
    if (!can(user.role, 'audit:write') && !can(user.role, 'waste:weigh') && !can(user.role, 'inspection:execute')) {
      return { ok: false, error: 'Your role cannot attach evidence.' };
    }
    const site = await getActiveSite(user);
    if (!site) return { ok: false, error: 'No site is assigned to your account.' };

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'This file cannot be uploaded.' };

    const name = `${randomUUID()}-${safeFileBase(parsed.data.fileName)}.${EVIDENCE_TYPES[parsed.data.type]}`;
    const path = `${site.id}/${name}`;

    const { data, error } = await createAdminClient().storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error('createSignedUploadUrl failed', error);
      return { ok: false, error: 'Could not prepare the upload. Try again.' };
    }
    return { ok: true, ref: `${EVIDENCE_BUCKET}/${path}`, path: data.path, token: data.token };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'Could not prepare the upload. Try again.' };
  }
}
