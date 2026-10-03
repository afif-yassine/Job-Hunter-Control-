import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { runScan } from "../lib/scan";
import { dayBucket, harvestOffers, normalizeQuery, offerFingerprint, queryCacheParts, withinDays } from "../lib/scan/catalogue";
import type { ScanConfig } from "../lib/scan/config";
import { ingestOffers } from "../lib/scan/ingest";
import type { ScannedOffer } from "../lib/scan/types";
import { fakeSupabase } from "./fake-supabase";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const offer = (over: Partial<ScannedOffer> = {}): ScannedOffer => ({
  source: "jsearch:linkedin",
  company: "Acme",
  title: "Alternance Développeur Python",
  location: "Paris",
  contract_type: "Alternance",
  description: "Développement backend Python en alternance, API, tests, base de données.",
  url: "https://acme.example/jobs/1?utm_source=x",
  publishedAt: new Date().toISOString(),
  ...over,
});

const config: ScanConfig = { queries: [{ keywords: "Alternance  Développeur" }], departments: ["92", "75"], city: "Paris", maxAgeDays: 10, targets: [] };

test("cache identity: same query whatever the case, spaces, department order; 10 and 14 days share one window", () => {
  const a = queryCacheParts("jsearch", { keywords: "Alternance  Développeur" }, config);
  const b = queryCacheParts("jsearch", { keywords: "alternance développeur" }, { ...config, departments: ["75", "92"], maxAgeDays: 14 });
  assert.deepEqual(a, b);
  assert.deepEqual([3, 7, 10, 14, 20, 60].map(dayBucket), [7, 7, 14, 14, 31, 31]);
  const now = Date.parse("2026-10-03T12:00:00Z");
  const kept = withinDays(
    [offer({ publishedAt: "2026-10-01" }), offer({ publishedAt: "2026-09-15" }), offer({ publishedAt: null })],
    10,
    now,
  );
  assert.equal(kept.length, 2); // the 18-day-old one is cut, an undated one is kept
});

test("same job typed differently = one shared search: case, accents, order, synonyms", () => {
  const key = (keywords: string) => normalizeQuery({ keywords });
  const same = ["Alternance Développeur Web", "alternance developpeur web", "web developer alternant", "Alternance - Dev  WEB (H/F)"];
  for (const k of same) assert.equal(key(k), key(same[0]), k);
  assert.notEqual(key("alternance développeur web"), key("alternance développeur mobile"));
  assert.notEqual(key("stage data"), key("alternance data"));
});

test("harvest: offers go to the catalogue once, with a clean link and the same identity as the account's list", async () => {
  let sent: Record<string, unknown>[] = [];
  const db = fakeSupabase({}, {
    rpc: {
      upsert_offers: (args) => {
        sent = args.p_rows as Record<string, unknown>[];
        return sent.map((r, i) => ({ o_fingerprint: r.fingerprint, o_id: `offer-${i}`, o_status: "open" }));
      },
    },
  }).db;
  const { entries, error } = await harvestOffers(db, [offer(), offer({ company: "Entreprise non communiquée", url: "https://x.test/2" })]);
  assert.equal(error, undefined);
  assert.equal(sent[0].url, "https://acme.example/jobs/1");
  assert.equal(sent[1].fingerprint, "url|https://x.test/2");
  assert.equal(entries.get(offerFingerprint(offer()))!.id, "offer-0");
  // No service client, or no function yet: the scan goes on without the catalogue.
  assert.equal((await harvestOffers(null, [offer()])).entries.size, 0);
  assert.ok((await harvestOffers(fakeSupabase({}).db, [offer()])).error);
});

test("ingest: a new offer is linked to the catalogue; one the catalogue knows is gone is not proposed", async () => {
  const { db, tables } = fakeSupabase({ jobs: [], job_sources: [], applications: [] });
  const open = offer();
  const gone = offer({ title: "Stage Data Analyst", url: "https://acme.example/jobs/2" });
  const catalogue = new Map([
    [offerFingerprint(open), { id: "offer-open", status: "open" as const }],
    [offerFingerprint(gone), { id: "offer-gone", status: "closed" as const }],
  ]);
  const result = await ingestOffers(db, "u1", [open, gone], catalogue);
  assert.equal(result.inserted, 1);
  assert.equal(result.gone, 1);
  assert.equal(tables.jobs[0].offer_id, "offer-open");
});

test("scan: offers are harvested, a careers board's withdrawn offers are closed, old ones expired", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.lever.co"))
      return new Response(
        JSON.stringify([
          { text: "Alternance développeur", hostedUrl: "https://jobs.lever.co/acme/2", categories: { location: "Paris" }, descriptionPlain: "Développement web en alternance au sein de l’équipe produit." },
          { text: "Senior engineer", hostedUrl: "https://jobs.lever.co/acme/3", categories: { location: "New York" } },
        ]),
      );
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const cache = fakeSupabase(
    { source_cache: [] },
    {
      rpc: {
        upsert_offers: (args) => {
          calls.push({ fn: "upsert_offers", args });
          return (args.p_rows as Record<string, unknown>[]).map((r) => ({ o_fingerprint: r.fingerprint, o_id: "o1", o_status: "open" }));
        },
        close_board_offers: (args) => (calls.push({ fn: "close_board_offers", args }), 1),
        expire_offers: (args) => (calls.push({ fn: "expire_offers", args }), 0),
      },
    },
  );
  const account = fakeSupabase(
    {
      jobs: [],
      job_sources: [],
      applications: [],
      user_settings: [{ user_id: "u1", scan_config: { contracts: ["alternance"], keywords: ["développeur"], targets: ["lever:acme"] } }],
      agent_runs: [],
      notifications: [],
    },
    { rpc: { record_source_run: () => null, consume_source_budget: () => true } },
  );
  const summary = await runScan({ supabase: account.db, userId: "u1", env: {}, cacheDb: cache.db });
  assert.equal(summary.inserted, 1);
  assert.equal(account.tables.jobs[0].offer_id, "o1");
  const upserted = calls.find((c) => c.fn === "upsert_offers")!.args.p_rows as Record<string, unknown>[];
  assert.equal(upserted[0].board, "lever:acme");
  // Every link the board lists (even the New York one) counts as "still online".
  const closed = calls.find((c) => c.fn === "close_board_offers")!.args;
  assert.equal(closed.p_board, "lever:acme");
  assert.deepEqual(closed.p_urls, ["https://jobs.lever.co/acme/2", "https://jobs.lever.co/acme/3"]);
  assert.deepEqual(calls.find((c) => c.fn === "expire_offers")!.args, { p_days: 21 });
});

test("an offer no longer available is never sent to the AI", async () => {
  const { analyzeJob } = await import("../lib/pipeline/analyze");
  let aiCalls = 0;
  const { db } = fakeSupabase({
    jobs: [{ id: "j1", user_id: "u1", status: "DISCOVERED", description: "x".repeat(2000), gone_reason: "Retirée de la page carrière de l’entreprise." }],
    candidate_profiles: [{ user_id: "u1", profile: {}, truth_ledger: [] }],
  });
  const result = await analyzeJob({
    supabase: db,
    userId: "u1",
    jobId: "j1",
    ai: (async () => {
      aiCalls += 1;
      return "{}";
    }) as never,
    fetchPage: async () => null,
  });
  assert.equal(result.status, 410);
  assert.equal(aiCalls, 0);
});
