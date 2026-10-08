import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { runServerTick } from "../lib/pipeline/server";
import { runScan, scanMessage, seedFromCatalogue } from "../lib/scan";
import { DEFAULT_PREFS, hasChosenSearch, NO_SEARCH_MESSAGE, normalizePrefs } from "../lib/scan/config";
import type { ScanSummary } from "../lib/scan/types";
import { fakeSupabase } from "./fake-supabase";
import { SEARCH_DEV_PARIS } from "./prefs";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("a new account assumes no jobs, keywords, city or area: it chooses its own", () => {
  assert.deepEqual(DEFAULT_PREFS.keywords, []);
  assert.equal(DEFAULT_PREFS.city, "");
  assert.deepEqual(DEFAULT_PREFS.departments, []);
  assert.deepEqual(DEFAULT_PREFS.contracts, ["alternance", "stage"]);
  for (const stored of [null, undefined, {}, { scan_config: 1 }, { keywords: [], categories: [], targets: [] }])
    assert.equal(hasChosenSearch(normalizePrefs(stored)), false);
  assert.equal(hasChosenSearch(normalizePrefs({ categories: ["devops"] })), true);
  assert.equal(hasChosenSearch(normalizePrefs({ keywords: ["data"] })), true);
  assert.equal(hasChosenSearch(normalizePrefs({ targets: ["lever:acme"] })), true);
  // Ticking a job still means no typed keyword is needed.
  assert.deepEqual(normalizePrefs({ categories: ["devops"] }).keywords, []);
});

test("nothing is searched, fetched or written for an account that chose no job", async () => {
  let requests = 0;
  globalThis.fetch = (async () => (requests++, new Response("{}"))) as typeof fetch;
  const rpcCalls: string[] = [];
  const { db, tables } = fakeSupabase(
    { jobs: [], job_sources: [], user_settings: [], offers: [{ id: "o1", status: "open", title: "Stage dev", location: "Paris", last_seen_at: new Date().toISOString() }] },
    { rpc: { consume_source_budget: () => (rpcCalls.push("budget"), true), record_source_run: () => (rpcCalls.push("run"), null) } },
  );
  const summary = await runScan({ supabase: db, userId: "new", env: { JSEARCH_API_KEY: "k" }, cacheDb: null });
  assert.equal(summary.noSearch, true);
  assert.equal(summary.configured, true);
  assert.equal(summary.found + summary.inserted, 0);
  assert.equal(scanMessage(summary), NO_SEARCH_MESSAGE);
  assert.equal(NO_SEARCH_MESSAGE, "Choisis tes métiers pour lancer la recherche.");
  assert.equal(requests, 0);
  assert.deepEqual(rpcCalls, []);
  assert.deepEqual(tables.jobs, []);
  // Filling the list from the catalogue is refused the same way.
  assert.equal(await seedFromCatalogue(db, "new"), 0);
  assert.deepEqual(tables.jobs, []);
  assert.equal(tables.user_settings.length, 0);
});

test("once jobs are chosen the same account is searched again", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as typeof fetch;
  const { db } = fakeSupabase(
    { jobs: [], job_sources: [], user_settings: [{ user_id: "u1", scan_config: SEARCH_DEV_PARIS }], applications: [], agent_runs: [], notifications: [] },
    { rpc: { consume_source_budget: () => true, record_source_run: () => null } },
  );
  const summary = await runScan({ supabase: db, userId: "u1", env: { JSEARCH_API_KEY: "k" }, cacheDb: null });
  assert.equal(summary.noSearch, undefined);
  assert.ok(summary.reports.some((r) => r.source.startsWith("JSearch")));
});

test("the server run skips accounts without a chosen search and does not spend their turn", async () => {
  const none = (user_id: string, scan_config: unknown) => ({ user_id, auto_scan: true, last_scan_at: null, scan_config });
  const { db, tables } = fakeSupabase({
    user_settings: [
      none("never-saved", null),
      none("empty", {}),
      none("empty-lists", { keywords: [], categories: [], targets: [] }),
      none("u1", SEARCH_DEV_PARIS),
      none("u2", { categories: ["devops"] }),
      none("u3", { targets: ["lever:acme"] }),
    ],
    jobs: [],
  });
  const scanned: string[] = [];
  const scan = async (_: unknown, userId: string): Promise<ScanSummary> => {
    scanned.push(userId);
    return { reports: [], found: 0, relevant: 0, inserted: 0, duplicates: 0, alreadyApplied: 0, toReview: 0, suspected: 0, needsDescription: 0, configured: true };
  };
  const ai = async () => { throw new Error("no AI call expected"); };
  await runServerTick({ supabase: db, env: {}, ai, scan, fetchPage: async () => null });
  // Two accounts per call, and only accounts that chose something.
  assert.deepEqual(scanned, ["u1", "u2"]);
  const stamp = (id: string) => tables.user_settings.find((s) => s.user_id === id)!.last_scan_at;
  assert.equal(stamp("never-saved"), null);
  assert.equal(stamp("empty"), null);
  assert.equal(stamp("empty-lists"), null);
  assert.ok(stamp("u1") && stamp("u2"));
  assert.equal(stamp("u3"), null);
});

test("an empty area means the whole of France: chosen jobs without a city still bring the catalogue's offers", async () => {
  const { inArea } = await import("../lib/scan/area");
  assert.equal(inArea("Lyon 69003", { city: "", departments: [] }), true);
  assert.equal(inArea(null, { city: " ", departments: [] }), true);
  // A chosen city or department still filters, as before.
  assert.equal(inArea("Lyon 69003", { city: "Paris", departments: ["75"] }), false);
  assert.equal(inArea("Nanterre (92)", { city: "", departments: ["92"] }), true);

  const now = new Date().toISOString();
  const offer = (id: string, location: string) => ({
    id, fingerprint: `fp${id}`, title: "Alternance Ingénieur DevOps", company: `C${id}`, location, contract_type: "Contrat apprentissage",
    source: "francetravail", url: `https://x.test/${id}`, apply_url: null, published_at: now.slice(0, 10), rome_code: "M1827", board: null,
    categories: ["devops"], contract_kind: "alternance", status: "open", last_seen_at: now,
    description: "Mise en place de pipelines CI/CD et d’infrastructure cloud en alternance.",
  });
  let requests = 0;
  globalThis.fetch = (async () => (requests++, new Response(JSON.stringify({ data: [] }), { status: 200 }))) as typeof fetch;
  const account = () => fakeSupabase(
    {
      offers: [offer("1", "Lyon 69003"), offer("2", "Lille"), offer("3", "Paris")],
      jobs: [], job_sources: [], applications: [], agent_runs: [], notifications: [],
      user_settings: [{ user_id: "u1", scan_config: { contracts: ["alternance"], categories: ["devops"], keywords: [], city: "", departments: [] } }],
    },
    { rpc: { record_source_run: () => null, consume_source_budget: () => true } },
  );
  const seeded = account();
  assert.equal(await seedFromCatalogue(seeded.db, "u1"), 3);
  assert.deepEqual(seeded.tables.jobs.map((j) => j.offer_id).sort(), ["1", "2", "3"]);

  // The same account through a full scan: the catalogue is read, no job site is called or charged.
  const scanned = account();
  const summary = await runScan({ supabase: scanned.db, userId: "u1", env: { JSEARCH_API_KEY: "k", ADZUNA_APP_ID: "a", ADZUNA_APP_KEY: "b" }, cacheDb: null });
  assert.equal(summary.inserted, 3);
  assert.equal(requests, 0);
  assert.ok(summary.reports.filter((r) => /JSearch|Adzuna/.test(r.source)).every((r) => r.status === "skipped" && /catalogue commun/.test(r.message ?? "")));

  // With an area chosen, the same account is filtered and searched as before.
  const paris = account();
  paris.tables.user_settings[0].scan_config = { contracts: ["alternance"], categories: ["devops"], keywords: [], city: "Paris", departments: ["75"] };
  assert.equal(await seedFromCatalogue(paris.db, "u1"), 1);
});

test("the server run never tries to write documents for an offer already marked as gone", async () => {
  const gone = { id: "j1", user_id: "u1", status: "ANALYZED", match_score: 95, review_flag: null, gone_reason: "closed" };
  const { db } = fakeSupabase({ user_settings: [], jobs: [gone] });
  const ai = async () => { throw new Error("no AI call expected"); };
  const report = await runServerTick({ supabase: db, env: {}, ai, fetchPage: async () => null });
  assert.equal(report.users.u1, undefined);
  assert.equal(report.stoppedBy, "done");
});
