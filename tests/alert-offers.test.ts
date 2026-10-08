import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { harvestOffers, isOperatorAlert } from "../lib/scan/catalogue";
import { runScan } from "../lib/scan";
import type { ScannedOffer } from "../lib/scan/types";
import { fakeSupabase } from "./fake-supabase";

const realFetch = globalThis.fetch;
const realHook = process.env.SCAN_WEBHOOK_URL;
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realHook === undefined) delete process.env.SCAN_WEBHOOK_URL; else process.env.SCAN_WEBHOOK_URL = realHook;
});

const today = new Date().toISOString().slice(0, 10);
const scanned = (source: string, id: string): ScannedOffer => ({
  source, company: `Societe ${id}`, title: "Alternance Ingénieur DevOps", location: "Paris", contract_type: "Contrat apprentissage",
  description: "Mise en place de pipelines CI/CD et d’infrastructure cloud en alternance.",
  url: `https://offres.example.test/${id}`, publishedAt: today,
});

test("which sources count as the operator's alert mailbox", () => {
  for (const source of ["alert:linkedin", "alert:welcometothejungle", "ALERT:x", "gmail:linkedin"]) assert.equal(isOperatorAlert(source), true, source);
  for (const source of ["jsearch:linkedin", "francetravail", "adzuna", "lever:acme", "", null, undefined, "my-alert:x", "alerte"]) assert.equal(isOperatorAlert(source), false, String(source));
});

test("alert offers are never poured into the shared catalogue; every other offer is, as before", async () => {
  const rows: Record<string, unknown>[] = [];
  const cache = fakeSupabase({}, { rpc: { upsert_offers: (args) => {
    rows.push(...(args.p_rows as Record<string, unknown>[]));
    return (args.p_rows as Record<string, unknown>[]).map((r, i) => ({ o_fingerprint: r.fingerprint, o_id: `o${rows.length + i}`, o_status: "open" }));
  } } });
  const result = await harvestOffers(cache.db, [scanned("alert:linkedin", "a"), scanned("jsearch:linkedin", "b"), scanned("francetravail", "c"), scanned("gmail:old", "d")]);
  assert.deepEqual(rows.map((r) => r.source).sort(), ["francetravail", "jsearch:linkedin"]);
  assert.equal(result.entries.size, 2);
  // Only alerts: nothing at all is sent to the catalogue.
  rows.length = 0;
  const alone = await harvestOffers(cache.db, [scanned("alert:linkedin", "e")]);
  assert.deepEqual(rows, []);
  assert.equal(alone.entries.size, 0);
  assert.equal(alone.error, undefined);
});

test("the administrator's own search keeps an alert offer in the list, and the catalogue never receives it", async () => {
  // A scanned offer from the alert mailbox arrives through the external scanner here, as Gmail cannot run in a test.
  process.env.SCAN_WEBHOOK_URL = "https://hooks.example.test/scan";
  globalThis.fetch = (async () => new Response(JSON.stringify({ offers: [scanned("alert:linkedin", "a"), scanned("jsearch:linkedin", "b")] }))) as typeof fetch;
  const upserted: Record<string, unknown>[] = [];
  const cache = fakeSupabase({}, { rpc: {
    upsert_offers: (args) => {
      upserted.push(...(args.p_rows as Record<string, unknown>[]));
      return (args.p_rows as Record<string, unknown>[]).map((r, i) => ({ o_fingerprint: r.fingerprint, o_id: `o${i + 1}`, o_status: "open" }));
    },
    close_board_offers: () => 0,
    expire_offers: () => 0,
  } });
  const account = fakeSupabase({
    jobs: [], job_sources: [], applications: [], agent_runs: [], notifications: [], offers: [],
    user_settings: [{ user_id: "admin", scan_config: { contracts: ["alternance"], categories: ["devops"], keywords: [], city: "Paris", departments: ["75"] } }],
  }, { rpc: { record_source_run: () => null, consume_source_budget: () => true } });
  const summary = await runScan({ supabase: account.db, userId: "admin", env: { SCAN_WEBHOOK_URL: "https://hooks.example.test/scan" }, cacheDb: cache.db });
  assert.equal(summary.inserted, 2, "both offers are in the administrator's list");
  assert.deepEqual(account.tables.jobs.map((j) => j.source_platform).sort(), ["alert:linkedin", "jsearch:linkedin"]);
  assert.deepEqual(upserted.map((r) => r.source), ["jsearch:linkedin"], "only the normal source reaches the catalogue");
});
