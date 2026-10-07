import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPlan, freeKitsPerMonth } from "../lib/plan";
import { consumeQuota, quotaRefusal } from "../lib/quota";
import { fakeSupabase } from "./fake-supabase";

test("quota authorises only true and distinguishes outages from exhausted allowances", async () => {
  for (const answer of [null, undefined, "true", 1]) {
    const { db } = fakeSupabase({}, { rpc: { consume_quota: () => answer } });
    const result = await consumeQuota(db, "owner", "generation", {});
    assert.equal(result.ok, false);
    assert.equal(quotaRefusal("generation", result.limit, result.unavailable).status, 503);
  }
  for (const answer of [false, true]) {
    const { db } = fakeSupabase({}, { rpc: { consume_quota: () => answer } });
    assert.deepEqual(await consumeQuota(db, "owner", "generation", {}), { ok: answer, limit: 10 });
  }
  assert.equal(quotaRefusal("generation", 10).status, 429);
});

test("empty or invalid free-plan settings never silently enable unlimited kits", () => {
  for (const value of [undefined, "", " ", "invalid", "-1"]) {
    assert.equal(freeKitsPerMonth({ FREE_KITS_PER_MONTH: value }), 2);
  }
  assert.equal(freeKitsPerMonth({ FREE_KITS_PER_MONTH: "0" }), 0);
});

test("unreadable document counters stop a new paid kit", async () => {
  const { db } = fakeSupabase({}, { missingTables: ["documents"], rpc: { is_admin: () => false } });
  const result = await checkPlan(db, "owner", "job", {});
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "PLAN_UNAVAILABLE");
  }
});
