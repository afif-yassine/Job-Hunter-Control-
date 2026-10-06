import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedSemanticOffers } from "./semantic-embeddings";

type Dependencies = {
  env: Record<string, string | undefined>;
  db: () => SupabaseClient | null;
  embed?: typeof embedSemanticOffers;
  now?: () => number;
};

/** Explicit operations endpoint: no offer analysis, profile generation or retries. */
export async function embeddingBackfill(req: Request, deps: Dependencies) {
  const secret = deps.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Backfill is not configured" }, { status: 503 });
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(req.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`)))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!deps.env.AI_GATEWAY_API_KEY?.trim()) return Response.json({ error: "Gateway is not configured" }, { status: 503 });
  const db = deps.db();
  if (!db) return Response.json({ error: "Database is not configured" }, { status: 503 });
  const now = deps.now ?? Date.now;
  const deadline = now() + 40_000;
  try {
    const embedded = await (deps.embed ?? embedSemanticOffers)(db, deps.env, { limit: 300, timeLeft: () => deadline - now() });
    return Response.json({ embedded });
  } catch {
    return Response.json({ error: "Embedding backfill failed; a later run can resume missing vectors" }, { status: 502 });
  }
}
