import assert from "node:assert/strict";
import { test } from "node:test";
import { compareJob } from "../lib/pipeline/compare";
import { fakeSupabase } from "./fake-supabase";
import { compareFits, displayScore, fitScore } from "../lib/fit";

const base = { id: "j", user_id: "owner", title: "Stage dev", description: "Développer les outils internes", status: "DISCOVERED", offers: { summary: { skills: ["ReactJS", "SQL"] } } };
test("standard comparison uses existing requirements and profile without AI or quota calls", async () => {
  const { db, tables } = fakeSupabase({ jobs: [base], candidate_profiles: [{ user_id: "owner", profile: { skills: ["React.js"] } }] });
  const result = await compareJob({ supabase: db, userId: "owner", jobId: "j" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.verified_strengths, ["react"]);
  assert.deepEqual(result.body.gaps, ["sql"]);
  assert.equal(result.body.total, 50);
  assert.equal(tables.jobs[0].status, "ANALYZED");
  assert.equal(tables.jobs[0].score_model, "skills-v1");
  assert.equal(tables.ai_usage, undefined);
  assert.equal(tables.usage_events, undefined);
});

test("unknown requirements get no invented numeric score and cannot auto-trigger writing", async () => {
  const { db } = fakeSupabase({ jobs: [{ ...base, offers: null }], candidate_profiles: [{ user_id: "owner", profile: { skills: ["Python"] } }] });
  const result = await compareJob({ supabase: db, userId: "owner", jobId: "j" });
  assert.equal(result.status, 200); assert.equal(result.body.total, null);
});

test("comparison isolates accounts and preserves submitted applications", async () => {
  const { db, tables } = fakeSupabase({ jobs: [{ ...base, status: "SUBMITTED" }], candidate_profiles: [{ user_id: "owner", profile: { skills: ["React"] } }] });
  assert.equal((await compareJob({ supabase: db, userId: "other", jobId: "j" })).status, 404);
  assert.equal((await compareJob({ supabase: db, userId: "owner", jobId: "j" })).status, 200);
  assert.equal(tables.jobs[0].status, "SUBMITTED");
});

test("free stored comparisons use current fit when the CV changes", () => {
  assert.deepEqual(displayScore({ match_score: 99, score_model: "skills-v1", fit: { score: 50, matched: ["react"], missing: ["sql"], similarity: null } }), { score: 50, detailed: false });
});

test("uncalibrated semantic similarity is not a percentage and skill coverage is exact", () => {
  const model = "perplexity/pplx-embed-v1-0.6b@retrieval-v1";
  assert.equal(fitScore(0.8, ["a", "b", "c", "d", "e", "f"], ["g", "h", "i", "j", "k", "l"], model)?.score, 50);
  assert.equal(fitScore(0.8, [], ["python"], model)?.score, 0);
  assert.equal(fitScore(0.8, [], [], model), null);
  const jobs = [{ match_score: 100, similarity: 0.3 }, { match_score: null, similarity: 0.7 }];
  assert.deepEqual(jobs.sort(compareFits).map(j => j.similarity), [0.7, 0.3]);
});
