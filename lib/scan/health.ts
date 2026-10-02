import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScannedOffer } from "./types";

/**
 * Health, budgets and cache of the offer sources, shared by the whole
 * platform. Every run is recorded; quota, refused key or error alert the
 * admins (at most once per source and problem every 6 hours, and once when
 * the source recovers). Nothing here ever blocks a scan if the database side
 * is unavailable.
 */

export type SourceStatus = "ok" | "quota" | "budget" | "auth" | "error";

/** Stable identifiers, used in the database and the admin page. */
export type SourceId =
  | "francetravail"
  | "jsearch"
  | "adzuna"
  | "jooble"
  | "lba"
  | "gmail"
  | "webhook"
  | "ats:greenhouse"
  | "ats:lever"
  | "ats:ashby"
  | "ats:smartrecruiters"
  | "ats:workable"
  | "ats:recruitee"
  | "ft:formation"
  | "ft:marche"
  | "ft:acces";

export function classifyError(message: string): Exclude<SourceStatus, "ok" | "budget"> {
  if (/quota|429|rate.?limit|too many requests|exceeded|RESOURCE_EXHAUSTED|limite atteinte/i.test(message)) return "quota";
  if (/\b(401|403)\b|unauthori[sz]ed|forbidden|refus[ée]e?s?|invalid.*key|api key|cl[ée]s? (refus|invalide)/i.test(message))
    return "auth";
  return "error";
}

export class BudgetReached extends Error {
  constructor(source: string, limit: number, period: string) {
    super(`Budget gratuit atteint pour ${source} (${limit} appels${period === "all" ? " au total" : period.length === 7 ? " ce mois-ci" : " aujourd’hui"}).`);
    this.name = "BudgetReached";
  }
}

type Env = Record<string, string | undefined>;

/** Free-plan limits, counted for the whole platform (not per account). */
export function budgetFor(source: SourceId, env: Env = process.env, now = new Date()): { period: string; limit: number } | null {
  const month = now.toISOString().slice(0, 7);
  const day = now.toISOString().slice(0, 10);
  const num = (name: string, fallback: number) => {
    const n = Number(env[name]);
    return env[name] !== undefined && env[name] !== "" && Number.isFinite(n) ? Math.floor(n) : fallback;
  };
  switch (source) {
    // JSearch Basic: 200 requests / month → keep a margin.
    case "jsearch":
      return { period: month, limit: num("JSEARCH_MONTHLY_BUDGET", 180) };
    // Adzuna free: 250 calls / day, 2 500 / month.
    case "adzuna":
      return { period: day, limit: num("ADZUNA_DAILY_BUDGET", 240) };
    // Jooble: small total quota per key.
    case "jooble":
      return { period: "all", limit: num("JOOBLE_TOTAL_BUDGET", 450) };
    default:
      return null;
  }
}

/** A fetch that spends one unit of the shared budget per request. */
export function budgetedFetch(
  supabase: SupabaseClient,
  source: SourceId,
  budget: { period: string; limit: number },
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (budget.limit > 0) {
      const { data, error } = await supabase.rpc("consume_source_budget", {
        p_source: source,
        p_period: budget.period,
        p_limit: budget.limit,
      });
      // A missing counter never blocks a search.
      if (!error && data === false) throw new BudgetReached(source, budget.limit, budget.period);
    }
    return fetchImpl(input, init);
  }) as typeof fetch;
}

export async function recordSourceRun(
  supabase: SupabaseClient,
  source: SourceId,
  status: SourceStatus,
  found: number,
  message?: string | null,
  cached = false,
): Promise<void> {
  try {
    await supabase.rpc("record_source_run", {
      p_source: source,
      p_status: status,
      p_found: found,
      p_message: message ?? null,
      p_cached: cached,
    });
  } catch {
    // Health is informative only.
  }
}

/* Shared cache: the same search for two accounts calls the source once. ------ */

export function cacheKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);
}

export async function readCache(
  db: SupabaseClient | null,
  source: SourceId,
  key: string,
  ttlHours: number,
  now = Date.now(),
): Promise<ScannedOffer[] | null> {
  if (!db || ttlHours <= 0) return null;
  const { data, error } = await db
    .from("source_cache")
    .select("offers,fetched_at")
    .eq("source", source)
    .eq("cache_key", key)
    .maybeSingle();
  if (error || !data) return null;
  if (now - Date.parse(data.fetched_at) > ttlHours * 3_600_000) return null;
  return Array.isArray(data.offers) ? (data.offers as ScannedOffer[]) : null;
}

export async function writeCache(db: SupabaseClient | null, source: SourceId, key: string, offers: ScannedOffer[]) {
  if (!db) return;
  await db
    .from("source_cache")
    .upsert({ source, cache_key: key, offers, fetched_at: new Date().toISOString() }, { onConflict: "source,cache_key" });
}

export function cacheHours(env: Env = process.env): number {
  const n = Number(env.SOURCE_CACHE_HOURS);
  return env.SOURCE_CACHE_HOURS && Number.isFinite(n) && n >= 0 ? n : 12;
}
