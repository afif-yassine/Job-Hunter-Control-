import type { SupabaseClient } from "@supabase/supabase-js";
import type { CostOrigin } from "./origin";

type Env = Record<string, string | undefined>;

export type GatewayBalance =
  | { available: true; balanceUsd: number; totalUsedUsd: number; origin: CostOrigin; scope: string }
  | { available: false; reason: "not_configured" | "unauthorized" | "unavailable"; origin: CostOrigin };

export type GatewayCredits = {
  at: string;
  /** What Vercel says: remaining credit and lifetime spend of the whole team (every key, scripts included). */
  gateway: GatewayBalance;
  /** What this application wrote in ai_usage since the beginning (accounts deleted since are gone from it). */
  recorded: { usd: number; calls: number; unpricedCalls: number; origin: CostOrigin } | null;
  /** gateway.totalUsedUsd − recorded.usd; null when one of the two is unknown. Positive = spend the app did not record. */
  gapUsd: number | null;
  note: string;
};

const NOTE =
  "Écart = dépense du Gateway que l’application n’a pas enregistrée : appels ratés ou coupés, scripts d’essai, comptes supprimés depuis, autres clés de l’équipe.";

/** GET /v1/credits, documented as {"balance":"95.50","total_used":"4.50"} (strings, USD). Read only, free of charge. */
export async function readGatewayBalance(env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<GatewayBalance> {
  const key = env.AI_GATEWAY_API_KEY?.trim();
  if (!key) return { available: false, reason: "not_configured", origin: "measured" };
  try {
    const response = await fetchImpl("https://ai-gateway.vercel.sh/v1/credits", {
      method: "GET",
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) return { available: false, reason: "unauthorized", origin: "measured" };
    if (!response.ok) return { available: false, reason: "unavailable", origin: "measured" };
    const body = (await response.json().catch(() => null)) as { balance?: unknown; total_used?: unknown } | null;
    const balance = Number(body?.balance);
    const used = Number(body?.total_used);
    // A field the documentation names but the answer lacks is "unavailable", never a made-up zero.
    if (body?.balance === undefined || body?.total_used === undefined || !Number.isFinite(balance) || !Number.isFinite(used))
      return { available: false, reason: "unavailable", origin: "measured" };
    return { available: true, balanceUsd: balance, totalUsedUsd: used, origin: "measured", scope: "Toute l’équipe Vercel, toutes les clés, depuis l’origine." };
  } catch {
    return { available: false, reason: "unavailable", origin: "measured" };
  }
}

/** Sum of everything ai_usage holds, aggregated in Postgres (service client). */
export async function recordedAiSpend(service: SupabaseClient): Promise<GatewayCredits["recorded"]> {
  const { data, error } = await service.rpc("admin_ai_usage_by_model", { p_since: "1970-01-01T00:00:00Z" });
  if (error || !Array.isArray(data)) return null;
  let usd = 0;
  let calls = 0;
  let unpricedCalls = 0;
  for (const r of data as { calls?: number | string; cost_usd?: number | string | null; unpriced_input?: number | string; unpriced_output?: number | string }[]) {
    const stored = r.cost_usd === null || r.cost_usd === undefined ? 0 : Number(r.cost_usd);
    usd += Number.isFinite(stored) ? stored : 0;
    const n = Number(r.calls ?? 0) || 0;
    calls += n;
    // A group with unpriced tokens has at least one call without a stored cost; it is counted, not priced.
    if (Number(r.unpriced_input ?? 0) + Number(r.unpriced_output ?? 0) > 0) unpricedCalls += n;
  }
  return { usd: Math.round(usd * 1e6) / 1e6, calls, unpricedCalls, origin: "measured_or_estimated" };
}

export async function gatewayCredits(service: SupabaseClient, env: Env = process.env, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<GatewayCredits> {
  const [gateway, recorded] = await Promise.all([readGatewayBalance(env, fetchImpl), recordedAiSpend(service).catch(() => null)]);
  const gapUsd = gateway.available && recorded ? Math.round((gateway.totalUsedUsd - recorded.usd) * 1e6) / 1e6 : null;
  return { at: now.toISOString(), gateway, recorded, gapUsd, note: NOTE };
}
