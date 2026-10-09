import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { onboardingStatus, vectorizeProfile } from "../lib/onboarding";
import { fakeSupabase } from "./fake-supabase";

const search = { contracts: ["alternance"], categories: ["devops"], keywords: [], city: "", departments: [] };
const gateway = { EMBEDDING_PROVIDER: "gateway" };
const world = (over: { profile?: Record<string, unknown> | null; scan?: unknown } = {}) =>
  fakeSupabase({
    candidate_profiles: over.profile === null ? [] : [{ user_id: "u1", profile: { skills: ["sql"] }, semantic_hash: null, ...over.profile }],
    user_settings: [{ user_id: "u1", scan_config: over.scan ?? search }],
  }).db;

test("ONBOARDING — one answer: profile confirmed, search chosen, vector state, and ready only when both are done", async () => {
  assert.deepEqual(await onboardingStatus(world({ profile: null, scan: { ...search, categories: [] } }), "u1", gateway), { profileConfirmed: false, searchChosen: false, vector: "pending", ready: false });
  assert.deepEqual(await onboardingStatus(world({ profile: null }), "u1", gateway), { profileConfirmed: false, searchChosen: true, vector: "pending", ready: false });
  assert.deepEqual(await onboardingStatus(world({ scan: { ...search, categories: [] } }), "u1", gateway), { profileConfirmed: true, searchChosen: false, vector: "pending", ready: false });
  // A pending vector does not stop the student from entering.
  assert.deepEqual(await onboardingStatus(world(), "u1", gateway), { profileConfirmed: true, searchChosen: true, vector: "pending", ready: true });
  assert.equal((await onboardingStatus(world({ profile: { semantic_hash: "h" } }), "u1", gateway)).vector, "ready");
  // Legacy vectors (no EMBEDDING_PROVIDER=gateway): not applicable, never a reason to wait.
  assert.equal((await onboardingStatus(world(), "u1", {})).vector, "unavailable");
});

test("ONBOARDING — an unreadable profile table is an error, not a false 'not confirmed'", async () => {
  const { db } = fakeSupabase({ user_settings: [] }, { missingTables: ["candidate_profiles"] });
  await assert.rejects(onboardingStatus(db, "u1", gateway));
});

test("PROFILE SAVE — a vector that could not be computed is signalled and logged, and the save stands", async () => {
  const logs: string[] = [];
  // The reservation function does not exist in this fake database: the vector fails.
  const result = await vectorizeProfile(world(), "u1", gateway, (m) => logs.push(m));
  assert.deepEqual(result, { pending: true });
  assert.equal(logs.length, 1);
  assert.ok(!/secret|key/i.test(logs[0]));
  // Not applicable setup: nothing pending.
  assert.deepEqual(await vectorizeProfile(world(), "u1", {}, () => undefined), { pending: false });
});

test("ROUTES — profile answers confirmed/embeddingPending, onboarding status is read only", () => {
  const profile = readFileSync("app/api/profile/route.ts", "utf8");
  assert.match(profile, /confirmed: profile !== null/);
  assert.match(profile, /embeddingPending: pending/);
  assert.doesNotMatch(profile, /catch \{ \/\* The confirmed CV stays saved/);
  const status = readFileSync("app/api/onboarding/status/route.ts", "utf8");
  assert.match(status, /export async function GET/);
  assert.doesNotMatch(status, /export async function (POST|PUT|PATCH|DELETE)/);
});
