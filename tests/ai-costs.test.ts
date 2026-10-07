import assert from "node:assert/strict";
import { test } from "node:test";
import { aiCost, aiPrices } from "../lib/ai";
import { aiCostsByAccount } from "../lib/admin/ai-costs";
import { recordAiUsage } from "../lib/ai-usage";
import { fakeSupabase } from "./fake-supabase";

test("AI cost: tokens recorded per account at each call, priced and ranked in Admin", async () => {
  assert.deepEqual(aiPrices({}), { input: 0.3, output: 2.5 });
  assert.equal(aiCost({ input: 1_000_000, output: 1_000_000 }, { AI_PRICE_INPUT_PER_M: "1", AI_PRICE_OUTPUT_PER_M: "4" }), 5);
  const { db, tables } = fakeSupabase({ ai_usage: [] }, { rpc: { admin_ai_usage_by_model: () => tables.ai_usage } });
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

test("AI provider errors are explained in plain French (no raw JSON)", async () => {
  const { explainAiError } = await import("../lib/ai");
  const raw = '{"error":{"code":402,"message":"Your prepayment credits are depleted. Please go to AI Studio…","status":"RESOURCE_EXHAUSTED"}}';
  assert.match(explainAiError(new Error(raw)), /^Crédit IA épuisé/);
  assert.match(explainAiError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')), /^Limite de l’IA/);
  assert.match(explainAiError(new Error("API key not valid. Please pass a valid API key.")), /^Clé IA refusée/);
  assert.match(explainAiError(new Error("503 UNAVAILABLE: The model is overloaded")), /momentanément indisponible/);
});

test("admin honours provider costs, zero-cost calls and shared embeddings, and alerts at 80%", async () => {
  const now = new Date();
  const rows = [
    { user_id: "u1", model: "openai/gpt-6-luna", input_tokens: 1000, output_tokens: 100, cost_usd: "1.6", created_at: now.toISOString() },
    { user_id: "u1", model: "openai/gpt-6-luna", input_tokens: 9000, output_tokens: 5000, cost_usd: 0, created_at: now.toISOString() },
    { user_id: null, model: "perplexity/pplx-embed-v1-0.6b", input_tokens: 1000, output_tokens: 0, cost_usd: null, created_at: now.toISOString() },
  ];
  const { db } = fakeSupabase({ ai_usage: rows }, { rpc: { admin_ai_usage_by_model: () => rows } });
  const costs = await aiCostsByAccount(db, 30, { AI_SPEND_ALERT_USD: "2" }, now);
  assert.equal(costs.accounts.find(a => a.userId === "u1")?.usd, 1.6);
  assert.equal(costs.accounts.find(a => a.userId === "platform")?.usd, 0.000004);
  assert.equal(costs.alert.level, "warning");
  assert.ok(costs.total.usd < 2);
  const exceeded = await aiCostsByAccount(db, 30, { AI_SPEND_ALERT_USD: "1" }, now);
  assert.equal(exceeded.alert.level, "exceeded");
});
