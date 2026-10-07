import assert from "node:assert/strict";
import { test } from "node:test";
import { compareJob } from "../lib/pipeline/compare";
import { generateForJob } from "../lib/pipeline/generate";
import { PROFILE_REQUIRED, PROFILE_REQUIRED_MESSAGE } from "../lib/profile-store";
import { fakeSupabase } from "./fake-supabase";

const job = { id: "j1", user_id: "u1", title: "Stage dev", company: "Acme", description: "Développer des outils.", status: "ANALYZED", offers: { summary: { skills: ["sql"] } } };
const noAi = async () => { throw new Error("no AI call expected"); };

test("without a confirmed profile the app gets a stable code to send the student to the CV import", async () => {
  const { db, tables } = fakeSupabase({ jobs: [job], candidate_profiles: [] });
  const compared = await compareJob({ supabase: db, userId: "u1", jobId: "j1" });
  assert.equal(compared.status, 409);
  assert.equal(compared.body.code, PROFILE_REQUIRED);
  assert.equal(compared.body.error, PROFILE_REQUIRED_MESSAGE);
  assert.match(PROFILE_REQUIRED_MESSAGE, /Importe ton CV dans Réglages/);

  const generated = await generateForJob({ supabase: db, userId: "u1", jobId: "j1", ai: noAi });
  assert.equal(generated.status, 409);
  assert.equal(generated.body.code, PROFILE_REQUIRED);
  assert.equal(generated.body.error, PROFILE_REQUIRED_MESSAGE);
  assert.equal(tables.documents, undefined);
  assert.equal(tables.ai_usage, undefined);
});

test("an offer that does not exist (or belongs to someone else) stays a plain 404, not a profile problem", async () => {
  const { db } = fakeSupabase({ jobs: [job], candidate_profiles: [{ user_id: "u1", profile: { skills: ["sql"] } }] });
  const other = await generateForJob({ supabase: db, userId: "u2", jobId: "j1", ai: noAi });
  assert.equal(other.status, 404);
  assert.equal(other.body.code, undefined);
  assert.equal((await generateForJob({ supabase: db, userId: "u1", jobId: "missing", ai: noAi })).status, 404);
});
