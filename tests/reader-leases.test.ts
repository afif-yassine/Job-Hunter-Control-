import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiUnavailable } from "../lib/ai";
import { readPendingOffers } from "../lib/offer-reader";

const pending = { id: "offer", title: "Stage Python", description: "API Python ".repeat(20), reader_token: "lease" };
const env = { AI_READER_LEASES: "1" };
test("an offer reserved by another worker never makes a paid request", async () => {
  const db = { rpc: async () => ({ data: [], error: null }) } as unknown as SupabaseClient;
  let calls = 0;
  assert.deepEqual(await readPendingOffers(db, { env, ai: async () => { calls++; throw new Error("must not call"); } }), { read: 0, failed: 0 });
  assert.equal(calls, 0);
});
test("failed providers and stale source versions release their leases", async () => {
  for (const providerDown of [false, true]) {
    const ops: string[] = [];
    const db = { rpc: async (name: string) => { ops.push(name); return { data: name === "claim_offer_readings" ? [pending] : false, error: null }; } } as unknown as SupabaseClient;
    const run = () => readPendingOffers(db, { env, ai: async () => {
      if (providerDown) throw new AiUnavailable(new Error("503"));
      return { text: '{"skills":["python"]}', model: "synthetic" };
    } });
    if (providerDown) await assert.rejects(run(), /indisponible/);
    else assert.deepEqual(await run(), { read: 0, failed: 1 });
    assert.equal(ops.at(-1), "release_offer_readings");
  }
});
