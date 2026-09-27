import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Daily limits per account, so that one very active account cannot blow the
 * AI or browser budget before billing exists. Days follow Paris time.
 * Override with QUOTA_SCANS_PER_DAY / QUOTA_ANALYSES_PER_DAY /
 * QUOTA_GENERATIONS_PER_DAY (0 = unlimited).
 */

export type QuotaKind = "scan" | "analysis" | "generation";

export const QUOTA_DEFAULTS: Record<QuotaKind, number> = { scan: 3, analysis: 20, generation: 10 };

const VARIABLE: Record<QuotaKind, string> = {
  scan: "QUOTA_SCANS_PER_DAY",
  analysis: "QUOTA_ANALYSES_PER_DAY",
  generation: "QUOTA_GENERATIONS_PER_DAY",
};

type Env = Record<string, string | undefined>;

export function quotaLimit(kind: QuotaKind, env: Env = process.env): number {
  const raw = env[VARIABLE[kind]]?.trim();
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : QUOTA_DEFAULTS[kind];
}

/** Recognised by the pipeline to stop a phase instead of retrying. */
export const QUOTA_CODE = "QUOTA_REACHED";

const WHAT: Record<QuotaKind, string> = {
  scan: "recherches manuelles",
  analysis: "analyses d’offres",
  generation: "rédactions de CV et lettre",
};

export function quotaMessage(kind: QuotaKind, limit: number): string {
  return `Limite du jour atteinte : ${limit} ${WHAT[kind]} par jour. La suite reprendra demain automatiquement.`;
}

/**
 * Records one use if the account is under today's limit.
 * If the counter itself is unavailable (migration missing), the action is
 * allowed: a broken counter must never block the user.
 */
export async function consumeQuota(
  supabase: SupabaseClient,
  userId: string,
  kind: QuotaKind,
  env: Env = process.env,
): Promise<{ ok: boolean; limit: number }> {
  const limit = quotaLimit(kind, env);
  if (limit <= 0) return { ok: true, limit };
  const { data, error } = await supabase.rpc("consume_quota", {
    p_user_id: userId,
    p_kind: kind,
    p_limit: limit,
  });
  if (error) return { ok: true, limit };
  return { ok: data !== false, limit };
}

export function quotaRefusal(kind: QuotaKind, limit: number) {
  return { status: 429, body: { error: quotaMessage(kind, limit), code: QUOTA_CODE, kind } };
}

export type Usage = Record<QuotaKind, { used: number; limit: number }>;

/** Today's counters, for the dashboard. */
export async function usageToday(supabase: SupabaseClient, userId: string, env: Env = process.env): Promise<Usage | null> {
  const now = new Date();
  // Midnight in Paris, expressed in UTC (DST-safe enough for a counter display).
  const parisDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  const offset = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const start = new Date(Date.parse(`${parisDay}T00:00:00Z`) - offset).toISOString();
  const { data, error } = await supabase
    .from("usage_events")
    .select("kind")
    .eq("user_id", userId)
    .gte("created_at", start)
    .limit(1000);
  if (error) return null;
  const count = (kind: QuotaKind) => ((data ?? []) as { kind: string }[]).filter((r) => r.kind === kind).length;
  return {
    scan: { used: count("scan"), limit: quotaLimit("scan", env) },
    analysis: { used: count("analysis"), limit: quotaLimit("analysis", env) },
    generation: { used: count("generation"), limit: quotaLimit("generation", env) },
  };
}
