import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { runScan } from "../lib/scan";
import { fakeSupabase } from "./fake-supabase";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const KEYS = {
  JSEARCH_API_KEY: "k", ADZUNA_APP_ID: "a", ADZUNA_APP_KEY: "b", JOOBLE_API_KEY: "j", LBA_API_KEY: "l",
  FRANCE_TRAVAIL_CLIENT_ID: "x", FRANCE_TRAVAIL_CLIENT_SECRET: "y",
};
const now = new Date().toISOString();
const offer = (n: number) => ({
  id: `o${n}`, fingerprint: `fp${n}`, title: `Alternance DevOps ${n}`, company: `Societe ${n}`, location: "Paris", contract_type: "Contrat apprentissage",
  source: "francetravail", url: `https://x.test/${n}`, apply_url: null, published_at: now.slice(0, 10), rome_code: "M1827", board: null,
  categories: ["devops"], contract_kind: "alternance", status: "open", last_seen_at: now,
  description: "Mise en place de pipelines CI/CD, Docker et Kubernetes en alternance.", summary: { skills: ["docker", "kubernetes", "python"] },
});
const search = { contracts: ["alternance"], categories: ["devops"], keywords: ["développeur"], city: "Paris", departments: ["75"], targets: ["lever:acme"] };

function world(opts: { table: boolean; admin?: boolean }) {
  const data: Record<string, Record<string, unknown>[]> = {
    offers: Array.from({ length: 10 }, (_, i) => offer(i + 1)), offer_unlocks: [], jobs: [], job_sources: [], applications: [], agent_runs: [], notifications: [], documents: [],
    app_admins: opts.admin ? [{ user_id: "u1" }] : [],
    user_settings: [{ user_id: "u1", auto_scan: true, last_scan_at: null, scan_config: search }],
    candidate_profiles: [{ user_id: "u1", profile: { skills: ["Docker", "Kubernetes", "Python"] }, skills: ["docker", "kubernetes", "python"], semantic_hash: "h" }],
  };
  const rpc: Record<string, (a: Record<string, unknown>) => unknown> = {
    record_source_run: () => null, consume_source_budget: () => true,
    match_offers_for_me_v2: () => data.offers.map((o, i) => ({ offer_id: o.id, similarity: 0.9 - i / 100, model: "perplexity/pplx-embed-v1-0.6b@retrieval-v1" })),
    claim_daily_unlock: (a) => {
      if (data.offer_unlocks.some((r) => r.origin === "daily")) return [];
      const take = (a.p_offer_ids as string[]).slice(0, 8);
      for (const id of take) data.offer_unlocks.push({ user_id: a.p_user, offer_id: id, unlocked_on: new Date().toISOString().slice(0, 10), origin: "daily" });
      return take.map((id) => ({ o_offer_id: id }));
    },
  };
  return { ...fakeSupabase(data, { missingTables: opts.table ? undefined : ["offer_unlocks"], rpc }), data };
}

function watch() {
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return new Response(JSON.stringify({ data: [], jobs: [], results: [] }), { status: 200 });
  }) as typeof fetch;
  return seen;
}

test("SELECTION ACTIVE — a student's update calls no job site and no careers page, with every key set and STUDENT_CATALOGUE_ONLY unset; the lot still arrives", async () => {
  const seen = watch();
  const w = world({ table: true });
  const summary = await runScan({ supabase: w.db, userId: "u1", env: KEYS, cacheDb: w.db, student: true });
  assert.deepEqual(seen, [], "no outgoing request at all");
  assert.ok(summary.reports.some((r) => r.source === "Sources d’emploi externes" && r.status === "skipped"));
  assert.ok(!summary.reports.some((r) => /JSearch|Adzuna|Jooble|France Travail|bonne alternance|Pages carrière/i.test(r.source)));
  assert.equal(summary.configured, true);
  assert.equal(w.data.offer_unlocks.length, 8);
  assert.equal(w.data.jobs.length, 8);
  assert.equal(summary.inserted, 8);
});

test("SELECTION NOT INSTALLED — as before: the same student update still calls the job sites", async () => {
  const seen = watch();
  const w = world({ table: false });
  await runScan({ supabase: w.db, userId: "u1", env: KEYS, cacheDb: w.db, student: true });
  assert.ok(seen.some((u) => !u.includes("api.lever.co")), "job sites are called while the selection is not installed");
});

test("ADMINISTRATOR — never concerned: his search still calls the job sites even when the table exists", async () => {
  const seen = watch();
  const w = world({ table: true, admin: true });
  await runScan({ supabase: w.db, userId: "u1", env: KEYS, cacheDb: w.db });
  assert.ok(seen.length > 0);
  assert.equal(w.data.offer_unlocks.length, 0);
});

test("THREE PATHS — the scan route, the automatic pipeline and the daily tick all go through the same rule", () => {
  const route = readFileSync("app/api/scan/route.ts", "utf8");
  assert.match(route, /unlockGate\(auth\.supabase, auth\.userId\)/);
  assert.match(route, /const catalogueOnly = !admin && \(studentCatalogueOnly\(\) \|\| gate\.active\)/);
  assert.ok(route.indexOf("const catalogueOnly") < route.indexOf("consumeQuota(auth.supabase"), "decided before the quota");
  assert.match(route, /if \(!catalogueOnly\) \{\s*const quota = await consumeQuota/);
  // The automatic pipeline and the tick call runScan, which applies the rule itself, before reading any key or source.
  const server = readFileSync("lib/pipeline/server.ts", "utf8");
  assert.match(server, /return runScan\(\{ supabase: db, userId, log: false, student,/);
  const scan = readFileSync("lib/scan/index.ts", "utf8");
  assert.ok(scan.indexOf("const catalogueOnly = Boolean(ctx.catalogueOnly) || gate.active") < scan.indexOf("loadIntegrationEnv(ctx.supabase"));
  assert.match(scan, /await Promise\.all\(gate\.active \? \[\]/);
});
