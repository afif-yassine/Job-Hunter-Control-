import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plans. The free plan writes 2 application kits (a tailored CV + its letter)
 * per calendar month; searching, ranking and tracking stay unlimited.
 * Rewriting the kit of an offer already prepared this month is not counted.
 * The administrator and "pro" accounts are not limited by the plan (the daily
 * safety limits of lib/quota still apply). FREE_KITS_PER_MONTH overrides 2.
 */

export type Plan = "free" | "pro";
export const FREE_KITS_DEFAULT = 2;
export const PLAN_CODE = "PLAN_LIMIT";
/** Free accounts choose their kits themselves: the automatic pipeline never spends them. */
export const PLAN_MANUAL_CODE = "PLAN_MANUAL_ONLY";

type Env = Record<string, string | undefined>;

export function freeKitsPerMonth(env: Env = process.env): number {
  const value = env.FREE_KITS_PER_MONTH?.trim();
  const raw = value ? Number(value) : NaN;
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : FREE_KITS_DEFAULT;
}

/** First instant of the current month in Paris, as an ISO string. */
export function monthStartParis(now = new Date()): string {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(now).split("-");
  const guess = Date.parse(`${y}-${m}-01T00:00:00Z`);
  const offset = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime() - new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess - offset).toISOString();
}

/** "1er novembre": when the next free kits arrive. */
export function nextMonthLabel(now = new Date()): string {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(now).split("-").map(Number);
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 12));
  return `1er ${next.toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" })}`;
}

export type PlanUsage = { plan: Plan | "admin"; used: number; limit: number | null; resetsOn: string };

/** Offers that got a tailored CV this month (distinct), other than `exceptJobId`. */
async function kitsThisMonth(supabase: SupabaseClient, userId: string, exceptJobId?: string, now = new Date()): Promise<number | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("job_id")
    .eq("user_id", userId)
    .eq("kind", "TAILORED_CV")
    .gte("created_at", monthStartParis(now))
    .limit(2000);
  if (error) return null;
  const jobs = new Set(((data ?? []) as { job_id: string | null }[]).map((d) => d.job_id).filter((id): id is string => Boolean(id) && id !== exceptJobId));
  return jobs.size;
}

async function planOf(supabase: SupabaseClient, userId: string): Promise<Plan | "admin"> {
  const [admin, settings] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.from("user_settings").select("plan").eq("user_id", userId).maybeSingle(),
  ]);
  if (admin.data === true) return "admin";
  return (settings.data as { plan?: string } | null)?.plan === "pro" ? "pro" : "free";
}

/** For the dashboard: plan and kits used this month. */
export async function planUsage(supabase: SupabaseClient, userId: string, env: Env = process.env, now = new Date()): Promise<PlanUsage> {
  const plan = await planOf(supabase, userId);
  const used = (await kitsThisMonth(supabase, userId, undefined, now)) ?? 0;
  return { plan, used, limit: plan === "free" ? freeKitsPerMonth(env) : null, resetsOn: nextMonthLabel(now) };
}

/**
 * May this account write the kit of `jobId` now? Unavailable counters stop
 * paid work rather than treating missing information as an unused allowance.
 */
export async function checkPlan(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  env: Env = process.env,
  now = new Date(),
  automatic = false,
): Promise<{ ok: true } | { ok: false; status: number; body: { error: string; code: string } }> {
  const plan = await planOf(supabase, userId);
  if (plan !== "free") return { ok: true };
  if (automatic)
    return {
      ok: false,
      status: 402,
      body: { code: PLAN_MANUAL_CODE, error: "Offre gratuite : tu choisis toi-même les offres pour lesquelles écrire un CV et une lettre." },
    };
  const limit = freeKitsPerMonth(env);
  if (limit <= 0) return { ok: true };
  const used = await kitsThisMonth(supabase, userId, jobId, now);
  if (used === null) return {
    ok: false, status: 503,
    body: { code: "PLAN_UNAVAILABLE", error: "La vérification de ton offre est indisponible. Réessaie dans quelques instants ; aucun dossier n’a été facturé." },
  };
  if (used < limit) return { ok: true };
  return {
    ok: false,
    status: 402,
    body: {
      code: PLAN_CODE,
      error: `Offre gratuite : ${limit} dossiers (CV + lettre) par mois, déjà utilisés. Les prochains arrivent le ${nextMonthLabel(now)}. Tu peux toujours chercher, garder et suivre tes offres.`,
    },
  };
}
