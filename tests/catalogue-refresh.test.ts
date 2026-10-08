import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { PROFILE_REQUIRED } from "../lib/profile-store";
import { refreshFromCatalogue } from "../lib/scan/refresh";
import { fakeSupabase } from "./fake-supabase";

const realFetch = globalThis.fetch;
const realEnv = { provider: process.env.EMBEDDING_PROVIDER, key: process.env.AI_GATEWAY_API_KEY };
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realEnv.provider === undefined) delete process.env.EMBEDDING_PROVIDER; else process.env.EMBEDDING_PROVIDER = realEnv.provider;
  if (realEnv.key === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = realEnv.key;
});

const now = new Date().toISOString();
const offer = (id: string, location: string) => ({
  id, fingerprint: `fp${id}`, title: "Alternance Ingénieur DevOps", company: `C${id}`, location, contract_type: "Contrat apprentissage",
  source: "francetravail", url: `https://x.test/${id}`, apply_url: null, published_at: now.slice(0, 10), rome_code: "M1827", board: null,
  categories: ["devops"], contract_kind: "alternance", status: "open", last_seen_at: now,
  description: "Mise en place de pipelines CI/CD et d’infrastructure cloud en alternance.",
});
const world = (extra: Record<string, Record<string, unknown>[]>) =>
  fakeSupabase({ offers: [offer("1", "Lyon 69003"), offer("2", "Paris")], jobs: [], job_sources: [], applications: [], agent_runs: [], notifications: [], ...extra });
const chosen = { user_id: "u1", scan_config: { contracts: ["alternance"], categories: ["devops"], keywords: [], city: "", departments: [] } };

test("opening the app fills the list from the catalogue, without any job site or AI call, and repeating it adds nothing", async () => {
  // A gateway key is configured and the profile has no vector yet: a vector refresh would be a paid call.
  process.env.EMBEDDING_PROVIDER = "gateway";
  process.env.AI_GATEWAY_API_KEY = "synthetic-test-key";
  let requests = 0;
  globalThis.fetch = (async () => (requests++, new Response("{}", { status: 500 }))) as typeof fetch;
  const { db, tables } = world({ candidate_profiles: [{ user_id: "u1", profile: { skills: ["Docker"] } }], user_settings: [chosen] });
  const first = await refreshFromCatalogue(db, "u1");
  assert.deepEqual(first, { status: 200, body: { inserted: 2, searched: true } });
  assert.deepEqual(tables.jobs.map((j) => j.offer_id).sort(), ["1", "2"]);
  assert.equal(requests, 0);
  const again = await refreshFromCatalogue(db, "u1");
  assert.deepEqual(again.body, { inserted: 0, searched: true });
  assert.equal(tables.jobs.length, 2);
  // The saved settings were not reset by the refresh.
  assert.deepEqual(tables.user_settings[0].scan_config, chosen.scan_config);
});

test("without a confirmed profile the app is sent to the CV import; without a chosen search nothing is added", async () => {
  const noProfile = world({ candidate_profiles: [], user_settings: [chosen] });
  const refused = await refreshFromCatalogue(noProfile.db, "u1");
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, PROFILE_REQUIRED);
  assert.deepEqual(noProfile.tables.jobs, []);

  for (const settings of [[], [{ user_id: "u1", scan_config: null }], [{ user_id: "u1", scan_config: { keywords: [], categories: [] } }]]) {
    const { db, tables } = world({ candidate_profiles: [{ user_id: "u1", profile: { skills: ["Docker"] } }], user_settings: settings });
    const result = await refreshFromCatalogue(db, "u1");
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { inserted: 0, searched: false, code: "NO_SEARCH", message: "Choisis tes métiers pour lancer la recherche." });
    assert.deepEqual(tables.jobs, []);
  }
});

test("an unreadable profile table is reported as unavailable, never as an empty list", async () => {
  const { db } = fakeSupabase({}, { missingTables: ["candidate_profiles"] });
  const result = await refreshFromCatalogue(db, "u1");
  assert.equal(result.status, 503);
  assert.equal(result.body.code, undefined);
});

test("the refresh route is rate limited by the scan bucket and goes through the shared function", () => {
  const route = readFileSync("app/api/catalogue/refresh/route.ts", "utf8");
  assert.match(route, /authenticatedClient\("scan"\)/);
  assert.match(route, /refreshFromCatalogue\(auth\.supabase, auth\.userId\)/);
});
