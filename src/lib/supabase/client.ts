import { createBrowserClient } from '@supabase/ssr';

/** Browser client (anon key). Used only to send a file to a signed upload URL. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
