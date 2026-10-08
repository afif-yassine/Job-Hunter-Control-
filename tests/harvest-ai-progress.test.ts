import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGrowth, growthFrom, type RawStats } from "../lib/admin/growth";
import { demoGrowthRaw } from "../lib/demo-data";
import { runHarvestSlice, slotOf } from "../lib/scan/harvest";
import { fakeSupabase } from "./fake-supabase";

const now = new Date("2026-10-06T13:00:00Z");
const idle = () => ({ harvest_runs: [{ id: slotOf(now), status: "done", counters: { tasks: 12, errors: 0, francetravail: 340 } }], offers: [], ai_usage: [] });

test("HARVEST — what the vectorisation and the reader did is kept in harvest_runs.counters, added up slice after slice", async () => {
  const { db, tables } = fakeSupabase(idle(), { rpc: { expire_offers: () => 0 } });
  // No vector provider and no legacy embedder: nothing happens, and the summary says so ("none").
  await runHarvestSlice(db, { env: {}, now, budgetMs: 45_000, embed: null, reader: null });
  const ai = (tables.harvest_runs[0].counters as { ai: Record<string, unknown> }).ai;
  assert.equal(ai.provider, "none");
  assert.equal(ai.slices, 1);
  assert.equal(ai.embedded, 0);
  assert.equal(ai.lastSliceAt, now.toISOString());
  assert.deepEqual(ai.lastErrors, []);
  // The earlier counters of the run are kept.
  assert.deepEqual({ tasks: (tables.harvest_runs[0].counters as Record<string, unknown>).tasks, francetravail: (tables.harvest_runs[0].counters as Record<string, unknown>).francetravail }, { tasks: 12, francetravail: 340 });
  await runHarvestSlice(db, { env: {}, now, budgetMs: 45_000, embed: null, reader: null });
  assert.equal(((tables.harvest_runs[0].counters as { ai: Record<string, unknown> }).ai).slices, 2);
});

test("HARVEST — a vectorisation failure and the legacy path are visible in the counters, not only in an answer nobody reads", async () => {
  const { db, tables } = fakeSupabase(idle(), { rpc: { expire_offers: () => 0 } });
  // Gateway mode, but the reservation function is missing: the error must be recorded, short, without a key.
  const report = await runHarvestSlice(db, { env: { EMBEDDING_PROVIDER: "gateway", AI_GATEWAY_API_KEY: "secret-key-123" }, now, budgetMs: 45_000, reader: null });
  assert.ok(report.errors.some((e) => e.startsWith("embeddings versionnés")));
  const ai = (tables.harvest_runs[0].counters as { ai: { provider: string; lastErrors: string[] } }).ai;
  assert.equal(ai.provider, "gateway");
  assert.equal(ai.lastErrors.length, 1);
  assert.ok(ai.lastErrors[0].length <= 160);
  assert.ok(!JSON.stringify(tables.harvest_runs[0].counters).includes("secret-key-123"));
  // Without EMBEDDING_PROVIDER=gateway and with an embedder, the legacy path is named.
  const legacy = fakeSupabase(idle(), { rpc: { expire_offers: () => 0, set_offer_embeddings: () => 0 } });
  await runHarvestSlice(legacy.db, { env: {}, now, budgetMs: 45_000, embed: async (texts) => texts.map(() => [0.1]), reader: null });
  assert.equal((legacy.tables.harvest_runs[0].counters as { ai: { provider: string } }).ai.provider, "legacy");
});

test("HARVEST — a counters write that fails never stops the harvest", async () => {
  const { db } = fakeSupabase({ ...idle(), harvest_runs: [] }, { rpc: { expire_offers: () => 0 } });
  // No run row at all: the summary has nowhere to go; the slice still creates its run and answers.
  const report = await runHarvestSlice(db, { env: {}, now, budgetMs: 0, embed: null, reader: null });
  assert.equal(report.created, true);
});

test("GROWTH — the 'vectorised offers' figure counts the column really used and says which one", async () => {
  const withSemantic = growthFrom({ ...demoGrowthRaw, offers_embedded: 1793, offers_embedded_semantic: 4020 } as RawStats, [], {}, now);
  assert.equal(withSemantic.stats.offers_embedded, 4020);
  assert.deepEqual(withSemantic.embeddings, { counted: "semantic_embedding", legacyCount: 1793 });
  const legacyOnly = growthFrom({ ...demoGrowthRaw, offers_embedded: 1793 } as RawStats, [], {}, now);
  assert.equal(legacyOnly.stats.offers_embedded, 1793);
  assert.deepEqual(legacyOnly.embeddings, { counted: "legacy_embedding", legacyCount: 1793 });
  // buildGrowth falls back to the legacy figure, labelled as such, when the count cannot be read.
  const { db } = fakeSupabase({ admin_quests: [], offers: [] }, { rpc: { admin_growth_stats: () => ({ ...demoGrowthRaw, offers_embedded: 1793 }) } });
  const built = await buildGrowth(db, {}, now);
  assert.equal(built.embeddings.counted, "legacy_embedding");
});
