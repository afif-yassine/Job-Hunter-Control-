import { createHash, timingSafeEqual } from "node:crypto";
import { runHarvestSlice } from "@/lib/scan/harvest";
import { serviceClient } from "@/lib/supabase/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function sameSecret(given: string | null, expected: string) {
  const a = createHash("sha256").update(given ?? "").digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Platform harvest, one slice (see lib/scan/harvest.ts). Call it every
 * 5-10 minutes (Supabase pg_cron, "Authorization: Bearer $CRON_SECRET"):
 * it starts the 04:00 and 12:00 UTC runs and resumes them until done.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const db = serviceClient();
  if (!secret || !db) return Response.json({ error: "Harvest is not configured" }, { status: 503 });
  if (!sameSecret(req.headers.get("authorization"), `Bearer ${secret}`))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await runHarvestSlice(db));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Harvest failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
