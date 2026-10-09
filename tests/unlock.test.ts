import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMPUTING_TEXT,
  DEGRADED_TEXT,
  actionMessage,
  dayLabel,
  groupByUnlockDay,
  isUnlocked,
  lockedCount,
  parisDay,
  parseUnlocked,
  silhouetteCount,
  studentSees,
  teaserText,
  todayBatchSize,
  unlockState,
  type UnlockOrigin,
  type UnlockState,
} from "../components/unlock";
import type { Job } from "../lib/types";

const job = (id: string, extra: Record<string, unknown> = {}) => ({ id, stage: "new", status: "ANALYZED", source_platform: "francetravail", ...extra }) as unknown as Job;
/** id → "2026-10-08" (a daily batch) or "2026-10-08/backfill". */
const locking = (entries: Record<string, string>): UnlockState => ({
  kind: "locking",
  unlocked: new Map(Object.entries(entries).map(([id, v]) => [id, { day: v.slice(0, 10), origin: (v.endsWith("/backfill") ? "backfill" : v.endsWith("/manual") ? "manual" : "daily") as UnlockOrigin }])),
  newToday: null,
  degraded: false,
});
const noKit = () => false;

test("an answer is read as the contract says, and anything else is not an answer", () => {
  assert.deepEqual(parseUnlocked({ unlocked: [{ jobId: "a", unlockedOn: "2026-10-08" }] }), { unlocked: [{ jobId: "a", unlockedOn: "2026-10-08", origin: "daily" }], reason: null, newToday: null });
  assert.deepEqual(parseUnlocked({ unlocked: [], reason: "NO_SEARCH", newToday: null }), { unlocked: [], reason: "NO_SEARCH", newToday: null });
  assert.deepEqual(parseUnlocked({ unlocked: null, reason: "NOT_READY", newToday: null }), { unlocked: null, reason: "NOT_READY", newToday: null });
  // A timestamp keeps only its day.
  assert.equal(parseUnlocked({ unlocked: [{ jobId: "a", unlockedOn: "2026-10-08T07:00:00Z" }] })?.unlocked?.[0].unlockedOn, "2026-10-08");
  for (const bad of [null, undefined, "x", 3, {}, { unlocked: "all" }, { unlocked: [{ jobId: "a" }] }, { unlocked: [{ jobId: "", unlockedOn: "2026-10-08" }] }, { unlocked: [{ jobId: "a", unlockedOn: "hier" }] }, { unlocked: [null] }])
    assert.equal(parseUnlocked(bad), null, JSON.stringify(bad));
});

test("the origin of an entry is daily unless the server says backfill; an unknown origin is daily", () => {
  const read = (origin?: unknown) => parseUnlocked({ unlocked: [{ jobId: "a", unlockedOn: "2026-10-08", ...(origin === undefined ? {} : { origin }) }] })?.unlocked?.[0].origin;
  assert.equal(read(), "daily");
  assert.equal(read("daily"), "daily");
  assert.equal(read("backfill"), "backfill");
  assert.equal(read("something-new"), "daily");
  assert.equal(read(7), "daily");
});

test("a doubt never locks: demo, administrator, unknown plan, failure, absent route, unreadable answer", () => {
  const answer = { unlocked: [{ jobId: "a", unlockedOn: "2026-10-08", origin: "daily" as const }], reason: null };
  assert.deepEqual(unlockState({ demo: true, plan: "known", fetch: "done", answer }), { kind: "open", why: "demo" });
  assert.deepEqual(unlockState({ demo: false, plan: "admin", fetch: "done", answer }), { kind: "open", why: "admin" });
  assert.deepEqual(unlockState({ demo: false, plan: "admin", fetch: "loading", answer: null }), { kind: "open", why: "admin" });
  assert.deepEqual(unlockState({ demo: false, plan: "unknown", fetch: "done", answer }), { kind: "open", why: "unknown-plan" });
  assert.deepEqual(unlockState({ demo: false, plan: "known", fetch: "failed", answer: null }), { kind: "open", why: "failed" });
  assert.deepEqual(unlockState({ demo: false, plan: "known", fetch: "done", answer: null }), { kind: "open", why: "failed" });
});

test("a paying account is locked exactly like a free one: only the administrator is exempt", () => {
  // The plan the dashboard passes for both a free and a paying account is "known": same answer, same locks.
  const answer = { unlocked: [{ jobId: "a", unlockedOn: "2026-10-08", origin: "daily" as const }], reason: null };
  assert.equal(unlockState({ demo: false, plan: "known", fetch: "done", answer }).kind, "locking");
});

test("while the plan or the list is still being read, nothing is decided yet", () => {
  assert.deepEqual(unlockState({ demo: false, plan: "loading", fetch: "done", answer: null }), { kind: "loading" });
  assert.deepEqual(unlockState({ demo: false, plan: "known", fetch: "loading", answer: null }), { kind: "loading" });
});

test("the server's own reasons are followed: all, not ready, empty without reason", () => {
  const done = { demo: false, plan: "known", fetch: "done" } as const;
  assert.deepEqual(unlockState({ ...done, answer: { unlocked: null, reason: "all" } }), { kind: "open", why: "all" });
  assert.deepEqual(unlockState({ ...done, answer: { unlocked: null, reason: "NOT_READY" } }), { kind: "open", why: "not-ready" });
  assert.deepEqual(unlockState({ ...done, answer: { unlocked: [], reason: null } }), { kind: "open", why: "empty" });
  assert.deepEqual(unlockState({ ...done, answer: { unlocked: [], reason: "SOMETHING_NEW" } }), { kind: "open", why: "empty" });
});

test("an empty batch with a known reason locks nothing and tells the student what to do", () => {
  const done = { demo: false, plan: "known", fetch: "done" } as const;
  assert.deepEqual(unlockState({ ...done, answer: { unlocked: [], reason: "NO_PROFILE_VECTOR" } }), { kind: "action", need: "profile-vector" });
  assert.deepEqual(unlockState({ ...done, answer: { unlocked: [], reason: "NO_SEARCH" } }), { kind: "action", need: "search" });
  assert.match(actionMessage("profile-vector"), /réenregistre ton CV/);
  assert.match(actionMessage("search"), /Choisis tes métiers/);
});

test("a batch locks everything that is not in it", () => {
  const state = unlockState({ demo: false, plan: "known", fetch: "done", answer: { unlocked: [{ jobId: "a", unlockedOn: "2026-10-08", origin: "daily" }], reason: null, newToday: null } });
  assert.equal(state.kind, "locking");
  assert.equal(isUnlocked(job("a"), state, false), true);
  assert.equal(isUnlocked(job("b"), state, false), false);
});

test("offers usable without being in a batch: added by hand, with a kit, or worked on; consulting is not enough", () => {
  const state = locking({ a: "2026-10-08" });
  assert.equal(isUnlocked(job("m", { source_platform: "manual" }), state, false), true);
  assert.equal(isUnlocked(job("k"), state, true), true);
  for (const stage of ["ready", "applied", "interview", "offer", "rejected"]) assert.equal(isUnlocked(job(`s-${stage}`, { stage }), state, false), true, stage);
  // "seen" is what opening an offer sets: it must not unlock it. Nor does "new" or "dismissed".
  for (const stage of ["new", "seen", "dismissed"]) assert.equal(isUnlocked(job(`s-${stage}`, { stage }), state, false), false, stage);
  // Nothing is ever locked outside the "locking" state.
  assert.equal(isUnlocked(job("z"), { kind: "open", why: "failed" }, false), true);
  assert.equal(isUnlocked(job("z"), { kind: "action", need: "search" }, false), true);
  assert.equal(isUnlocked(job("z"), { kind: "loading" }, false), true);
});

test("days are Paris days and are said in French", () => {
  // 23:30 UTC on the 7th is already the 8th in Paris.
  assert.equal(parisDay(new Date("2026-10-07T23:30:00Z")), "2026-10-08");
  assert.equal(parisDay(new Date("2026-10-08T10:00:00Z")), "2026-10-08");
  assert.equal(dayLabel("2026-10-08", "2026-10-08"), "Aujourd’hui");
  assert.equal(dayLabel("2026-10-07", "2026-10-08"), "Hier");
  assert.equal(dayLabel("2026-09-30", "2026-10-01"), "Hier");
  assert.equal(dayLabel("2026-10-06", "2026-10-08"), "Le 6 octobre");
  assert.equal(dayLabel("2025-12-24", "2026-01-02"), "Le 24 décembre 2025");
});

test("the unlocked offers are grouped by day, newest first, then the backfill, then the followed; locked ones are in no group", () => {
  const state = locking({ a: "2026-10-08", b: "2026-10-08", c: "2026-10-06", d: "2026-10-07", old1: "2026-10-05/backfill", old2: "2026-10-05/backfill" });
  const jobs = [job("c"), job("a"), job("locked"), job("d"), job("b"), job("old1"), job("manual", { source_platform: "manual" }), job("old2"), job("done", { stage: "applied" })];
  const groups = groupByUnlockDay(jobs, state, noKit, "2026-10-08");
  assert.deepEqual(groups.map((g) => [g.kind, g.label, g.jobs.map((j) => j.id)]), [
    ["day", "Aujourd’hui", ["a", "b"]],
    ["day", "Hier", ["d"]],
    ["day", "Le 6 octobre", ["c"]],
    ["backfill", "Avant le 5 octobre", ["old1", "old2"]],
    ["followed", "Déjà suivies", ["manual", "done"]],
  ]);
  assert.equal(groups.some((g) => g.jobs.some((j) => j.id === "locked")), false);
});

test("a backfill on the same day as a batch stays apart from it", () => {
  const state = locking({ a: "2026-10-08", b: "2026-10-08/backfill" });
  const groups = groupByUnlockDay([job("a"), job("b")], state, noKit, "2026-10-08");
  assert.deepEqual(groups.map((g) => [g.kind, g.jobs.map((j) => j.id)]), [["day", ["a"]], ["backfill", ["b"]]]);
  // Only the daily entries count for today's batch.
  assert.equal(todayBatchSize(state, "2026-10-08"), 1);
});

test("without locks every offer is listed, none is counted as locked", () => {
  const jobs = [job("x"), job("y")];
  const open: UnlockState = { kind: "open", why: "failed" };
  assert.deepEqual(groupByUnlockDay(jobs, open, noKit, "2026-10-08").map((g) => [g.label, g.jobs.length]), [["Déjà suivies", 2]]);
  assert.equal(lockedCount(jobs, open, noKit), 0);
  assert.equal(todayBatchSize(open, "2026-10-08"), 0);
});

test("the teaser counts the locked offers and never lists them", () => {
  const state = locking({ a: "2026-10-08" });
  const jobs = [job("a"), job("b"), job("c"), job("m", { source_platform: "manual" }), job("k")];
  assert.equal(lockedCount(jobs, state, (j) => j.id === "k"), 2);
});

test("the teaser says what the business judgment wrote, with the right number and agreement", () => {
  assert.equal(teaserText(8).title, "Tes offres du jour sont là");
  assert.equal(teaserText(8).text, "Demain, de nouvelles offres choisies selon tes compétences. Celles que tu as déjà restent à toi.");
  assert.equal(teaserText(3).title, "Aujourd’hui, 3 offres te correspondent");
  assert.equal(teaserText(1).title, "Aujourd’hui, 1 offre te correspond");
  assert.equal(teaserText(3).text, "On préfère t’en montrer peu que t’en montrer de mauvaises.");
  assert.equal(teaserText(0).title, "Aujourd’hui, aucune offre ne correspond assez à ton profil");
  assert.equal(teaserText(0).text, "Élargis tes métiers dans Réglages.");
});

test("a student is told nothing about an open catalogue", () => {
  const all = [0, 1, 3, 8].map((n) => `${teaserText(n).title} ${teaserText(n).text}`).join(" ");
  assert.doesNotMatch(all, /catalogue|explor/i);
});

test("the new contract fields: manual origin, newToday and the new reasons", () => {
  const manual = parseUnlocked({ unlocked: [{ jobId: "m", unlockedOn: "2026-10-09", origin: "manual" }], newToday: 3 });
  assert.equal(manual?.unlocked?.[0].origin, "manual");
  assert.equal(manual?.newToday, 3);
  assert.equal(parseUnlocked({ unlocked: [], newToday: -1 })?.newToday, null);
  const answer = (reason: string, unlocked: { jobId: string; unlockedOn: string; origin: "daily" }[] = []) => unlockState({ demo: false, plan: "known", fetch: "done", answer: { unlocked, reason, newToday: null } });
  // Nothing matches enough: the student sees his empty selection, not the catalogue.
  for (const reason of ["NO_CANDIDATES", "NONE_ABOVE_THRESHOLD"]) {
    const state = answer(reason);
    assert.equal(state.kind, "locking");
    assert.equal(todayBatchSize(state, "2026-10-09"), 0);
  }
  assert.deepEqual(answer("NO_PROFILE"), { kind: "action", need: "profile-vector" });
  // DEGRADED keeps the lock, with or without offers already unlocked.
  const degraded = answer("DEGRADED");
  assert.equal(degraded.kind === "locking" && degraded.degraded, true);
  const withOffers = answer("DEGRADED", [{ jobId: "a", unlockedOn: "2026-10-08", origin: "daily" }]);
  assert.equal(withOffers.kind === "locking" && withOffers.degraded, true);
  assert.equal(DEGRADED_TEXT, "Ta sélection du jour n’a pas pu être préparée. Réessaie dans un moment.");
});

test("every group is ranked by displayed score, highest first, offers without a score last", () => {
  const scored = (id: string, score: number | null) => job(id, { fit: score === null ? null : { score } });
  const state = locking({ a: "2026-10-08", b: "2026-10-08", c: "2026-10-08", d: "2026-10-07", e: "2026-10-07" });
  const groups = groupByUnlockDay([scored("a", null), scored("b", 40), scored("c", 90), scored("d", 10), scored("e", 70)], state, noKit, "2026-10-08");
  assert.deepEqual(groups.map((g) => g.jobs.map((j) => j.id)), [["c", "b", "a"], ["e", "d"]]);
});

test("COMPUTING keeps the lock, even with an empty list, and says the selection is being prepared", () => {
  for (const unlocked of [[], [{ jobId: "a", unlockedOn: "2026-10-08", origin: "daily" as const }]]) {
    const state = unlockState({ demo: false, plan: "known", fetch: "done", answer: { unlocked, reason: "COMPUTING", newToday: null } });
    assert.equal(state.kind, "locking");
    assert.equal(state.kind === "locking" && state.computing, true);
  }
  assert.equal(COMPUTING_TEXT, "On prépare ta sélection du jour…");
});

test("a manual entry is listed with the followed offers, and the server's day size wins", () => {
  const state = unlockState({ demo: false, plan: "known", fetch: "done", answer: { unlocked: [{ jobId: "m", unlockedOn: "2026-10-09", origin: "manual" }, { jobId: "d", unlockedOn: "2026-10-09", origin: "daily" }], reason: null, newToday: 5 } });
  const groups = groupByUnlockDay([job("m"), job("d")], state, noKit, "2026-10-09");
  assert.deepEqual(groups.map((g) => [g.kind, g.jobs.map((j) => j.id)]), [["day", ["d"]], ["followed", ["m"]]]);
  assert.equal(todayBatchSize(state, "2026-10-09"), 5);
});

test("studentSees follows the selection when locking, and shows everything otherwise", () => {
  const locking = unlockState({ demo: false, plan: "known", fetch: "done", answer: { unlocked: [{ jobId: "b", unlockedOn: "2026-10-09", origin: "daily" }], reason: null, newToday: null } });
  assert.equal(studentSees(job("a"), locking, false), false);
  assert.equal(studentSees(job("b"), locking, false), true);
  assert.equal(studentSees(job("a"), { kind: "open", why: "failed" }, false), true);
});

test("no text of the teaser sells anything or promises what is forbidden", () => {
  const all = [0, 1, 3, 8].map((n) => `${teaserText(n).title} ${teaserText(n).text}`).join(" ");
  assert.doesNotMatch(all, /€|\bPlus\b|\bPro\b|payant|prix|débloque|illimité|garanti|exclusi|partenaire|bientôt/i);
});

test("the silhouettes are 4 to 6, whatever the number of locked offers", () => {
  assert.equal(silhouetteCount(0), 4);
  assert.equal(silhouetteCount(5), 5);
  assert.equal(silhouetteCount(300), 6);
});
