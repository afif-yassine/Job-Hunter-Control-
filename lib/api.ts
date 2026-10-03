import { createClient } from "@/lib/supabase/server";

/**
 * Per-account request limits (requests per window, in seconds), on top of the
 * daily AI quotas: they stop bursts — a script hammering a route, a stuck
 * loop — before they cost anything.
 */
export const RATE_LIMITS = {
  api: { limit: 120, window: 60 },
  scan: { limit: 6, window: 60 },
  ai: { limit: 30, window: 60 },
  probe: { limit: 10, window: 60 },
} as const;

export type RateBucket = keyof typeof RATE_LIMITS;

export const RATE_LIMITED = "RATE_LIMITED";

/** The signed-in account's Supabase client, or the Response to send back. */
export async function authenticatedClient(bucket: RateBucket = "api") {
  const supabase = await createClient();
  if (!supabase) return { error: Response.json({ error: "Supabase is not configured" }, { status: 503 }) };
  const { data } = await supabase.auth.getClaims();
  const userId = String(data?.claims?.sub || "");
  if (!userId) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const { limit, window } = RATE_LIMITS[bucket];
  const { data: allowed, error } = await supabase.rpc("hit_rate_limit", {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: window,
  });
  // A broken counter never blocks anyone.
  if (!error && allowed === false)
    return {
      error: Response.json(
        { error: "Trop de demandes en peu de temps : réessaie dans une minute.", code: RATE_LIMITED },
        { status: 429, headers: { "retry-after": String(window) } },
      ),
    };
  return { supabase, userId };
}

export function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}
