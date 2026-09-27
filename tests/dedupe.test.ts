import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contractKind,
  descriptionSimilarity,
  fingerprintOf,
  fuzzyMatch,
  normalizeCompany,
  normalizeTitle,
  titleSimilarity,
} from "../lib/scan/dedupe";
import { ingestOffers } from "../lib/scan/ingest";
import { detectSuspicion } from "../lib/scan/suspicion";
import { fakeSupabase } from "./fake-supabase";

const LONG = `Au sein de l'équipe plateforme, tu participeras au développement de nos services backend en Python et FastAPI,
à la mise en place de pipelines de données sur PostgreSQL et Kafka, et à l'industrialisation de modèles de machine learning.
Tu travailleras avec les data scientists pour déployer des API robustes, écrire des tests, documenter et suivre la qualité.
Profil : école d'ingénieur, bases solides en Python, Docker, Git. Rythme : 3 semaines entreprise, 1 semaine école.`;

test("fingerprint ignores legal suffixes, H/F noise, contract words and arrondissement", () => {
  assert.equal(normalizeCompany("Capgemini SAS"), "capgemini");
  assert.equal(normalizeCompany("Groupe BPCE"), "bpce");
  assert.equal(normalizeTitle("Alternance - Développeur Java H/F (24 mois)"), "developpeur java");
  assert.equal(
    fingerprintOf({ company: "BPCE SA", title: "Alternance Développeur Java (H/F)", location: "75 - PARIS 13" }),
    fingerprintOf({ company: "Groupe BPCE", title: "Développeur Java - Alternance F/H", location: "Paris, Île-de-France" }),
  );
});

test("an internship and an apprenticeship with the same title stay two offers", () => {
  assert.equal(contractKind("Stage Data Engineer"), "stage");
  assert.equal(contractKind("Data Engineer", "Apprentissage"), "alternance");
  assert.notEqual(
    fingerprintOf({ company: "Acme", title: "Stage Data Engineer", location: "Paris" }),
    fingerprintOf({ company: "Acme", title: "Alternance Data Engineer", location: "Paris" }),
  );
  assert.equal(
    fuzzyMatch({ company: "Acme", title: "Stage Data Engineer", location: "Paris" }, [
      { id: "a", company: "Acme", title: "Alternance Data Engineer", location: "Paris" },
    ]),
    null,
  );
});

test("similar titles of the same company: same offer, probable duplicate, or different", () => {
  assert.ok(titleSimilarity("Développeur Backend Python", "Développeur back-end Python") > 0.6);
  const known = [{ id: "k1", company: "Doctolib", title: "Software Engineer Backend", location: "Paris", description: LONG }];
  // Same company, near-identical title → merged.
  assert.deepEqual(
    fuzzyMatch({ company: "Doctolib SAS", title: "Software Engineer - Backend (Alternance)", location: "Paris 10" }, known)?.kind,
    "same",
  );
  // Reworded title but the same description → merged.
  assert.equal(
    fuzzyMatch({ company: "Doctolib", title: "Backend Engineer Apprentice", location: "Paris", description: LONG }, [
      { ...known[0], title: "Apprenti Software Engineer Backend" },
    ])?.kind,
    "same",
  );
  // Close title, no description to compare → the user decides.
  assert.equal(
    fuzzyMatch({ company: "Doctolib", title: "Software Engineer Backend Java", location: "Lyon" }, known)?.kind,
    "probable",
  );
  // Another company → never matched.
  assert.equal(fuzzyMatch({ company: "Alan", title: "Software Engineer Backend", location: "Paris" }, known), null);
  // Unknown company → only the link can match.
  assert.equal(fuzzyMatch({ company: "À compléter", title: "Software Engineer Backend", location: "Paris" }, known), null);
});

test("description similarity needs enough text", () => {
  assert.equal(descriptionSimilarity("court", LONG), null);
  assert.ok((descriptionSimilarity(LONG, `${LONG}\nPostule vite !`) ?? 0) > 0.8);
});

test("scam signals: payment or parcels = high, one weak signal = low, normal offer = none", () => {
  assert.equal(
    detectSuspicion({ title: "Assistant logistique", description: "Mission : réceptionner des colis à domicile et les réexpédier." }).level,
    "high",
  );
  assert.equal(
    detectSuspicion({ title: "Stage", description: "Frais d'inscription de 150€ à la charge du candidat." }).level,
    "high",
  );
  assert.equal(
    detectSuspicion({ title: "Stage marketing", description: "Contact : recrutement.rapide@gmail.com ou WhatsApp." }).level,
    "high",
  );
  assert.equal(detectSuspicion({ title: "Stage", description: "Écris-nous sur WhatsApp." }).level, "low");
  assert.equal(
    detectSuspicion({ title: "Alternance développeur", description: "Rémunération : 6 000 € / mois." }).level,
    "low",
  );
  assert.equal(detectSuspicion({ title: "Alternance développeur Java", description: LONG }).level, "none");
});

test("ingest: one offer on three platforms = one offer, three links, scored once", async () => {
  const { db, tables } = fakeSupabase({ jobs: [], job_sources: [], applications: [] });
  const base = { contract_type: "Alternance", location: "Paris", publishedAt: null, description: LONG };
  const result = await ingestOffers(db, "u1", [
    { ...base, source: "jsearch:linkedin", company: "Doctolib", title: "Software Engineer Backend", url: "https://linkedin.com/jobs/view/9" },
    { ...base, source: "jsearch:indeed", company: "Doctolib SAS", title: "Software Engineer - Backend (H/F)", url: "https://fr.indeed.com/viewjob?jk=abc" },
    { ...base, source: "ats:greenhouse", company: "Doctolib", title: "Alternance Software Engineer Backend", url: "https://boards.greenhouse.io/doctolib/jobs/1" },
  ]);
  assert.equal(result.inserted, 1);
  assert.equal(result.duplicates, 2);
  assert.equal(tables.jobs.length, 1);
  const links = tables.job_sources.filter((s) => s.job_id === tables.jobs[0].id);
  assert.equal(links.length, 3);
});

test("ingest: an offer you already applied to elsewhere is never proposed again", async () => {
  const { db, tables } = fakeSupabase({
    jobs: [{ id: "old", user_id: "u1", company: "Alan", title: "Data Engineer", location: "Paris", contract_type: "Stage", status: "SUBMITTED", source_url: "https://jobs.lever.co/alan/1", official_url: null }],
    applications: [{ id: "a1", user_id: "u1", job_id: "old", status: "SUBMITTED" }],
    job_sources: [],
  });
  const base = { location: "Paris", publishedAt: null, description: null, contract_type: "Stage" };
  const result = await ingestOffers(db, "u1", [
    // Same offer on another platform → merged, counted as already applied.
    { ...base, source: "jsearch:welcometothejungle", company: "Alan", title: "Stage - Data Engineer (F/H)", url: "https://welcometothejungle.com/alan/data" },
    // Close but not certain → kept, labelled "déjà postulé".
    { ...base, source: "jsearch:indeed", company: "Alan", title: "Data Engineer Analytics", url: "https://indeed.com/x" },
  ]);
  assert.equal(result.alreadyApplied, 1);
  assert.equal(result.toReview, 1);
  const kept = tables.jobs.find((j) => j.id !== "old")!;
  assert.equal(kept.review_flag, "ALREADY_APPLIED");
  assert.equal(kept.duplicate_of, "old");
});

test("ingest: scams go to review, and the database without the migration still works", async () => {
  const offer = {
    source: "jooble",
    company: "Logistix",
    title: "Stage assistant",
    location: "Paris",
    contract_type: "Stage",
    publishedAt: null,
    url: "https://jooble.org/1",
    description: "Réceptionner des colis chez vous et les réexpédier. Contact WhatsApp.",
  };
  const migrated = fakeSupabase({ jobs: [], job_sources: [], applications: [] });
  const r1 = await ingestOffers(migrated.db, "u1", [offer]);
  assert.equal(r1.suspected, 1);
  assert.equal(migrated.tables.jobs[0].review_flag, "SUSPECTED");

  const old = fakeSupabase(
    { jobs: [], applications: [] },
    { missingTables: ["job_sources"], missingColumns: ["review_flag"] },
  );
  const r2 = await ingestOffers(old.db, "u1", [offer]);
  assert.equal(r2.inserted, 1);
  assert.equal(old.tables.jobs[0].review_flag, undefined);
});
