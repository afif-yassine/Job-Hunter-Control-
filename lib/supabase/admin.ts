import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client with the service role (bypasses RLS). Used only for
 * platform-wide data no account may write directly (shared source cache,
 * scheduled run). Null when SUPABASE_SERVICE_ROLE_KEY is not configured.
 * Never import this from a client component.
 */
export function serviceClient(env: Record<string, string | undefined> = process.env): SupabaseClient | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
