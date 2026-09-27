import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { runServerTick } from "@/lib/pipeline/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Scheduled pipeline for every account (search → score → write documents).
 * Needs CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY (server-only variables).
 * Called by Vercel Cron (GET, "Authorization: Bearer $CRON_SECRET") and, for
 * a run every 15-30 min, by Supabase pg_cron (POST, same header).
 * It never applies anywhere and never opens a browser.
 */
/** Constant-time comparison (hashes first so lengths never leak). */
function sameSecret(given: string | null, expected: string) {
  const a = createHash("sha256").update(given ?? "").digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !serviceKey || !url)
    return Response.json({ error: "Scheduled run is not configured" }, { status: 503 });
  if (!sameSecret(req.headers.get("authorization"), `Bearer ${secret}`))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const report = await runServerTick({ supabase });
  return Response.json(report);
}

export const GET = handle;
export const POST = handle;
