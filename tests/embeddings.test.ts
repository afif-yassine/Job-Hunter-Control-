import assert from "node:assert/strict";
import { test } from "node:test";
import { EMBED_DIM, embedPendingOffers, ensureProfileEmbedding, offerText, profileText, toVector, type Embedder } from "../lib/embeddings";
import { importFromCatalogue } from "../lib/scan/catalogue";
import type { ScanConfig } from "../lib/scan/config";
import { fakeSupabase } from "./fake-supabase";

const fakeEmbed = (): { embed: Embedder; calls: string[][] } => {
  const calls: string[][] = [];
  return { calls, embed: async (texts) => (calls.push(texts), texts.map((_, i) => Array.from({ length: EMBED_DIM }, () => i / 10))) };
};

test("texts embedded: offer (title, contract, métiers, place, text) and profile (facts only)", () => {
  const o = offerText({ title: "Ingénieur plateforme", contract_type: "Alternance", categories: ["devops"], location: "Paris", description: "Kubernetes\\n et  Terraform" });
  assert.match(o, /Offre : Ingénieur plateforme/);
  assert.match(o, /Métiers : devops/);
  const p = profileText({
    experience: [{ title: "Stagiaire DevOps", organization: "Noetem", facts: ["CI/CD GitLab"], technologies: ["Docker"] }],
    projects: [{ name: "Agent IA", technologies: ["Python"] }],
    skills: { devops: ["Kubernetes"] },
  });
  assert.match(p, /Expérience : Stagiaire DevOps — Noetem\. CI\/CD GitLab Docker/);
  assert.match(p, /Compétences : Kubernetes/);
  assert.equal(toVector([0.1234567, Number.NaN]), "[0.123457,0]");
});

test("harvest: open offers without a vector get one, in batches, through the service function", async () => {
  const offers = Array.from({ length: 60 }, (_, i) => ({ id: `o${i}`, title: `Offre ${i}`, status: "open", embedding: null }));
  const stored: { id: string; embedding: string }[] = [];
  const { db } = fakeSupabase({ offers }, { rpc: { set_offer_embeddings: (a) => (stored.push(...(a.p_rows as typeof stored)), (a.p_rows as unknown[]).length) } });
  const { embed, calls } = fakeEmbed();
  assert.equal(await embedPendingOffers(db, embed, { limit: 300 }), 60);
  assert.deepEqual(calls.map((c) => c.length), [50, 10]);
  assert.equal(stored[0].embedding.split(",").length, EMBED_DIM);
  // Out of time: nothing more is sent.
  assert.equal(await embedPendingOffers(db, embed, { timeLeft: () => 1000 }), 0);
});

test("profile vector: computed once per version of the profile, recomputed when it changes", async () => {
  const { db, tables } = fakeSupabase({ candidate_profiles: [{ user_id: "u1", profile: { skills: { data: ["SQL"] } }, embedding_hash: null }] });
  const { embed, calls } = fakeEmbed();
  assert.equal(await ensureProfileEmbedding(db, "u1", embed), true);
  assert.equal(await ensureProfileEmbedding(db, "u1", embed), true);
  assert.equal(calls.length, 1);
  (tables.candidate_profiles[0].profile as { skills: Record<string, string[]> }).skills.data.push("Python");
  await ensureProfileEmbedding(db, "u1", embed);
  assert.equal(calls.length, 2);
  assert.equal(await ensureProfileEmbedding(db, "nobody", embed), false);
  assert.equal(await ensureProfileEmbedding(db, "u1", null), false);
});

test("catalogue import: offers close to the CV come too, even without a shared word — same place, dates, contracts", async () => {
  const now = new Date().toISOString();
  const row = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    fingerprint: `fp-${id}`,
    title: "Ingénieur plateforme",
    company: `C${id}`,
    location: "Paris",
    contract_type: "Contrat apprentissage",
    source: "francetravail",
    url: `https://x.test/${id}`,
    apply_url: null,
    published_at: now.slice(0, 10),
    rome_code: null,
    board: null,
    categories: [],
    contract_kind: "alternance",
    status: "open",
    last_seen_at: now,
    description: "Kubernetes",
    ...over,
  });
  const { db } = fakeSupabase(
    { offers: [row("1"), row("2", { location: "Lyon" }), row("3", { contract_kind: "cdd", contract_type: "CDD" }), row("4")] },
    {
      rpc: {
        match_offers_for_me: () => [
          { offer_id: "1", similarity: 0.81 },
          { offer_id: "2", similarity: 0.8 },
          { offer_id: "3", similarity: 0.79 },
          { offer_id: "4", similarity: 0.3 },
        ],
      },
    },
  );
  const config: ScanConfig = { queries: [{ keywords: "alternance comptable" }], departments: ["75"], city: "Paris", maxAgeDays: 14, targets: [], contracts: ["alternance"] };
  const found = await importFromCatalogue(db, config);
  // 1: close, Paris, apprenticeship. 2: Lyon. 3: CDD not wanted. 4: too far from the CV.
  assert.deepEqual(found.offers.map((o) => o.url), ["https://x.test/1"]);
});
