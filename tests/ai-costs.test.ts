import assert from "node:assert/strict";
import { test } from "node:test";
import { aiCost, aiPrices } from "../lib/ai";
import { aiCostsByAccount } from "../lib/admin/ai-costs";
import { recordAiUsage } from "../lib/ai-usage";
import { fakeSupabase } from "./fake-supabase";

test("AI cost: tokens recorded per account at each call, priced and ranked in Admin", async () => {
  assert.deepEqual(aiPrices({}), { input: 0.3, output: 2.5 });
  assert.equal(aiCost({ input: 1_000_000, output: 1_000_000 }, { AI_PRICE_INPUT_PER_M: "1", AI_PRICE_OUTPUT_PER_M: "4" }), 5);
  const { db, tables } = fakeSupabase({ ai_usage: [] });
  await recordAiUsage(db, "u1", "analysis", { text: "{}", model: "m", usage: { input: 4000, output: 600 } });
  await recordAiUsage(db, "u1", "writing", { text: "{}", model: "m", usage: { input: 9000, output: 3000 } });
  await recordAiUsage(db, "u2", "analysis", { text: "{}", model: "m", usage: { input: 1000, output: 100 } });
  await recordAiUsage(db, "u3", "analysis", { text: "{}", model: "m" }); // no usage reported → nothing stored
  assert.equal(tables.ai_usage.length, 3);
  for (const r of tables.ai_usage) r.created_at = new Date().toISOString();
  const costs = await aiCostsByAccount(db, 30, {});
  assert.deepEqual(costs.accounts.map((a) => [a.userId, a.calls, a.input, a.output]), [
    ["u1", 2, 13000, 3600],
    ["u2", 1, 1000, 100],
  ]);
  assert.equal(costs.total.calls, 3);
  assert.ok(Math.abs(costs.total.usd - aiCost({ input: 14000, output: 3700 }, {})) < 1e-9);
});
