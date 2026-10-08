import assert from "node:assert/strict";
import { test } from "node:test";
import { actionMessage, dayLabel, groupByUnlockDay, isUnlocked, lockedCount, parisDay, parseUnlocked, unlockState, type UnlockState } from "../components/unlock";
import type { Job } from "../lib/types";

const job = (id: string, extra: Record<string, unknown> = {}) => ({ id, stage: "new", status: "ANALYZED", source_platform: "francetravail", ...extra }) as unknown as Job;
const locking = (entries: Record<string, string>): UnlockState => ({ kind: "locking", unlocked: new Map(Object.entries(entries)) });
const noKit = () => false;

test("an answer is read as the contract says, and anything else is not an answer", () => {
  assert.deepEqual(parseUnlocked({ unlocked: [{ jobId: "a", unlockedOn: "2026-10-08" }] }), { unlocked: [{ jobId: "a", unlockedOn: "2026-10-08" }], reason: null });
  assert.deepEqual(parseUnlocked({ unlocked: [], reason: "NO_SEARCH" }), { unlocked: [], reason: "NO_SEARCH" });
  assert.deepEqual(parseUnlocked({ unlocked: null, reason: "NOT_READY" }), { unlocked: null, reason: "NOT_READY" });
  // A timestamp keeps only its day.
  assert.equal(parseUnlocked({ unlocked: [{ jobId: "a", unlockedOn: "2026-10-08T07:00:00Z" }] })?.unlocked?.[0].unlockedOn, "2026-10-08");
  for (const bad of [null, undefined, "x", 3, {}, { unlocked: "all" }, { unlocked: [{ jobId: "a" }] }, { unlocked: [{ jobId: "", unlockedOn: "2026-10-08" }] }, { unlocked: [{ jobId: "a", unlockedOn: "hier" }] }, { unlocked: [null] }])
    assert.equal(parseUnlocked(bad), null, JSON.stringify(bad));
});

test("a doubt never locks: demo, paid or unknown plan, failure, absent route, unreadable answer", () => {
  const answer = { unlocked: [{ jobId: "a", unlockedOn: "2026-10-08" }], reason: null };
  assert.deepEqual(unlockState({ demo: true, plan: "free", fetch: "done", answer }), { kind: "open", why: "demo" });
  assert.deepEqual(unlockState({ demo: false, plan: "paid", fetch: "done", answer }), { kind: "open", why: "paid" });
  assert.deepEqual(unlockState({ demo: false, plan: "paid", fetch: "loading", answer: null }), { kind: "open", why: "paid" });
  assert.deepEqual(unlockState({ demo: false, plan: "unknown", fetch: "done", answer }), { kind: "open", why: "unknown-plan" });
  assert.deepEqual(unlockState({ demo: false, plan: "free", fetch: "failed", answer: null }), { kind: "open", why: "failed" });
  assert.deepEqual(unlockState({ demo: false, plan: "free", fetch: "done", answer: null }), { kind: "open", why: "failed" });
});

test("while the plan or the list is still being read, nothing is decided yet", () => {
  assert.deepEqual(unlockState({ demo: false, plan: "loading", fetch: "done", answer: null }), { kind: "loading" });
  assert.deepEqual(unlockState({ demo: false, plan: "free", fetch: "loading", answer: null }), { kind: "loading" });
});

test("the server's own reasons are followed: all, not ready, empty without reason", () => {
  assert.deepEqual(unlockState({ demo: false, plan: "free", fetch: "done", answer: { unlocked: null, reason: "all" } }), { kind: "open", why: "all" });
  assert.deepEqual(unlockState({ demo: false, plan: "free", fetch: "done", answer: { unlocked: null, reason: "NOT_READY" } }), { kind: "open", why: "not-ready" });
  assert.deepEqual(unlockState({ demo: false, plan: "free", fetch: "done", answer: { unlocked: [], reason: null } }), { kind: "open", why: "empty" });
  assert.deepEqual(unlockState({ demo: false, plan: "free", fetch: "done", answer: { unlocked: [], reason: "SOMETHING_NEW" } }), { kind: "open", why: "empty" });
});

test("an empty batch with a known reason locks nothing and tells the student what to do", () => {
  const fetchDone = { demo: false, plan: "free", fetch: "done" } as const;
  assert.deepEqual(unlockState({ ...fetchDone, answer: { unlocked: [], reason: "NO_PROFILE_VECTOR" } }), { kind: "action", need: "profile-vector" });
  assert.deepEqual(unlockState({ ...fetchDone, answer: { unlocked: [], reason: "NO_SEARCH" } }), { kind: "action", need: "search" });
  assert.match(actionMessage("profile-vector"), /réenregistre ton CV/);
  assert.match(actionMessage("search"), /Choisis tes métiers/);
});

test("a batch locks everything that is not in it", () => {
  const state = unlockState({ demo: false, plan: "free", fetch: "done", answer: { unlocked: [{ jobId: "a", unlockedOn: "2026-10-08" }], reason: null } });
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

test("the unlocked offers are grouped by day, newest first, and the locked ones are in no group", () => {
  const state = locking({ a: "2026-10-08", b: "2026-10-08", c: "2026-10-06", d: "2026-10-07" });
  const jobs = [job("c"), job("a"), job("locked"), job("d"), job("b"), job("manual", { source_platform: "manual" }), job("done", { stage: "applied" })];
  const groups = groupByUnlockDay(jobs, state, noKit, "2026-10-08");
  assert.deepEqual(groups.map((g) => [g.label, g.jobs.map((j) => j.id)]), [
    ["Aujourd’hui", ["a", "b"]],
    ["Hier", ["d"]],
    ["Le 6 octobre", ["c"]],
    ["Déjà suivies", ["manual", "done"]],
  ]);
  assert.equal(groups.some((g) => g.jobs.some((j) => j.id === "locked")), false);
});

test("without locks every offer is listed, none is counted as locked", () => {
  const jobs = [job("x"), job("y")];
  const open: UnlockState = { kind: "open", why: "failed" };
  assert.deepEqual(groupByUnlockDay(jobs, open, noKit, "2026-10-08").map((g) => [g.label, g.jobs.length]), [["Déjà suivies", 2]]);
  assert.equal(lockedCount(jobs, open, noKit), 0);
});

test("the teaser counts the locked offers and never lists them", () => {
  const state = locking({ a: "2026-10-08" });
  const jobs = [job("a"), job("b"), job("c"), job("m", { source_platform: "manual" }), job("k")];
  assert.equal(lockedCount(jobs, state, (j) => j.id === "k"), 2);
});
