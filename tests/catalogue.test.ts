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

test("catalogue match: the job words in the title, the contract in title or contract type, in the account's area", async () => {
  const { matchesQuery, inArea } = await import("../lib/scan/catalogue");
  const q = { keywords: "alternance développeur web" };
  assert.ok(matchesQuery({ title: "Développeur Web (H/F)", contract_type: "Contrat d'apprentissage" }, q));
  assert.ok(matchesQuery({ title: "Web developer — alternant" }, q));
  assert.ok(matchesQuery({ title: "Développeur web", source: "lba:francetravail" }, q));
  assert.ok(!matchesQuery({ title: "Développeur web", contract_type: "CDI" }, q));
  assert.ok(!matchesQuery({ title: "Développeur mobile", contract_type: "Alternance" }, q));
  assert.ok(matchesQuery({ title: "Stage IA générative" }, { keywords: "stage intelligence artificielle" }));
  const area = { city: "Paris", departments: ["75", "92"] };
  assert.ok(inArea("75 - PARIS 08", area));
  assert.ok(inArea("Nanterre (92)", area));
  assert.ok(inArea("92100 Boulogne-Billancourt", area));
  assert.ok(!inArea("Lyon 69003", area));
  assert.ok(!inArea("Paris-l'Hôpital 71150".replace("Paris-l'Hôpital", "Chagny"), area));
  assert.ok(!inArea(null, area));
  // Communes and département names written without any number.
  assert.ok(inArea("Puteaux, Hauts-de-Seine", area));
  assert.ok(inArea("La Défense, Courbevoie", area));
  assert.ok(inArea("Issy-les-Moulineaux", area));
  assert.ok(!inArea("Montreuil", area)); // 93, not chosen
  assert.ok(inArea("Montreuil", { city: "Paris", departments: ["93"] }));
  assert.ok(!inArea("Versailles - 78", area));
  assert.ok(inArea("Ile-de-France", area));
  assert.ok(!inArea("Yvelines, Ile-de-France", area));
  // Plurals and English titles.
  assert.ok(matchesQuery({ title: "Software Engineer Intern" }, { keywords: "stage développeur" }));
  assert.ok(matchesQuery({ title: "Développeurs web", contract_type: "Apprentice" }, q));
});

test("a new account with no key at all gets the offers others already found, and nothing is harvested again", async () => {
  const now = new Date().toISOString();
  const row = (id: string, over: Record<string, unknown>) => ({
    id,
    fingerprint: `fp-${id}`,
    title: "Alternance Développeur Web",
    company: `Company ${id}`,
    location: "Paris 11e",
    contract_type: "Alternance",
    description: "Développement web front et back en alternance, React et Node.",
    source: "francetravail",
    url: `https://x.test/${id}`,
    apply_url: null,
    published_at: now.slice(0, 10),
    rome_code: "M1805",
    board: null,
    status: "open",
    last_seen_at: now,
    ...over,
  });
  const account = fakeSupabase(
    {
      offers: [
        row("1", {}),
        row("2", { title: "Web developer apprenticeship", board: "lever:acme" }),
        row("3", { location: "Lyon" }), // elsewhere
        row("4", { status: "closed" }), // withdrawn
        row("5", { title: "Comptable" }), // another job
      ],
      jobs: [],
      job_sources: [],
      applications: [],
      user_settings: [{ user_id: "new", scan_config: { contracts: ["alternance"], keywords: ["développeur web"], city: "Paris", departments: ["75"] } }],
      agent_runs: [],
      notifications: [],
    },
    { rpc: { record_source_run: () => null, consume_source_budget: () => true } },
  );
  globalThis.fetch = (async () => new Response("[]")) as typeof fetch; // the shared Lever board: empty page
  let harvested: unknown[] = [];
  const cache = fakeSupabase({ source_cache: [] }, {
    rpc: { upsert_offers: (a) => ((harvested = a.p_rows as unknown[]), []), close_board_offers: () => 0, expire_offers: () => 0 },
  });
  const summary = await runScan({ supabase: account.db, userId: "new", env: {}, cacheDb: cache.db });
  assert.equal(summary.configured, true);
  assert.equal(summary.inserted, 2);
  assert.deepEqual(account.tables.jobs.map((j) => j.offer_id).sort(), ["1", "2"]);
  assert.equal(summary.reports.find((r) => r.source === "Catalogue commun")!.found, 2);
  assert.equal(harvested.length, 0);
  // The company behind a catalogue offer is read too (here: Lever "acme").
  assert.ok(summary.reports.some((r) => r.source.startsWith("Pages carrière") && r.status === "ok"));

  const { seedFromCatalogue } = await import("../lib/scan");
  assert.equal(await seedFromCatalogue(account.db, "new"), 0); // already in the list
});
