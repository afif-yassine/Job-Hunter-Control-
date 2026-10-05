import assert from "node:assert/strict";
import { test } from "node:test";
import { followUpDue, kitsByJob, milestones, stageOf, stagePatch, todayTasks } from "../lib/journey";
import { checkPlan, freeKitsPerMonth, monthStartParis, nextMonthLabel } from "../lib/plan";
import { cleanSalaryText, formatSalaryRange } from "../lib/salary";
import type { DocumentRecord, Job } from "../lib/types";
import { fakeSupabase } from "./fake-supabase";

const job = (over: Partial<Job> = {}): Job =>
  ({ id: "j1", company: "Acme", title: "Dev", contract_type: null, location: null, source_url: null, match_score: null, status: "DISCOVERED", publication_date: null, ...over }) as Job;

test("stage: stored value wins, older rows are placed from their status", () => {
  assert.equal(stageOf(job({ stage: "interview", status: "SUBMITTED" })), "interview");
  assert.equal(stageOf(job({ status: "WAITING_APPROVAL" })), "ready");
  assert.equal(stageOf(job({ status: "SKIPPED" })), "dismissed");
  assert.equal(stageOf(job({ stage: "bogus", status: "DISCOVERED" })), "new");
});

test("milestones: seen, CV, letter, sent, interview", () => {
  const docs = [
    { job_id: "j1", kind: "TAILORED_CV" },
    { job_id: "j1", kind: "COVER_LETTER" },
    { job_id: "j2", kind: "TAILORED_CV" },
  ] as DocumentRecord[];
  const kits = kitsByJob(docs);
  assert.deepEqual(kits.get("j2"), { cv: true, letter: false });
  const m = milestones("applied", kits.get("j1"));
  assert.deepEqual(m.map((x) => x.done), [true, true, true, true, false]);
  assert.deepEqual(milestones("new", undefined).map((x) => x.done), [false, false, false, false, false]);
});

test("follow-up after 7 days without news", () => {
  const now = Date.parse("2026-10-20T10:00:00Z");
  assert.equal(followUpDue(job({ stage: "applied", applied_at: "2026-10-12T10:00:00Z" }), now), true);
  assert.equal(followUpDue(job({ stage: "applied", applied_at: "2026-10-18T10:00:00Z" }), now), false);
  assert.equal(followUpDue(job({ stage: "interview", applied_at: "2026-10-01T10:00:00Z" }), now), false);
});

test("today's tasks: interview first, then kits to send, then follow-ups; gone offers skipped", () => {
  const now = Date.parse("2026-10-20T10:00:00Z");
  const tasks = todayTasks(
    [
      job({ id: "a", stage: "applied", applied_at: "2026-10-01T10:00:00Z" }),
      job({ id: "b", stage: "ready" }),
      job({ id: "c", stage: "interview", interview_at: "2026-10-22T09:00:00Z" }),
      job({ id: "d", stage: "ready", gone_reason: "Retirée" }),
      job({ id: "e", stage: "interview", interview_at: "2026-12-22T09:00:00Z" }),
    ],
    now,
  );
  assert.deepEqual(tasks.map((t) => `${t.job.id}:${t.kind}`), ["c:interview", "b:send", "a:follow-up"]);
});

test("moving by hand keeps the pipeline status in step", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  assert.deepEqual(stagePatch("applied", job(), {}, now), { stage: "applied", seen_at: now.toISOString(), status: "SUBMITTED", applied_at: now.toISOString() });
  assert.equal(stagePatch("dismissed", job()).status, "SKIPPED");
  assert.equal(stagePatch("interview", job(), { interviewAt: "2026-10-22T09:00:00Z" }).interview_at, "2026-10-22T09:00:00Z");
  assert.equal(stagePatch("seen", job({ status: "SKIPPED", match_score: 72 })).status, "ANALYZED");
  assert.equal(stagePatch("seen", job({ status: "SKIPPED", match_score: null })).status, "DISCOVERED");
  assert.equal(stagePatch("seen", job({ status: "ANALYZED" })).status, undefined);
});

test("salary: France Travail text, ranges and periods", () => {
  assert.equal(cleanSalaryText("Mensuel de 1400.00 Euros à 1600.00 Euros sur 12 mois"), "1 400 – 1 600 € / mois");
  assert.equal(cleanSalaryText("Annuel de 32000.00 Euros sur 12 mois"), "32 000 € / an");
  assert.equal(cleanSalaryText("Selon profil"), "Selon profil");
  assert.equal(cleanSalaryText("  "), null);
  assert.equal(cleanSalaryText("N/A"), null);
  assert.equal(formatSalaryRange(35000, 42000, "YEAR"), "35 000 – 42 000 € / an");
  assert.equal(formatSalaryRange(null, 1200, "MONTH"), "1 200 € / mois");
  assert.equal(formatSalaryRange(0, null), null);
  assert.equal(formatSalaryRange(20, 20, "HOUR", "USD"), "20 USD / heure");
});

test("plan: month start in Paris and next month label", () => {
  assert.equal(monthStartParis(new Date("2026-10-15T12:00:00Z")), "2026-09-30T22:00:00.000Z");
  assert.equal(monthStartParis(new Date("2026-12-03T12:00:00Z")), "2026-11-30T23:00:00.000Z");
  assert.equal(nextMonthLabel(new Date("2026-10-15T12:00:00Z")), "1er novembre");
  assert.equal(nextMonthLabel(new Date("2026-12-15T12:00:00Z")), "1er janvier");
  assert.equal(freeKitsPerMonth({}), 2);
  assert.equal(freeKitsPerMonth({ FREE_KITS_PER_MONTH: "5" }), 5);
});

test("free plan: 2 new kits a month, rewriting one is free, admin and pro unlimited", async () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const docs = [
    { id: "d1", user_id: "u1", job_id: "j1", kind: "TAILORED_CV", created_at: "2026-10-02T10:00:00Z" },
    { id: "d2", user_id: "u1", job_id: "j2", kind: "TAILORED_CV", created_at: "2026-10-05T10:00:00Z" },
    { id: "d3", user_id: "u1", job_id: "j0", kind: "TAILORED_CV", created_at: "2026-09-20T10:00:00Z" },
  ];
  const free = fakeSupabase({ documents: docs, user_settings: [{ user_id: "u1", plan: "free" }] }, { rpc: { is_admin: () => false } });
  const refused = await checkPlan(free.db, "u1", "j3", {}, now);
  assert.equal(refused.ok, false);
  if (!refused.ok) {
    assert.equal(refused.status, 402);
    assert.match(refused.body.error, /1er novembre/);
  }
  assert.equal((await checkPlan(free.db, "u1", "j2", {}, now)).ok, true);
  const pro = fakeSupabase({ documents: docs, user_settings: [{ user_id: "u1", plan: "pro" }] }, { rpc: { is_admin: () => false } });
  assert.equal((await checkPlan(pro.db, "u1", "j3", {}, now)).ok, true);
  const admin = fakeSupabase({ documents: docs, user_settings: [] }, { rpc: { is_admin: () => true } });
  assert.equal((await checkPlan(admin.db, "u1", "j3", {}, now)).ok, true);
});

test("one step back", async () => {
  const { undoPatch } = await import("../lib/journey");
  assert.deepEqual(undoPatch(job({ stage: "applied", status: "SUBMITTED" }), true), { stage: "ready", status: "WAITING_APPROVAL", applied_at: null });
  assert.deepEqual(undoPatch(job({ stage: "applied", status: "SUBMITTED", match_score: 70 }), false), { stage: "seen", status: "ANALYZED", applied_at: null });
  assert.deepEqual(undoPatch(job({ stage: "rejected", status: "REJECTED", interview_at: "2026-10-22T09:00:00Z" }), true), { stage: "interview", status: "INTERVIEW" });
  assert.equal(undoPatch(job({ stage: "new" }), false), null);
});
