import { stageOf, type Stage } from "@/lib/journey";
import type { Job } from "@/lib/types";

/**
 * Which offers a student can work on ("déverrouillées"), and how a day's batch is shown.
 * Pure functions only: the server stays the only truth (it refuses the generation of a locked offer),
 * and every doubt here ends in "nothing is locked" — a student is never locked by mistake.
 * Only the administrator is exempt by plan: a paying account gets the same offers as a free one.
 */

/** Said when the server could not prepare the day's selection (reason DEGRADED): the lock stays. */
export const COMPUTING_TEXT = "On prépare ta sélection du jour…";
export const DEGRADED_TEXT = "Ta sélection du jour n’a pas pu être préparée. Réessaie dans un moment.";

/** How many offers a day's batch holds at most. */
export const DAILY_LIMIT = 8;

/** "daily": a day's batch. "backfill": the offers an existing account already had when the batches began. "manual": added by hand or outside the catalogue, always open. */
export type UnlockOrigin = "daily" | "backfill" | "manual";
export type UnlockEntry = { jobId: string; unlockedOn: string; origin: UnlockOrigin };

/** GET /api/offers/unlocked, as the contract says. `unlocked` is a list, or null with a reason. */
export type UnlockAnswer = { unlocked: UnlockEntry[] | null; reason: string | null; /** Size of the day's batch, when the server says it. */ newToday?: number | null };

export type UnlockState =
  /** The list (or the plan) is not known yet. */
  | { kind: "loading" }
  /** Nothing is locked: demo, administrator, route absent, unreadable answer, empty list without a reason… */
  | { kind: "open"; why: "demo" | "admin" | "unknown-plan" | "failed" | "not-ready" | "all" | "empty" }
  /** Nothing is locked, and the student is told what to do: no batch could be made. */
  | { kind: "action"; need: "profile-vector" | "search" }
  /** The batches: offer id → the day it was unlocked (Paris date, YYYY-MM-DD) and where it comes from. */
  | { kind: "locking"; unlocked: Map<string, { day: string; origin: UnlockOrigin }>; newToday: number | null; /** The day's calculation failed: the lock stays, and the student is told. */ degraded: boolean; /** The day's batch is still being computed: "On prépare ta sélection du jour…". */ computing?: boolean };

/** A well-formed answer, or null (anything else is treated as a failure, never as "everything locked"). */
export function parseUnlocked(body: unknown): UnlockAnswer | null {
  if (typeof body !== "object" || body === null || !("unlocked" in body)) return null;
  const { unlocked, reason, newToday } = body as { unlocked: unknown; reason?: unknown; newToday?: unknown };
  const why = typeof reason === "string" && reason ? reason : null;
  const today = typeof newToday === "number" && Number.isFinite(newToday) && newToday >= 0 ? Math.floor(newToday) : null;
  if (unlocked === null) return { unlocked: null, reason: why, newToday: today };
  if (!Array.isArray(unlocked)) return null;
  const entries: UnlockEntry[] = [];
  for (const item of unlocked) {
    const e = item as { jobId?: unknown; unlockedOn?: unknown; origin?: unknown } | null;
    if (!e || typeof e.jobId !== "string" || !e.jobId || typeof e.unlockedOn !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(e.unlockedOn)) return null;
    // An absent or unknown origin is a daily batch.
    entries.push({ jobId: e.jobId, unlockedOn: e.unlockedOn.slice(0, 10), origin: e.origin === "backfill" || e.origin === "manual" ? e.origin : "daily" });
  }
  return { unlocked: entries, reason: why, newToday: today };
}

export type PlanKnowledge = "loading" | "unknown" | "known" | "admin";

/**
 * The state of the locks. `fetch` is where the call stands, `answer` the parsed reply.
 * The administrator is never locked; an unknown plan never locks; a doubt never locks.
 */
export function unlockState(input: { demo: boolean; plan: PlanKnowledge; fetch: "loading" | "failed" | "done"; answer: UnlockAnswer | null }): UnlockState {
  if (input.demo) return { kind: "open", why: "demo" };
  if (input.plan === "admin") return { kind: "open", why: "admin" };
  if (input.plan === "unknown") return { kind: "open", why: "unknown-plan" };
  if (input.plan === "loading" || input.fetch === "loading") return { kind: "loading" };
  if (input.fetch === "failed" || !input.answer) return { kind: "open", why: "failed" };
  const { unlocked, reason } = input.answer;
  if (reason === "all") return { kind: "open", why: "all" };
  if (unlocked === null) return { kind: "open", why: "not-ready" };
  // DEGRADED: the day's calculation failed and the server gave back what was already unlocked. The lock stays.
  const degraded = reason === "DEGRADED";
  // COMPUTING: the day's batch is still being worked out. The lock stays, even with an empty list.
  const computing = reason === "COMPUTING";
  const map = new Map(unlocked.map((e) => [e.jobId, { day: e.unlockedOn, origin: e.origin }]));
  if (unlocked.length > 0 || degraded || computing) return { kind: "locking", unlocked: map, newToday: input.answer.newToday ?? null, degraded, computing };
  // No offer matches enough: the student sees his (empty) selection, not the whole catalogue.
  if (reason === "NO_CANDIDATES" || reason === "NONE_ABOVE_THRESHOLD") return { kind: "locking", unlocked: map, newToday: 0, degraded: false };
  if (reason === "NO_PROFILE_VECTOR" || reason === "NO_PROFILE") return { kind: "action", need: "profile-vector" };
  if (reason === "NO_SEARCH") return { kind: "action", need: "search" };
  return { kind: "open", why: "empty" };
}

/** What to tell a student for whom no batch could be made. */
export function actionMessage(need: "profile-vector" | "search"): string {
  return need === "profile-vector"
    ? "On n’a pas encore pu classer les offres pour toi : réenregistre ton CV dans Réglages."
    : "Choisis tes métiers dans Réglages pour recevoir tes premières offres.";
}

/** An offer already worked on stays usable: kit written, or past "vue" (consulting an offer never unlocks it). */
const WORKED: ReadonlySet<Stage> = new Set<Stage>(["ready", "applied", "interview", "offer", "rejected"]);

/** Can the student work on this offer? Everything is unlocked unless the state is "locking". */
export function isUnlocked(job: Pick<Job, "id" | "stage" | "status" | "source_platform">, state: UnlockState, hasKit: boolean): boolean {
  if (state.kind !== "locking") return true;
  if (state.unlocked.has(job.id)) return true;
  if (job.source_platform === "manual") return true;
  if (hasKit) return true;
  return WORKED.has(stageOf(job));
}

/** Paris date of an instant, YYYY-MM-DD: the day a batch belongs to. */
export function parisDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const shiftDay = (day: string, delta: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

const longDate = (day: string, today: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }), timeZone: "UTC" });

/** "Aujourd'hui", "Hier", "Le 6 octobre" (with the year when it is not this year's). */
export function dayLabel(day: string, today: string): string {
  if (day === today) return "Aujourd’hui";
  if (day === shiftDay(today, -1)) return "Hier";
  return `Le ${longDate(day, today)}`;
}

export type UnlockGroup = { key: string; kind: "day" | "backfill" | "followed"; day: string | null; label: string; jobs: Job[] };

/**
 * The unlocked offers by the day they were unlocked, newest day first. The offers an account already had when the
 * batches began come next, under "Avant le [date]". Offers that are usable without being in a batch (added by hand,
 * already worked on) come last under "Déjà suivies". Locked offers are not in any group.
 */
export function groupByUnlockDay(jobs: Job[], state: UnlockState, hasKit: (job: Job) => boolean, today: string): UnlockGroup[] {
  const daily = new Map<string, Job[]>();
  const backfill = new Map<string, Job[]>();
  const followed: Job[] = [];
  for (const job of jobs) {
    if (!isUnlocked(job, state, hasKit(job))) continue;
    const entry = state.kind === "locking" ? state.unlocked.get(job.id) : undefined;
    if (!entry || entry.origin === "manual") followed.push(job);
    else {
      const bucket = entry.origin === "backfill" ? backfill : daily;
      bucket.set(entry.day, [...(bucket.get(entry.day) ?? []), job]);
    }
  }
  const newestFirst = ([a]: [string, Job[]], [b]: [string, Job[]]) => (a < b ? 1 : a > b ? -1 : 0);
  const groups: UnlockGroup[] = [
    ...[...daily.entries()].sort(newestFirst).map(([day, list]): UnlockGroup => ({ key: `day-${day}`, kind: "day", day, label: dayLabel(day, today), jobs: list })),
    ...[...backfill.entries()].sort(newestFirst).map(([day, list]): UnlockGroup => ({ key: `backfill-${day}`, kind: "backfill", day, label: `Avant le ${longDate(day, today)}`, jobs: list })),
  ];
  if (followed.length) groups.push({ key: "followed", kind: "followed", day: null, label: "Déjà suivies", jobs: followed });
  return groups;
}

/** How many offers of the day's batch (counted from the server's list, not from what the screen shows). */
export function todayBatchSize(state: UnlockState, today: string): number {
  if (state.kind !== "locking") return 0;
  // The server's own count when it gives one; otherwise the entries of today.
  if (state.newToday !== null) return state.newToday;
  let n = 0;
  for (const entry of state.unlocked.values()) if (entry.origin === "daily" && entry.day === today) n += 1;
  return n;
}

/**
 * The words of the zone under the day's offers. A student sees only his selection, so none of them says that the
 * catalogue is open: the owner's decision of 9 October. The 0 case points to Réglages (the only way to get offers).
 */
export function teaserText(batch: number): { title: string; text: string } {
  if (batch >= DAILY_LIMIT) return { title: "Tes offres du jour sont là", text: "Demain, de nouvelles offres choisies selon tes compétences. Celles que tu as déjà restent à toi." };
  if (batch <= 0) return { title: "Aujourd’hui, aucune offre ne correspond assez à ton profil", text: "Élargis tes métiers dans Réglages." };
  return {
    title: `Aujourd’hui, ${batch} offre${batch > 1 ? "s" : ""} ${batch > 1 ? "te correspondent" : "te correspond"}`,
    text: "On préfère t’en montrer peu que t’en montrer de mauvaises.",
  };
}

/**
 * Does the student see this offer in his lists? THE one place of the rule: today a free and a paying account see
 * exactly their selection (what is unlocked, added by hand, or already worked on); changing what a paying account
 * sees is a one-line change here. Outside the "locking" state (administrator, demo, any doubt) everything is seen.
 */
export function studentSees(job: Pick<Job, "id" | "stage" | "status" | "source_platform">, state: UnlockState, hasKit: boolean): boolean {
  return isUnlocked(job, state, hasKit);
}

/** The drawn silhouettes of the teaser: 4 to 6, never a picture of real offers. */
export function silhouetteCount(locked: number): number {
  return Math.min(6, Math.max(4, Math.floor(locked)));
}

/** How many of these offers stay locked (the teaser says it as a number, never lists them). */
export function lockedCount(jobs: Job[], state: UnlockState, hasKit: (job: Job) => boolean): number {
  if (state.kind !== "locking") return 0;
  let n = 0;
  for (const job of jobs) if (!isUnlocked(job, state, hasKit(job))) n += 1;
  return n;
}
