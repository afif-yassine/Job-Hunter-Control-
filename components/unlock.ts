import { stageOf, type Stage } from "@/lib/journey";
import type { Job } from "@/lib/types";

/**
 * Which offers a student can work on ("déverrouillées"), and how a day's batch is shown.
 * Pure functions only: the server stays the only truth (it refuses the generation of a locked offer),
 * and every doubt here ends in "nothing is locked" — a student is never locked by mistake.
 */

export type UnlockEntry = { jobId: string; unlockedOn: string };

/** GET /api/offers/unlocked, as the contract says. `unlocked` is a list, or null with a reason. */
export type UnlockAnswer = { unlocked: UnlockEntry[] | null; reason: string | null };

export type UnlockState =
  /** The list (or the plan) is not known yet. */
  | { kind: "loading" }
  /** Nothing is locked: demo, paid or admin account, route absent, unreadable answer, empty list without a reason… */
  | { kind: "open"; why: "demo" | "paid" | "unknown-plan" | "failed" | "not-ready" | "all" | "empty" }
  /** Nothing is locked, and the student is told what to do: no batch could be made. */
  | { kind: "action"; need: "profile-vector" | "search" }
  /** The batches: offer id → day it was unlocked (Paris date, YYYY-MM-DD). */
  | { kind: "locking"; unlocked: Map<string, string> };

/** A well-formed answer, or null (anything else is treated as a failure, never as "everything locked"). */
export function parseUnlocked(body: unknown): UnlockAnswer | null {
  if (typeof body !== "object" || body === null || !("unlocked" in body)) return null;
  const { unlocked, reason } = body as { unlocked: unknown; reason?: unknown };
  const why = typeof reason === "string" && reason ? reason : null;
  if (unlocked === null) return { unlocked: null, reason: why };
  if (!Array.isArray(unlocked)) return null;
  const entries: UnlockEntry[] = [];
  for (const item of unlocked) {
    const e = item as { jobId?: unknown; unlockedOn?: unknown } | null;
    if (!e || typeof e.jobId !== "string" || !e.jobId || typeof e.unlockedOn !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(e.unlockedOn)) return null;
    entries.push({ jobId: e.jobId, unlockedOn: e.unlockedOn.slice(0, 10) });
  }
  return { unlocked: entries, reason: why };
}

export type PlanKnowledge = "loading" | "unknown" | "free" | "paid";

/**
 * The state of the locks. `fetch` is where the call stands, `answer` the parsed reply.
 * A paid or admin account is never locked; an unknown plan never locks; a doubt never locks.
 */
export function unlockState(input: { demo: boolean; plan: PlanKnowledge; fetch: "loading" | "failed" | "done"; answer: UnlockAnswer | null }): UnlockState {
  if (input.demo) return { kind: "open", why: "demo" };
  if (input.plan === "paid") return { kind: "open", why: "paid" };
  if (input.plan === "unknown") return { kind: "open", why: "unknown-plan" };
  if (input.plan === "loading" || input.fetch === "loading") return { kind: "loading" };
  if (input.fetch === "failed" || !input.answer) return { kind: "open", why: "failed" };
  const { unlocked, reason } = input.answer;
  if (reason === "all") return { kind: "open", why: "all" };
  if (unlocked === null) return { kind: "open", why: "not-ready" };
  if (unlocked.length > 0) return { kind: "locking", unlocked: new Map(unlocked.map((e) => [e.jobId, e.unlockedOn])) };
  if (reason === "NO_PROFILE_VECTOR") return { kind: "action", need: "profile-vector" };
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

/** "Aujourd'hui", "Hier", "Le 6 octobre" (with the year when it is not this year's). */
export function dayLabel(day: string, today: string): string {
  if (day === today) return "Aujourd’hui";
  if (day === shiftDay(today, -1)) return "Hier";
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const text = new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
  return `Le ${text}`;
}

export type UnlockGroup = { key: string; day: string | null; label: string; jobs: Job[] };

/**
 * The unlocked offers by the day they were unlocked, newest day first. Offers that are usable without being in a batch
 * (added by hand, already worked on) come last under "Déjà suivies". Locked offers are not in any group.
 */
export function groupByUnlockDay(jobs: Job[], state: UnlockState, hasKit: (job: Job) => boolean, today: string): UnlockGroup[] {
  const days = new Map<string, Job[]>();
  const followed: Job[] = [];
  for (const job of jobs) {
    if (!isUnlocked(job, state, hasKit(job))) continue;
    const day = state.kind === "locking" ? state.unlocked.get(job.id) : undefined;
    if (day) days.set(day, [...(days.get(day) ?? []), job]);
    else followed.push(job);
  }
  const groups: UnlockGroup[] = [...days.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([day, list]) => ({ key: day, day, label: dayLabel(day, today), jobs: list }));
  if (followed.length) groups.push({ key: "followed", day: null, label: "Déjà suivies", jobs: followed });
  return groups;
}

/** How many of these offers stay locked (the teaser says it as a number, never lists them). */
export function lockedCount(jobs: Job[], state: UnlockState, hasKit: (job: Job) => boolean): number {
  if (state.kind !== "locking") return 0;
  let n = 0;
  for (const job of jobs) if (!isUnlocked(job, state, hasKit(job))) n += 1;
  return n;
}
