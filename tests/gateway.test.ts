import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { aiConfigured, generateJson, generateJsonFromPdf, modelFor } from "../lib/ai";
import { perplexityEmbedder, SEMANTIC_DIM } from "../lib/semantic-embeddings";
import { fitScore } from "../lib/fit";
import { embedSemanticOffers, ensureSemanticProfile } from "../lib/semantic-embeddings";
import type { SupabaseClient } from "@supabase/supabase-js";
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const env = { AI_PROVIDER: "gateway", AI_GATEWAY_API_KEY: "synthetic-test-key" };
test("Gateway routes per task and bounds output with a strict kit schema only for generation", async () => {
  assert.equal(aiConfigured(env), true); assert.equal(aiConfigured({ AI_PROVIDER: "gateway", GEMINI_API_KEY: "x" }), false);
  assert.equal(modelFor("writing", env), "openai/gpt-6-luna"); assert.equal(modelFor("reading", env), "alibaba/qwen3.7-flash");
  const requests: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, init) => { requests.push(JSON.parse(String(init?.body))); return Response.json({ choices: [{ finish_reason: "stop", message: { content: "{}" } }], usage: { prompt_tokens: 8, completion_tokens: 4, cost: "0.00001" } }); };
  const result = await generateJson("synthetic", "writing", env, { strictKit: true });
  assert.equal(result.costUsd, 0.00001); assert.equal(requests[0].max_tokens, 2400);
  assert.equal((requests[0].response_format as { type: string }).type, "json_schema");
  await generateJson("synthetic revision", "writing", env);
  assert.equal((requests[1].response_format as { type: string }).type, "json_object");
  await assert.rejects(generateJsonFromPdf("x", new Uint8Array(), "writing", env), /PDF/);
});
test("Gateway truncation and quota error never retry or expose provider response content", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ choices: [{ finish_reason: "length", message: { content: "partial" } }] }); };
  await assert.rejects(generateJson("x", "writing", env), /incomplète/); assert.equal(calls, 1);
  globalThis.fetch = async () => { calls++; return Response.json({ error: "secret prompt" }, { status: 429 }); };
  await assert.rejects(generateJson("x", "reading", env), error => error instanceof Error && !error.message.includes("secret prompt")); assert.equal(calls, 2);
});
test("Perplexity validates batch indices and dimensions and reorders vectors", async () => {
  const a = Array(SEMANTIC_DIM).fill(0.1), b = Array(SEMANTIC_DIM).fill(0.2);
  globalThis.fetch = async () => Response.json({ data: [{ index: 1, embedding: b }, { index: 0, embedding: a }] });
  assert.deepEqual(await perplexityEmbedder(env)(["A", "B"]), [a, b]);
  globalThis.fetch = async () => Response.json({ data: [{ index: 0, embedding: a }, { index: 0, embedding: b }] });
  await assert.rejects(perplexityEmbedder(env)(["A", "B"]), /Ordre/);
  globalThis.fetch = async () => Response.json({ data: [{ index: 0, embedding: [1, 2] }] });
  await assert.rejects(perplexityEmbedder(env)(["A"]), /invalide/);
});
test("Perplexity cosine does not inherit Gemini's numeric score thresholds", () => {
  assert.equal(fitScore(0.35, [], [], "perplexity/pplx-embed-v1-0.6b@retrieval-v1"), null);
  assert.equal(fitScore(0.35, ["python"], ["sql"], "perplexity/pplx-embed-v1-0.6b@retrieval-v1")?.score, 50);
});

test("Concurrent embedding reservations skip paid calls and release failed batches", async () => {
  let calls = 0;
  const embed = async () => { calls++; throw new Error("provider unavailable"); };
  const emptyDb = { rpc: async () => ({ data: [], error: null }) } as unknown as SupabaseClient;
  assert.equal(await embedSemanticOffers(emptyDb, env, { embed }), 0);
  const profileDb = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile: { skills: ["Python"] } }, error: null }) }) }) }),
    rpc: async () => ({ data: null, error: null }),
  } as unknown as SupabaseClient;
  assert.equal(await ensureSemanticProfile(profileDb, "owner", env, embed), false);
  assert.equal(calls, 0);
  const operations: string[] = [];
  const failedDb = { rpc: async (name: string) => {
    operations.push(name);
    return { data: name === "claim_semantic_offers" ? [{ id: "offer", title: "Python", semantic_claim_token: "lease" }] : null, error: null };
  } } as unknown as SupabaseClient;
  await assert.rejects(embedSemanticOffers(failedDb, env, { embed }), /provider unavailable/);
  assert.equal(calls, 1);
  assert.deepEqual(operations, ["claim_semantic_offers", "release_semantic_offers"]);
});
