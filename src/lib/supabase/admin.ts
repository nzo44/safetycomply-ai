import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. It bypasses every storage policy, so it must only be called from server code
 * (Server Actions and route handlers), and SUPABASE_SERVICE_ROLE_KEY must never use a NEXT_PUBLIC_ prefix.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
