import assert from "node:assert/strict";
import { test } from "node:test";
import type { AiCall } from "../lib/ai";
import { modelFor } from "../lib/ai";
import { analyzeJob } from "../lib/pipeline/analyze";
import { generateForJob } from "../lib/pipeline/generate";
import { reviewJob } from "../lib/pipeline/review";
import { runServerTick } from "../lib/pipeline/server";
import { consumeQuota, quotaLimit } from "../lib/quota";
import type { ScanSummary } from "../lib/scan/types";
import { fakeSupabase } from "./fake-supabase";

const LONG =
  "Tu développeras des API Python et FastAPI, des pipelines de données PostgreSQL et Kafka, et tu déploieras des modèles de machine learning avec Docker. ".repeat(12);

const ANALYSIS = (total: number, suspicion = "none") =>
  JSON.stringify({
    score_breakdown: { contract: 20, mission: 18 },
    total,
    verified_strengths: ["Python"],
    gaps: [],
    questions: [],
    cv_summary: "Profil backend",
    suspicion: { level: suspicion, reasons: suspicion === "high" ? ["Entreprise introuvable"] : [] },
  });

const DOCS = JSON.stringify({
  cv: { title: "Développeur", summary: "Backend", experience: [], projects: [], skills: ["Python"], education: [], languages: "Français" },
  cover_letter: "Objet : Candidature\n\nMadame, Monsieur,\n\nTexte.\n\nCordialement.",
  unresolved_questions: [],
});

function aiReturning(...texts: string[]) {
  const calls: { prompt: string; task: string }[] = [];
  const ai: AiCall = async (prompt, task) => {
    calls.push({ prompt, task });
    return { text: texts[Math.min(calls.length - 1, texts.length - 1)], model: "test-model" };
  };
  return { ai, calls };
}

const allow = { consume_quota: () => true };
const deny = { consume_quota: () => false };

function world(jobs: Record<string, unknown>[], rpc = allow, extra: Record<string, Record<string, unknown>[]> = {}) {
  return fakeSupabase(
    {
      jobs,
      candidate_profiles: [
        { user_id: "u1", full_name: "Yassine AFIF", profile: { skills: ["Python"] }, truth_ledger: [] },
        { user_id: "u2", full_name: "Sara Ben", profile: { skills: ["Java"] }, truth_ledger: [] },
      ],
      documents: [],
      applications: [],
      audit_events: [],
      agent_runs: [],
      notifications: [],
      job_sources: [],
      user_settings: [],
      ...extra,
    },
    { rpc },
  );
}

const job = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: "u1",
  company: "Doctolib",
  title: "Alternance développeur Python",
  contract_type: "Alternance",
  location: "Paris",
  description: LONG,
  status: "DISCOVERED",
  review_flag: null,
  official_url: "https://example.com/offre",
  created_at: `2026-09-2${id.length}T10:00:00Z`,
  ...extra,
});

test("AI model is chosen by configuration, per task", () => {
  assert.equal(modelFor("analysis", {}), "gemini-3.6-flash");
  assert.equal(modelFor("writing", { AI_MODEL: "gemini-x" }), "gemini-x");
  assert.equal(modelFor("analysis", { AI_MODEL: "gemini-x", AI_MODEL_ANALYSIS: "small" }), "small");
});

test("analysis: scores the full ad, records the model and counts one analysis", async () => {
  const { db, tables } = world([job("j1")]);
  let quotaCalls = 0;
  const w = fakeSupabase(tables, { rpc: { consume_quota: () => (quotaCalls++, true) } });
  const { ai, calls } = aiReturning(ANALYSIS(86));
  const r = await analyzeJob({ supabase: w.db, userId: "u1", jobId: "j1", ai });
  assert.equal(r.status, 200);
  assert.equal(calls[0].task, "analysis");
  assert.equal(quotaCalls, 1);
  const saved = tables.jobs[0];
  assert.equal(saved.status, "ANALYZED");
  assert.equal(saved.match_score, 86);
  assert.equal(saved.score_model, "test-model");
  void db;
});

test("analysis: a short extract is completed from the ad page first", async () => {
  const { db, tables } = world([job("j1", { description: "Stage court." })]);
  const { ai, calls } = aiReturning(ANALYSIS(70));
  await analyzeJob({ supabase: db, userId: "u1", jobId: "j1", ai, fetchPage: async () => LONG });
  assert.equal(tables.jobs[0].description, LONG);
  assert.ok(calls[0].prompt.includes("FastAPI"));
});

test("analysis: obvious scams never reach the AI; AI-detected ones are flagged", async () => {
  const scam = world([job("j1", { description: `${LONG} Mission : réceptionner des colis et les réexpédier.` })]);
  const first = aiReturning(ANALYSIS(90));
  const r1 = await analyzeJob({ supabase: scam.db, userId: "u1", jobId: "j1", ai: first.ai });
  assert.equal(r1.body.suspected, true);
  assert.equal(first.calls.length, 0);
  assert.equal(scam.tables.jobs[0].review_flag, "SUSPECTED");

  const odd = world([job("j2")]);
  const second = aiReturning(ANALYSIS(88, "high"));
  const r2 = await analyzeJob({ supabase: odd.db, userId: "u1", jobId: "j2", ai: second.ai });
  assert.equal(r2.body.suspected, true);
  assert.equal(odd.tables.jobs[0].review_flag, "SUSPECTED");
  assert.equal(odd.tables.jobs[0].match_score, 88);
});

test("analysis: daily limit reached → nothing spent; offers to review wait", async () => {
  const full = world([job("j1")], deny);
  const { ai, calls } = aiReturning(ANALYSIS(90));
  const r = await analyzeJob({ supabase: full.db, userId: "u1", jobId: "j1", ai });
  assert.equal(r.status, 429);
  assert.equal(r.body.code, "QUOTA_REACHED");
  assert.equal(calls.length, 0);

  const flagged = world([job("j1", { review_flag: "PROBABLE_DUPLICATE" })]);
  const r2 = await analyzeJob({ supabase: flagged.db, userId: "u1", jobId: "j1", ai });
  assert.equal(r2.status, 409);
});

test("generation: CV + letter named after the account, model recorded, application waiting for approval", async () => {
  const { db, tables } = world([job("j1", { status: "ANALYZED", match_score: 90, source_platform: "ats:lever" })]);
  const { ai, calls } = aiReturning(DOCS);
  const r = await generateForJob({ supabase: db, userId: "u1", jobId: "j1", ai });
  assert.equal(r.status, 200);
  assert.equal(calls[0].task, "writing");
  assert.equal(tables.documents.length, 2);
  assert.match(String(tables.documents[0].filename), /^CV_Yassine_AFIF_Doctolib/);
  assert.equal(tables.documents[0].model, "test-model");
  assert.equal(tables.applications[0].status, "WAITING_APPROVAL");
  assert.equal(tables.jobs[0].status, "WAITING_APPROVAL");
});

test("review: already applied elsewhere is remembered; a duplicate's links move to the original", async () => {
  const { db, tables } = world(
    [job("orig", { status: "ANALYZED" }), job("copy", { review_flag: "PROBABLE_DUPLICATE", duplicate_of: "orig" })],
    allow,
    { job_sources: [{ id: "s1", user_id: "u1", job_id: "copy", url: "https://indeed.com/1" }] },
  );
  const merged = await reviewJob({ supabase: db, userId: "u1", jobId: "copy", action: "merge" });
  assert.equal(merged.status, 200);
  assert.equal(tables.job_sources[0].job_id, "orig");
  assert.equal(tables.jobs.find((j) => j.id === "copy")!.status, "SKIPPED");

  const applied = await reviewJob({ supabase: db, userId: "u1", jobId: "orig", action: "applied_elsewhere", platform: "LinkedIn" });
  assert.equal(applied.status, 200);
  assert.equal(tables.applications[0].status, "SUBMITTED");
  assert.equal(tables.applications[0].platform, "LinkedIn");
  assert.equal(tables.jobs.find((j) => j.id === "orig")!.status, "SUBMITTED");
});

test("quota: defaults, overrides, and a missing counter never blocks", async () => {
  assert.equal(quotaLimit("analysis", {}), 20);
  assert.equal(quotaLimit("generation", { QUOTA_GENERATIONS_PER_DAY: "4" }), 4);
  assert.equal(quotaLimit("scan", { QUOTA_SCANS_PER_DAY: "0" }), 0);
  const { db } = fakeSupabase({});
  assert.deepEqual(await consumeQuota(db, "u1", "analysis", {}), { ok: true, limit: 20 });
});

test("server run: searches due accounts, scores, writes documents, logs and notifies — without a browser", async () => {
  const { db, tables } = world(
    [job("a1"), job("a22", { user_id: "u2", company: "Alan" })],
    allow,
    {
      user_settings: [
        { user_id: "u1", auto_scan: true, last_scan_at: null },
        { user_id: "u2", auto_scan: true, last_scan_at: new Date().toISOString() },
      ],
    },
  );
  const scanned: string[] = [];
  const scan = async (_: unknown, userId: string): Promise<ScanSummary> => {
    scanned.push(userId);
    return { reports: [], found: 3, relevant: 2, inserted: 2, duplicates: 1, alreadyApplied: 0, toReview: 0, suspected: 0, needsDescription: 0, configured: true };
  };
  // First call scores 91, second 60, then documents.
  const { ai } = aiReturning(ANALYSIS(91), ANALYSIS(60), DOCS);
  const report = await runServerTick({ supabase: db, env: {}, ai, scan, fetchPage: async () => null });
  assert.deepEqual(scanned, ["u1"]);
  assert.equal(report.stoppedBy, "done");
  assert.equal(report.users.u1.analyzed + report.users.u2.analyzed, 2);
  assert.equal(tables.documents.length > 0, true);
  assert.ok(tables.agent_runs.every((r) => (r.counters as { trigger: string }).trigger === "server"));
  assert.ok(tables.notifications.some((n) => n.user_id === "u1"));
  assert.ok(tables.user_settings.find((s) => s.user_id === "u1")!.last_scan_at);
});

test("server run: stops before the time budget, and a full quota only pauses that account", async () => {
  const { db, tables } = world([job("a1"), job("a22"), job("a333")], deny, {
    user_settings: [],
  });
  const { ai, calls } = aiReturning(ANALYSIS(95));
  const report = await runServerTick({ supabase: db, env: {}, ai, fetchPage: async () => null });
  assert.equal(calls.length, 0);
  assert.deepEqual(report.users.u1.quotaReached, ["analysis"]);
  assert.equal(tables.jobs.filter((j) => j.status === "DISCOVERED").length, 3);

  let t = 0;
  const slow = world([job("b1"), job("b22")]);
  const timed = await runServerTick({ supabase: slow.db, env: {}, ai, now: () => (t += 20_000), fetchPage: async () => null });
  assert.equal(timed.stoppedBy, "time");
});
