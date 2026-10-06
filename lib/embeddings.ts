import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiUnavailable } from "@/lib/ai";
import { profileSkills } from "@/lib/skills";

/**
 * Embeddings (Gemini, 768 dimensions): a vector per open offer, computed once
 * by the platform harvest, and one per profile. Offers are then ranked by how
 * close they are to the profile — "Ingénieur plateforme" meets a DevOps CV
 * even without a shared word.
 */

type Env = Record<string, string | undefined>;
export const EMBED_DIM = 768;
const BATCH = 50;

/** What a text is: an offer (stored) or a profile (compared with the offers). */
export type EmbedKind = "document" | "query";
/** texts → vectors (same order). Injected in tests. */
export type Embedder = (texts: string[], kind?: EmbedKind) => Promise<number[][]>;

/**
 * gemini-embedding-001: one vector per text of a batch. (gemini-embedding-2
 * reads a batch as the parts of ONE input and answers a single vector: that
 * is why no offer had a vector until October 6.)
 */
export function embeddingModel(env: Env = process.env): string {
  return env.AI_EMBEDDING_MODEL?.trim() || env.EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
}

/** Rough token count of texts (the embedding API does not report it). */
export const approxTokens = (texts: string[]) => Math.ceil(texts.reduce((n, t) => n + t.length, 0) / 4);

export function geminiEmbedder(env: Env = process.env): Embedder | null {
  if (!env.GEMINI_API_KEY?.trim()) return null;
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const model = embeddingModel(env);
  if (model.replace(/^models\//, "") !== "gemini-embedding-001")
    throw new Error("Le stockage historique accepte uniquement Gemini embedding 001. Utilise la migration versionnée avant de changer de modèle.");
  const call = async (contents: string[], kind: EmbedKind) => {
    const r = await ai.models.embedContent({
      model,
      contents,
      config: { outputDimensionality: EMBED_DIM, taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT" },
    });
    return (r.embeddings ?? []).map((e) => e.values ?? []);
  };
  return async (texts, kind = "document") => {
    try {
      let vectors = await call(texts, kind);
      // A model that merges the batch into one input: one text per call.
      if (vectors.length !== texts.length && texts.length > 1) {
        vectors = [];
        for (const t of texts) vectors.push(...(await call([t], kind)));
      }
      if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBED_DIM))
        throw new Error(`réponse d’embedding inattendue (${vectors.length}/${texts.length}, modèle ${model})`);
      return vectors;
    } catch (error) {
      throw new AiUnavailable(error);
    }
  };
}

/** pgvector text format. */
export const toVector = (v: number[]) => `[${v.map((x) => (Number.isFinite(x) ? Number(x.toFixed(6)) : 0)).join(",")}]`;

type OfferForEmbedding = {
  title: string;
  company?: string | null;
  location?: string | null;
  contract_type?: string | null;
  categories?: string[] | null;
  description?: string | null;
};

export function offerText(o: OfferForEmbedding): string {
  return [
    `Offre : ${o.title}`,
    o.contract_type ? `Contrat : ${o.contract_type}` : "",
    o.categories?.length ? `Métiers : ${o.categories.join(", ")}` : "",
    o.location ? `Lieu : ${o.location}` : "",
    (o.description ?? "").replace(/\s+/g, " ").slice(0, 1800),
  ]
    .filter(Boolean)
    .join("\n");
}

type Profile = Record<string, unknown>;

/** The facts of a profile, as one text (what the offers are compared with). */
export function profileText(profile: Profile): string {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const lines: string[] = ["Profil de candidat"];
  for (const e of arr(profile.experience))
    lines.push(`Expérience : ${e.title ?? ""} — ${e.organization ?? ""}. ${(Array.isArray(e.facts) ? e.facts : []).join(" ")} ${(Array.isArray(e.technologies) ? e.technologies : []).join(", ")}`);
  for (const p of arr(profile.projects))
    lines.push(`Projet : ${p.name ?? ""}. ${(Array.isArray(p.technologies) ? p.technologies : []).join(", ")} ${p.description ?? ""}`);
  for (const e of arr(profile.education)) lines.push(`Formation : ${e.degree ?? ""}`);
  const skills = (profile.skills ?? {}) as Record<string, unknown>;
  const flat = Object.values(skills).flatMap((v) => (Array.isArray(v) ? v : []));
  if (flat.length) lines.push(`Compétences : ${flat.join(", ")}`);
  const target = (profile.target ?? {}) as Record<string, unknown>;
  if (target && Object.keys(target).length) lines.push(`Recherche : ${JSON.stringify(target)}`);
  return lines.join("\n").slice(0, 6000);
}

/** Open offers without a vector get one (platform harvest, service client). */
export async function embedPendingOffers(
  db: SupabaseClient,
  embed: Embedder,
  opts: { limit?: number; timeLeft?: () => number; onUsage?: (tokens: number) => void } = {},
): Promise<number> {
  const { data, error } = await db
    .from("offers")
    .select("id,title,company,location,contract_type,categories,description")
    .eq("status", "open")
    .is("embedding", null)
    .limit(opts.limit ?? 300);
  if (error || !data?.length) return 0;
  let done = 0;
  for (let i = 0; i < data.length; i += BATCH) {
    if (opts.timeLeft && opts.timeLeft() < 6_000) break;
    const chunk = data.slice(i, i + BATCH) as (OfferForEmbedding & { id: string })[];
    const texts = chunk.map(offerText);
    const vectors = await embed(texts, "document");
    opts.onUsage?.(approxTokens(texts));
    const { data: n } = await db.rpc("set_offer_embeddings", {
      p_rows: chunk.map((o, k) => ({ id: o.id, embedding: toVector(vectors[k]) })),
    });
    done += Number(n) || 0;
  }
  return done;
}

/** The account's profile vector, (re)computed when missing or when the profile changed. Never throws. */
export async function ensureProfileEmbedding(
  supabase: SupabaseClient,
  userId: string,
  embed: Embedder | null,
  force = false,
  model = embeddingModel(),
): Promise<boolean> {
  try {
    const { data } = await supabase.from("candidate_profiles").select("profile,embedding,embedding_hash,skills").eq("user_id", userId).maybeSingle();
    if (!data?.profile) return false;
    const profile = data.profile as Profile;
    // Skills in common are compared even without a vector: kept in step first.
    const skills = profileSkills(profile);
    const stored = Array.isArray(data.skills) ? (data.skills as string[]) : null;
    if (stored && (stored.length !== skills.length || stored.some((s, i) => s !== skills[i])))
      await supabase.from("candidate_profiles").update({ skills }).eq("user_id", userId);
    if (!embed) return false;
    const text = profileText(profile);
    // The hash invalidates this profile's cache; it does NOT version the SQL offer vectors.
    const hash = createHash("sha256").update(`${model}\n${text}`).digest("hex").slice(0, 32);
    if (data.embedding && data.embedding_hash === hash && !force) return true;
    const [vector] = await embed([text], "query");
    const { error } = await supabase
      .from("candidate_profiles")
      .update({ embedding: toVector(vector), embedding_at: new Date().toISOString(), embedding_hash: hash })
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}
