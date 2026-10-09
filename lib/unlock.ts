import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminId } from "./admin";
import { configFromPrefs, hasChosenSearch } from "./scan/config";
import { importFromCatalogue, offerFingerprint, type CatalogueEntry } from "./scan/catalogue";
import { ingestOffers } from "./scan/ingest";
import type { ScannedOffer } from "./scan/types";
import { loadUserSettings } from "./settings";
import { profileSkills } from "./skills";
import { serviceClient } from "./supabase/admin";
import { DAILY_LIMIT, selectDaily, type UnlockCandidate, type UnlockReason } from "./unlock-select";

/**
 * Daily unlocking of catalogue offers (migration 20261009090000). Every account but the
 * administrator reads at most DAILY_LIMIT new offers a day; an unlocked offer stays unlocked.
 *
 * Until the migration is applied the table does not exist: `unlockGate` is then inactive and
 * everything behaves as before. An unreadable table never locks anybody out.
 */

export const OFFER_LOCKED = "OFFER_LOCKED";
export const OFFER_LOCKED_MESSAGE = "Cette offre n’a pas encore été recommandée. 8 nouvelles offres arrivent chaque jour.";

export type UnlockOrigin = "daily" | "backfill" | "manual";
export type UnlockedEntry = { jobId: string; unlockedOn: string; origin: UnlockOrigin };

/** Why a lot is empty or short, for the front to tell the student what to do. */
export type UnlockNote =
  | UnlockReason
  | "NO_SEARCH"
  | "NO_PROFILE"
  /** The CV has no vector: the lot was chosen on skills alone. */
  | "NO_PROFILE_VECTOR"
  /** The selection failed today: the offers unlocked so far are shown, nothing new. */
  | "DEGRADED"
  /** Today's lot is still being computed: ask again in a few seconds. */
  | "COMPUTING";

type Row = { offer_id: string; unlocked_on: string; origin: "daily" | "backfill" };

const parisDay = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
const chunks = <T>(list: T[], size = 100): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** The account's unlock rows, or null when the table is missing or unreadable. */
export async function readUnlocks(db: SupabaseClient, userId: string): Promise<Row[] | null> {
  const { data, error } = await db.from("offer_unlocks").select("offer_id,unlocked_on,origin").eq("user_id", userId).limit(5000);
  return error ? null : ((data ?? []) as Row[]);
}

export type Gate = { active: false } | { active: true; rows: Row[]; service: SupabaseClient };

/**
 * Whether the daily unlock applies to this account now. Inactive (= nothing is locked) for the
 * administrator, without a service client to unlock with, or while the table is not there.
 */
export async function unlockGate(db: SupabaseClient, userId: string, service: SupabaseClient | null = serviceClient()): Promise<Gate> {
  if (!service) return { active: false };
  if (await isAdminId(db, userId)) return { active: false };
  const rows = await readUnlocks(db, userId);
  return rows ? { active: true, rows, service } : { active: false };
}

/**
 * May the account work on this offer (write its kit, analyse it)? A job that does not come from the
 * catalogue (typed by hand) is always open. Only the presence of the offer in offer_unlocks counts:
 * never a date, never a column the account can edit itself.
 */
export async function offerLocked(db: SupabaseClient, userId: string, job: { offer_id?: string | null }): Promise<boolean> {
  if (!job.offer_id) return false;
  if (await isAdminId(db, userId)) return false;
  const { data, error } = await db.from("offer_unlocks").select("offer_id").eq("user_id", userId).eq("offer_id", job.offer_id).limit(1);
  if (error) return false; // table missing or unreadable: as before the feature
  return !(data ?? []).length;
}

type Copy = { inserted: number; error?: string };

/** Puts the account's own copy of each offer in its list (skips the ones it already holds). */
export async function copyOffersToJobs(db: SupabaseClient, userId: string, offerIds: string[]): Promise<Copy> {
  if (!offerIds.length) return { inserted: 0 };
  const held = new Set<string>();
  for (const part of chunks(offerIds)) {
    const { data } = await db.from("jobs").select("offer_id").eq("user_id", userId).in("offer_id", part);
    for (const j of (data ?? []) as { offer_id: string }[]) held.add(j.offer_id);
  }
  const missing = offerIds.filter((id) => !held.has(id));
  if (!missing.length) return { inserted: 0 };
  const offers: ScannedOffer[] = [];
  const entries = new Map<string, CatalogueEntry>();
  for (const part of chunks(missing)) {
    const { data, error } = await db
      .from("offers")
      .select("id,fingerprint,title,company,location,contract_type,source,url,apply_url,published_at,rome_code,board,description")
      .in("id", part);
    if (error) return { inserted: 0, error: error.message };
    for (const r of (data ?? []) as Record<string, string | null>[]) {
      const offer: ScannedOffer = {
        source: String(r.source), company: String(r.company), title: String(r.title), location: r.location, contract_type: r.contract_type,
        description: r.description, url: String(r.url), applyUrl: r.apply_url, publishedAt: r.published_at, romeCode: r.rome_code, board: r.board ?? undefined,
      };
      offers.push(offer);
      entries.set(offerFingerprint(offer), { id: String(r.id), status: "open" });
      if (r.fingerprint) entries.set(r.fingerprint, { id: String(r.id), status: "open" });
    }
  }
  const result = await ingestOffers(db, userId, offers, entries);
  return { inserted: result.inserted, error: result.error };
}

export type BatchResult = { newlyUnlocked: number; inserted: number; note?: UnlockNote };

/** Non-sensitive trace of one computation: the last step reached and the time spent in each (milliseconds). */
export type BatchTrace = {
  step: string;
  ms: Record<string, number>;
  totalMs: number;
  done: boolean;
  result?: BatchResult;
  /** How many candidates fell at each filter (counts only, no offer, no profile). */
  funnel?: { pool: number; alreadyUnlocked: number; wrongContract: number; unread: number; fewCommonSkills: number; passing: number; chosen: number };
};

const newTrace = (): BatchTrace => ({ step: "start", ms: {}, totalMs: 0, done: false });

/**
 * Today's lot for one account: chosen from the shared catalogue with the search and the CV, claimed
 * on the server (at most once a day, whatever the number of open tabs), then copied into the list.
 * Offers unlocked recently whose copy is missing are copied too (a run that stopped halfway heals).
 * Never throws: a failure leaves what is unlocked as it was and says DEGRADED. `trace` is filled as it goes.
 */
export async function ensureDailyBatch(db: SupabaseClient, gate: Extract<Gate, { active: true }>, userId: string, now = new Date(), trace: BatchTrace = newTrace()): Promise<BatchResult> {
  const began = Date.now();
  let last = began;
  const at = (step: string) => {
    const t = Date.now();
    trace.ms[trace.step] = (trace.ms[trace.step] ?? 0) + (t - last);
    trace.step = step;
    trace.totalMs = t - began;
    last = t;
  };
  const end = (result: BatchResult): BatchResult => {
    at("done");
    trace.done = true;
    trace.result = result;
    return result;
  };
  try {
    const unlocked = new Set(gate.rows.map((r) => r.offer_id));
    const today = parisDay(now);
    // Heal: an offer unlocked by a run that stopped before copying it. Backfilled offers come from the list
    // itself, and old lots were copied long ago: only the lots of the last three days are checked.
    at("heal");
    const since = parisDay(new Date(now.getTime() - 3 * 86_400_000));
    const healable = gate.rows.filter((r) => r.origin === "daily" && r.unlocked_on >= since).map((r) => r.offer_id);
    let inserted = (await copyOffersToJobs(db, userId, healable)).inserted;
    if (gate.rows.some((r) => r.origin === "daily" && r.unlocked_on === today)) return end({ newlyUnlocked: 0, inserted });

    at("settings");
    const settings = await loadUserSettings(db, userId);
    if (!hasChosenSearch(settings.prefs)) return end({ newlyUnlocked: 0, inserted, note: "NO_SEARCH" });
    at("profile");
    const { data: profile } = await db.from("candidate_profiles").select("profile,skills,semantic_hash").eq("user_id", userId).maybeSingle();
    const p = profile as { profile?: Record<string, unknown> | null; skills?: unknown; semantic_hash?: string | null } | null;
    if (!p?.profile) return end({ newlyUnlocked: 0, inserted, note: "NO_PROFILE" });
    const mySkills = Array.isArray(p.skills) && p.skills.length ? (p.skills as string[]) : profileSkills(p.profile);

    at("catalogue");
    const config = configFromPrefs(settings.prefs);
    const found = await importFromCatalogue(db, config);
    if (found.error) return end({ newlyUnlocked: 0, inserted, note: "DEGRADED" });
    at("select");
    const candidates: UnlockCandidate[] = [...found.meta.entries()].map(([id, m]) => ({ id, similarity: m.similarity, skills: m.skills, kind: m.kind, publishedAt: m.publishedAt }));
    const selection = selectDaily({ candidates, profileSkills: mySkills, contracts: config.contracts ?? [], unlocked });
    trace.funnel = {
      pool: selection.pool, alreadyUnlocked: selection.alreadyUnlocked, wrongContract: selection.wrongContract, unread: selection.unread,
      fewCommonSkills: selection.fewCommonSkills, passing: selection.passing, chosen: selection.chosen.length,
    };
    if (!selection.chosen.length) return end({ newlyUnlocked: 0, inserted, note: selection.reason });

    at("claim");
    const claimed = await gate.service.rpc("claim_daily_unlock", { p_user: userId, p_offer_ids: selection.chosen.map((c) => c.id), p_limit: DAILY_LIMIT });
    if (claimed.error) return end({ newlyUnlocked: 0, inserted, note: "DEGRADED" });
    const ids = ((claimed.data ?? []) as { o_offer_id: string }[]).map((r) => r.o_offer_id);
    at("copy");
    inserted += (await copyOffersToJobs(db, userId, ids)).inserted;
    const vectorless = !p.semantic_hash && selection.chosen.every((c) => c.similarity === null);
    return end({ newlyUnlocked: ids.length, inserted, note: vectorless ? "NO_PROFILE_VECTOR" : undefined });
  } catch {
    return end({ newlyUnlocked: 0, inserted: 0, note: "DEGRADED" });
  } finally {
    await logBatch(db, userId, trace).catch(() => undefined);
  }
}

/**
 * One non-sensitive line in agent_runs (never the content of an offer or a profile) for each computation that
 * went further than "today's lot already exists", including the ones that were cut before the end.
 */
async function logBatch(db: SupabaseClient, userId: string, trace: BatchTrace) {
  const reachedSettings = trace.ms.settings !== undefined || !["start", "heal", "done"].includes(trace.step);
  if (trace.done && !reachedSettings) return;
  const now = new Date().toISOString();
  const result = trace.result;
  await db.from("agent_runs").insert({
    user_id: userId,
    run_type: "DAILY_UNLOCK",
    status: trace.done && result?.note !== "DEGRADED" ? "COMPLETED" : "FAILED",
    started_at: now,
    finished_at: now,
    counters: { step: trace.step, done: trace.done, totalMs: trace.totalMs, ms: trace.ms, newlyUnlocked: result?.newlyUnlocked ?? 0, copied: result?.inserted ?? 0, note: result?.note ?? null, funnel: trace.funnel ?? null },
  });
}

export type UnlockedState =
  | { mode: "all" }
  | { mode: "not_ready" }
  | {
      mode: "list";
      unlocked: UnlockedEntry[];
      note?: UnlockNote;
      newToday: number;
      /** Non-sensitive: last step reached and the time spent. */
      diag: { step: string; totalMs: number; done: boolean };
      /** Today's lot is still being computed: the caller keeps this promise alive after answering, and the screen asks again. */
      pending?: Promise<unknown>;
    };

/** The longest the answer waits for today's lot before replying with what is already unlocked. */
export const LOT_BUDGET_MS = 5000;

/** What /api/offers/unlocked answers: the administrator sees everything; others the offers they unlocked. */
export async function unlockedState(db: SupabaseClient, userId: string, now = new Date(), service: SupabaseClient | null = serviceClient(), budgetMs = LOT_BUDGET_MS): Promise<UnlockedState> {
  const gate = await unlockGate(db, userId, service);
  if (!gate.active) return (await isAdminId(db, userId)) ? { mode: "all" } : { mode: "not_ready" };
  const trace = newTrace();
  const run = ensureDailyBatch(db, gate, userId, now, trace);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"late">((resolve) => { timer = setTimeout(() => resolve("late"), budgetMs); });
  const outcome = await Promise.race([run, timeout]);
  clearTimeout(timer);
  const late = outcome === "late";
  const batch: BatchResult = late ? { newlyUnlocked: 0, inserted: 0, note: "COMPUTING" } : outcome;
  const rows = (await readUnlocks(db, userId)) ?? gate.rows;
  const byOffer = new Map(rows.map((r) => [r.offer_id, r]));
  const unlocked: UnlockedEntry[] = [];
  for (const part of chunks([...byOffer.keys()])) {
    const { data } = await db.from("jobs").select("id,offer_id").eq("user_id", userId).in("offer_id", part);
    for (const j of (data ?? []) as { id: string; offer_id: string }[]) {
      const row = byOffer.get(j.offer_id);
      if (row) unlocked.push({ jobId: j.id, unlockedOn: row.unlocked_on, origin: row.origin });
    }
  }
  // Jobs typed by hand (no catalogue offer) are always open.
  const { data: manual } = await db.from("jobs").select("id,created_at").eq("user_id", userId).is("offer_id", null).limit(500);
  for (const j of (manual ?? []) as { id: string; created_at?: string | null }[])
    unlocked.push({ jobId: j.id, unlockedOn: (j.created_at ?? new Date(now).toISOString()).slice(0, 10), origin: "manual" });
  unlocked.sort((a, b) => b.unlockedOn.localeCompare(a.unlockedOn));
  return { mode: "list", unlocked, note: batch.note, newToday: batch.newlyUnlocked, diag: { step: trace.step, totalMs: trace.totalMs, done: trace.done }, pending: late ? run : undefined };
}
