import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plans. The free plan writes 2 application kits (a tailored CV + its letter)
 * per calendar month; searching, ranking and tracking stay unlimited.
 * Rewriting the kit of an offer already prepared this month is not counted.
 * The administrator is not limited by the plan. A "pro" account has monthly
 * ceilings held by the server (never unlimited): PRO_KITS_PER_MONTH (30),
 * PRO_REVISIONS_PER_MONTH (90), PRO_ANALYSES_PER_MONTH (600); the daily safety
 * limits of lib/quota still apply to everybody. FREE_KITS_PER_MONTH overrides 2.
 * Nothing here takes a payment or gives anyone the "pro" plan: that stays a manual act.
 */

export type Plan = "free" | "pro";
export const FREE_KITS_DEFAULT = 2;
export const PLAN_CODE = "PLAN_LIMIT";
/** A paid account reached a monthly ceiling (analyses or revisions). */
export const PLAN_MONTHLY_CODE = "PLAN_MONTHLY_CAP";
/** Free accounts choose their kits themselves: the automatic pipeline never spends them. */
export const PLAN_MANUAL_CODE = "PLAN_MANUAL_ONLY";

type Env = Record<string, string | undefined>;

export const PRO_DEFAULTS = { kits: 30, revisions: 90, analyses: 600 } as const;
const PRO_VARIABLES = { kits: "PRO_KITS_PER_MONTH", revisions: "PRO_REVISIONS_PER_MONTH", analyses: "PRO_ANALYSES_PER_MONTH" } as const;
export type ProCap = keyof typeof PRO_DEFAULTS;

/** A paid account's monthly ceiling: the environment may change it, but 0 or nonsense never means "unlimited". */
export function proCap(cap: ProCap, env: Env = process.env): number {
  const raw = env[PRO_VARIABLES[cap]]?.trim();
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : PRO_DEFAULTS[cap];
}

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

/**
 * Offers that got a tailored CV this month (distinct), other than `exceptJobId`. Two witnesses: the
 * documents (which the student can delete) and the "kit" lines of usage_events, which the account can
 * neither edit nor delete (migration 20261008090000; before it only the documents count).
 */
async function kitsThisMonth(supabase: SupabaseClient, userId: string, exceptJobId?: string, now = new Date()): Promise<number | null> {
  const since = monthStartParis(now);
  const [docs, events] = await Promise.all([
    supabase.from("documents").select("job_id").eq("user_id", userId).eq("kind", "TAILORED_CV").gte("created_at", since).limit(2000),  // real cap: 1 000 rows per request
    supabase.from("usage_events").select("job_id").eq("user_id", userId).eq("kind", "kit").gte("created_at", since).limit(2000),  // real cap: 1 000 rows per request
  ]);
  if (docs.error) return null;
  const rows = [...((docs.data ?? []) as { job_id: string | null }[]), ...(events.error ? [] : ((events.data ?? []) as { job_id: string | null }[]))];
  const jobs = new Set(rows.map((d) => d.job_id).filter((id): id is string => Boolean(id) && id !== exceptJobId));
  return jobs.size;
}

/** Writes the server-held trace of a new kit (one line per offer and month). Best effort: never blocks the kit. */
export async function recordKit(supabase: SupabaseClient, userId: string, jobId: string, now = new Date()): Promise<void> {
  try {
    const { data, error } = await supabase.from("usage_events").select("id").eq("user_id", userId).eq("kind", "kit").eq("job_id", jobId).gte("created_at", monthStartParis(now)).limit(1);
    if (error || (data ?? []).length) return; // before the migration, or already recorded this month
    await supabase.from("usage_events").insert({ user_id: userId, kind: "kit", job_id: jobId });
  } catch {
    // the documents remain a witness
  }
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
  const limit = plan === "free" ? freeKitsPerMonth(env) : plan === "pro" ? proCap("kits", env) : null;
  return { plan, used, limit, resetsOn: nextMonthLabel(now) };
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
  if (plan === "admin") return { ok: true };
  if (plan === "pro") return checkProKits(supabase, userId, jobId, env, now);
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

async function checkProKits(supabase: SupabaseClient, userId: string, jobId: string, env: Env, now: Date) {
  const limit = proCap("kits", env);
  const used = await kitsThisMonth(supabase, userId, jobId, now);
  if (used === null)
    return { ok: false as const, status: 503, body: { code: "PLAN_UNAVAILABLE", error: "La vérification de ta formule est indisponible. Réessaie dans quelques instants ; aucun dossier n’a été facturé." } };
  if (used < limit) return { ok: true as const };
  return {
    ok: false as const,
    status: 402,
    body: { code: PLAN_CODE, error: `Formule Plus : ${limit} dossiers (CV + lettre) par mois, déjà utilisés. Les prochains arrivent le ${nextMonthLabel(now)}.` },
  };
}

/**
 * Monthly ceilings of a paid account for AI analyses and CV/letter revisions (the free plan is bound by the
 * daily limits only; the administrator by nothing). Counted from usage_events, which an account cannot
 * delete. An unreadable counter stops the paid call.
 */
export async function checkMonthlyCap(
  supabase: SupabaseClient,
  userId: string,
  kind: "analysis" | "revision",
  env: Env = process.env,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; status: number; body: { error: string; code: string } }> {
  const plan = await planOf(supabase, userId);
  if (plan !== "pro") return { ok: true };
  const limit = proCap(kind === "analysis" ? "analyses" : "revisions", env);
  const { data, error } = await supabase.from("usage_events").select("id").eq("user_id", userId).eq("kind", kind).gte("created_at", monthStartParis(now)).limit(limit + 1);
  if (error)
    return { ok: false, status: 503, body: { code: "PLAN_UNAVAILABLE", error: "La vérification de ta formule est indisponible. Réessaie dans quelques instants ; aucun appel IA n’a été lancé." } };
  if ((data ?? []).length < limit) return { ok: true };
  const what = kind === "analysis" ? "analyses d’offres" : "modifications de CV et de lettre";
  return { ok: false, status: 429, body: { code: PLAN_MONTHLY_CODE, error: `Formule Plus : ${limit} ${what} par mois, déjà utilisées. La suite reprend le ${nextMonthLabel(now)}.` } };
}
