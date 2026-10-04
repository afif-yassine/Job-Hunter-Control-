import assert from "node:assert/strict";
import { test } from "node:test";
import { importProblems, normalizeImported, suggestCategories } from "../lib/profile-import";
import { profileSummary, saveImportedProfile } from "../lib/profile-store";
import { fakeSupabase } from "./fake-supabase";

const RAW = {
  identity: { full_name: " Sara Martin ", email: "sara@example.com", phone: "06 00 00 00 00", location: "Paris", linkedin_url: "linkedin.com/in/sara", github_url: "pas un lien", portfolio_url: null },
  skills: { langages: ["Python", "TypeScript", "Python"], devops: ["Docker", "Kubernetes"], vide: [] },
  languages: ["Français (natif)", "Anglais (B2)"],
  education: [{ degree: "BUT Informatique", institution: "IUT de Paris", start: "2023", end: "2026" }, { degree: "" }],
  experience: [
    { title: "Stagiaire développeur web", organization: "Acme", start: "2025-04", end: "2025-07", facts: ["API REST en Node.js"], technologies: ["Node.js", "React"] },
    { title: "", organization: "" },
  ],
  projects: [{ name: "Chatbot RAG", technologies: ["Python", "LLM"], description: "Projet de fin d’année" }],
  unknown: "ignored",
};

test("CV import: the model's answer is cleaned (links, e-mail, empty rows, duplicates) and checked", () => {
  const p = normalizeImported(RAW);
  assert.equal(p.identity.full_name, "Sara Martin");
  assert.equal(p.identity.linkedin_url, "https://linkedin.com/in/sara");
  assert.equal(p.identity.github_url, null);
  assert.deepEqual(p.profile.skills, { langages: ["Python", "TypeScript"], devops: ["Docker", "Kubernetes"] });
  assert.equal(p.profile.education.length, 1);
  assert.equal(p.profile.experience.length, 1);
  assert.deepEqual(importProblems(p), []);
  assert.deepEqual(importProblems(normalizeImported({})), [
    "Nom introuvable dans le CV.",
    "Aucune expérience, formation ou projet lu : le PDF est peut-être une image scannée.",
  ]);
  const suggested = suggestCategories(p);
  assert.ok(suggested.includes("web") && suggested.includes("devops") && suggested.includes("data"), suggested.join(","));
});

test("CV import saved: identity + facts replace the old ones, search target and truth rules kept", async () => {
  const { db, tables } = fakeSupabase({
    candidate_profiles: [
      { user_id: "u1", full_name: "Old", profile: { target: { contracts: ["alternance"] }, experience: [] }, truth_ledger: { rule: "mine" }, source_files: [{ name: "old.json" }] },
    ],
  });
  const draft = normalizeImported(RAW);
  assert.deepEqual(await saveImportedProfile(db, "u1", draft, "cv.pdf"), {});
  const row = tables.candidate_profiles[0] as Record<string, unknown>;
  assert.equal(row.full_name, "Sara Martin");
  assert.deepEqual((row.profile as { target: unknown }).target, { contracts: ["alternance"] });
  assert.deepEqual(row.truth_ledger, { rule: "mine" });
  assert.deepEqual((row.source_files as { name: string }[]).map((f) => f.name), ["old.json", "cv.pdf"]);
  const summary = await profileSummary(db, "u1");
  assert.equal(summary?.experience, 1);
  assert.equal(summary?.skills, 4);
  // A new account gets the default truth rules.
  const fresh = fakeSupabase({ candidate_profiles: [] });
  await saveImportedProfile(fresh.db, "u2", draft, null);
  assert.match(String((fresh.tables.candidate_profiles[0].truth_ledger as { rule: string }).rule), /Ne jamais inventer/);
  assert.equal((await saveImportedProfile(fresh.db, "u2", normalizeImported({}), null)).error, "Le nom est obligatoire.");
});
