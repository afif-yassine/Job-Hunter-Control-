import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embeddingBackfill } from "../lib/embedding-backfill";

const env = { CRON_SECRET: "synthetic-cron", AI_GATEWAY_API_KEY: "synthetic-key" };
const request = (authorization?: string) => new Request("https://example.test/api/cron/embeddings", { method: "POST", headers: authorization ? { authorization } : {} });

test("Backfill rejects unauthorized requests before database or paid work", async () => {
  for (const authorization of [undefined, "Bearer wrong", "synthetic-cron"]) {
    const response = await embeddingBackfill(request(authorization), { env, db: () => { throw new Error("database must not be accessed"); } });
    assert.equal(response.status, 401);
  }
  assert.equal((await embeddingBackfill(request(), { env: {}, db: () => null })).status, 503);
});

test("Backfill bounds work and rejects missing configuration", async () => {
  const req = request("Bearer synthetic-cron");
  assert.equal((await embeddingBackfill(req, { env: { CRON_SECRET: env.CRON_SECRET }, db: () => null })).status, 503);
  assert.equal((await embeddingBackfill(req, { env, db: () => null })).status, 503);
  let elapsed = 0, calls = 0;
  const response = await embeddingBackfill(req, { env, db: () => ({} as SupabaseClient), now: () => elapsed, embed: async (_db, _env, opts) => {
    calls++;
    assert.equal(opts?.limit, 300);
    assert.equal(opts?.timeLeft?.(), 40_000);
    elapsed = 39_000;
    assert.equal(opts?.timeLeft?.(), 1_000);
    return 250;
  } });
  assert.equal(calls, 1);
  assert.deepEqual(await response.json(), { embedded: 250 });
});

test("Backfill does not retry or expose upstream secrets on failure", async () => {
  let calls = 0;
  const response = await embeddingBackfill(request("Bearer synthetic-cron"), { env, db: () => ({} as SupabaseClient), embed: async () => { calls++; throw new Error("secret-upstream-payload"); } });
  assert.equal(response.status, 502);
  assert.equal(calls, 1);
  assert.ok(!(await response.text()).includes("secret-upstream-payload"));
});
