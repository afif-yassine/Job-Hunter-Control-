import assert from "node:assert/strict";
import { test } from "node:test";
import { readPendingOffers } from "../lib/offer-reader";
import { fakeSupabase } from "./fake-supabase";

const description = "Développer et maintenir des services Python et SQL pour une équipe produit. ".repeat(3);
const claimed = [
  { id: "a", title: "Offre A", company: "Acme", location: "Paris", contract_type: "Stage", description, reader_token: "ta" },
  { id: "b", title: "Offre B", company: "Acme", location: "Paris", contract_type: "Stage", description, reader_token: "tb" },
];
const card = JSON.stringify({ missions: ["Coder"], stack: ["Python"], conditions: "", skills: ["Python", "SQL"], level: null, remote: null });
const env = { AI_READER_LEASES: "1" };

function world(extraRpc: Record<string, (args: Record<string, unknown>) => unknown> = {}) {
  const failures: Record<string, unknown>[] = [];
  const saved: Record<string, unknown>[] = [];
  const { db } = fakeSupabase({ ai_usage: [] }, {
    rpc: {
      claim_offer_readings: () => claimed,
      finish_offer_reading: (args) => (saved.push(args), true),
      release_offer_readings: () => null,
      record_offer_reading_failure: (args) => (failures.push(args), 1),
      ...extraRpc,
    },
  });
  return { db, failures, saved };
}

test("an unusable answer is counted against its reservation; a good one and a provider error are not", async () => {
  const { db, failures, saved } = world();
  const ai = async (prompt: string) => ({ text: prompt.includes("Offre A") ? "pas du json" : card, model: "m", usage: { input: 10, output: 5 } });
  assert.deepEqual(await readPendingOffers(db, { ai, env }), { read: 1, failed: 1 });
  assert.deepEqual(failures, [{ p_id: "a", p_token: "ta" }]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].p_id, "b");

  const down = world();
  const broken = async () => { throw new Error("réponse réseau coupée"); };
  assert.deepEqual(await readPendingOffers(down.db, { ai: broken, env }), { read: 0, failed: 2 });
  assert.deepEqual(down.failures, []);
});

test("before the migration the counting call does not exist: reading goes on exactly as it did, no fake summary is written", async () => {
  const saved: Record<string, unknown>[] = [];
  // fakeSupabase answers an unknown function like PostgREST does: an error, never an exception.
  const plain = fakeSupabase({ ai_usage: [] }, {
    rpc: { claim_offer_readings: () => claimed, finish_offer_reading: (args) => (saved.push(args), true), release_offer_readings: () => null },
  });
  const ai = async () => ({ text: "pas du json", model: "m", usage: { input: 10, output: 5 } });
  assert.deepEqual(await readPendingOffers(plain.db, { ai, env }), { read: 0, failed: 2 });
  assert.deepEqual(saved, []);
});

test("the migration caps the attempts at 3 and gives them back when the offer text changes", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync("supabase/migrations/20261008100000_offer_reader_attempts.sql", "utf8");
  assert.match(sql, /add column if not exists reader_attempts smallint not null default 0/);
  assert.match(sql, /and reader_attempts < 3/);
  assert.match(sql, /new\.reader_attempts=0/);
  assert.match(sql, /record_offer_reading_failure\(uuid,uuid\) to service_role/);
  assert.match(sql, /NON APPLIQUÉE/);
  const usage = readFileSync("supabase/migrations/20261008110000_ai_usage_nonnegative.sql", "utf8");
  assert.match(usage, /check \(coalesce\(cost_usd, 0\) >= 0 and input_tokens >= 0 and output_tokens >= 0\) not valid/);
  assert.match(usage, /select count\(\*\) as lignes_negatives/);
});
