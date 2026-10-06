import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { offerText, profileText, type Embedder } from "./embeddings";
import { recordAiUsage } from "./ai-usage";
import { profileSkills } from "./skills";

type Env = Record<string, string | undefined>;
export const SEMANTIC_MODEL = "perplexity/pplx-embed-v1-0.6b";
export const SEMANTIC_SPACE = `${SEMANTIC_MODEL}@retrieval-v1`;
export const SEMANTIC_DIM = 1024;
const hash = (text: string) => createHash("sha256").update(`${SEMANTIC_SPACE}\n${text}`).digest("hex");
export const semanticEnabled = (env: Env = process.env) => env.EMBEDDING_PROVIDER === "gateway";

export function perplexityEmbedder(env: Env = process.env, onUsage?: (usage: { input: number; output: number }, costUsd?: number) => Promise<void>): Embedder {
  return async texts => {
    if (!env.AI_GATEWAY_API_KEY?.trim()) throw new Error("Clé Gateway manquante pour les embeddings.");
    if (!texts.length || texts.length > 50 || texts.some(t => Buffer.byteLength(t) > 24_000)) throw new Error("Lot d’embeddings invalide.");
    const response = await fetch("https://ai-gateway.vercel.sh/v1/embeddings", {
      method: "POST", signal: AbortSignal.timeout(60_000),
      headers: { authorization: `Bearer ${env.AI_GATEWAY_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: SEMANTIC_MODEL, input: texts }),
    });
    if (!response.ok) throw new Error(`Embeddings Gateway : HTTP ${response.status}`);
    const result = await response.json();
    const data = result.data;
    if (!Array.isArray(data) || data.length !== texts.length || new Set(data.map(d => d.index)).size !== texts.length || data.some(d => !Number.isInteger(d.index) || d.index < 0 || d.index >= texts.length))
      throw new Error("Ordre du lot d’embeddings invalide.");
    const vectors = [...data].sort((a, b) => a.index - b.index).map(d => d.embedding as number[]);
    if (vectors.some(v => !Array.isArray(v) || v.length !== SEMANTIC_DIM || v.some(n => !Number.isFinite(n)) || !v.some(n => n !== 0))) throw new Error("Vecteur Perplexity invalide.");
    const cost = result.usage?.cost ?? result.usage?.provider_metadata?.gateway?.cost ?? result.usage?.providerMetadata?.gateway?.cost;
    if (result.usage) await onUsage?.({ input: result.usage.prompt_tokens ?? result.usage.total_tokens ?? 0, output: 0 }, cost !== undefined && Number.isFinite(Number(cost)) ? Number(cost) : undefined);
    return vectors;
  };
}

/** Parallel columns preserve legacy Gemini vectors. Only changed or missing versions are embedded. */
export async function embedSemanticOffers(db: SupabaseClient, env: Env, opts: { limit?: number; timeLeft?: () => number; embed?: Embedder } = {}) {
  const embed = opts.embed ?? perplexityEmbedder(env, async (usage, costUsd) => recordAiUsage(db, null, "embedding", { model: SEMANTIC_MODEL, usage, costUsd }));
  let done = 0;
  for (let i = 0; i < (opts.limit ?? 300); i += 50) {
    if (opts.timeLeft && opts.timeLeft() < 6_000) break;
    const claimed = await db.rpc("claim_semantic_offers", { p_limit: Math.min(50, (opts.limit ?? 300) - i) });
    if (claimed.error) throw new Error(`Réservation des vecteurs indisponible : ${claimed.error.message}`);
    const rows = claimed.data as { id: string; title: string; description: string | null; location: string | null; contract_type: string | null; categories: string[] | null; semantic_claim_token: string }[];
    if (!rows?.length) break;
    try {
      const texts = rows.map(offerText);
      const vectors = await embed(texts, "document");
      const saved = await db.rpc("set_semantic_offer_embeddings", { p_rows: rows.map((row, k) => ({ id: row.id, token: row.semantic_claim_token, source: { title: row.title, description: row.description, location: row.location, contract_type: row.contract_type, categories: row.categories }, hash: hash(texts[k]), embedding: JSON.stringify(vectors[k]) })) });
      if (saved.error) throw new Error(saved.error.message);
      done += Number(saved.data) || 0;
    } finally {
      await db.rpc("release_semantic_offers", { p_rows: rows.map(row => ({ id: row.id, token: row.semantic_claim_token })) });
    }
  }
  return done;
}

export async function ensureSemanticProfile(db: SupabaseClient, userId: string, env: Env, embed?: Embedder): Promise<boolean> {
  const { data, error } = await db.from("candidate_profiles").select("profile,semantic_hash,semantic_model,semantic_embedding").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Migration des vecteurs indisponible : ${error.message}`);
  if (!data?.profile) return false;
  const text = profileText(data.profile);
  const version = hash(text);
  if (data.semantic_embedding && data.semantic_hash === version && data.semantic_model === SEMANTIC_SPACE) return true;
  const lease = await db.rpc("claim_semantic_profile", { p_user_id: userId, p_hash: version });
  if (lease.error) throw new Error(lease.error.message);
  if (!lease.data) return false;
  const call = embed ?? perplexityEmbedder(env, async (usage, costUsd) => recordAiUsage(db, userId, "embedding", { model: SEMANTIC_MODEL, usage, costUsd }));
  try {
    const [vector] = await call([text], "query");
    const saved = await db.rpc("set_semantic_profile_embedding", { p_user_id: userId, p_profile: data.profile, p_hash: version, p_embedding: JSON.stringify(vector), p_skills: profileSkills(data.profile), p_token: lease.data });
    if (saved.error) throw new Error(saved.error.message);
    return saved.data === true;
  } finally {
    await db.rpc("release_semantic_profile", { p_user_id: userId, p_token: lease.data });
  }
}
