import { createClient } from "@supabase/supabase-js";
import { runScan } from "@/lib/scan";

export const maxDuration = 60;

/**
 * Scheduled scan (Vercel Cron). Disabled unless all of these server-only
 * variables exist: CRON_SECRET, SCAN_USER_ID, SUPABASE_SERVICE_ROLE_KEY.
 * Vercel sends "Authorization: Bearer $CRON_SECRET" automatically.
 * It only inserts DISCOVERED offers; it never applies anywhere.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const userId = process.env.SCAN_USER_ID;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !userId || !serviceKey || !url)
    return Response.json({ error: "Scheduled scan is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const summary = await runScan({ supabase, userId });
  return Response.json(summary);
}
