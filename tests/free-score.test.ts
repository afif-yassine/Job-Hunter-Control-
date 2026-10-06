import assert from "node:assert/strict";
import { test } from "node:test";
import { displayScore, fitScore } from "../lib/fit";
import { parseCard, readPendingOffers, readerPrompt } from "../lib/offer-reader";
import { normalizeSkill, normalizeSkills, profileSkills } from "../lib/skills";
import { fakeSupabase } from "./fake-supabase";

test("skills: one comparable form for the offer and the CV", () => {
  assert.equal(normalizeSkill(" React.JS "), "react");
  assert.equal(normalizeSkill("ReactJS"), "react");
  assert.equal(normalizeSkill("Node.js"), "node");
  assert.equal(normalizeSkill("Microsoft Excel"), "excel");
  assert.equal(normalizeSkill("Gestion de projets"), "gestion de projet");
  assert.equal(normalizeSkill("Comptabilité"), "comptabilite");
  assert.equal(normalizeSkill("DevOps"), "devops");
  assert.equal(normalizeSkill("AWS"), "aws");
  assert.deepEqual(normalizeSkills(["SQL", "sql", "", 3, "Python (avancé)"]), ["sql", "python"]);
  const cv = profileSkills({
    skills: { data: ["SQL", "Power BI"] },
    experience: [{ technologies: ["Python", "Docker"] }],
    projects: [{ technologies: ["React.js"] }],
    languages: [{ language: "Anglais" }],
  });
  assert.deepEqual(cv, ["sql", "powerbi", "python", "docker", "react", "anglais"]);
});

test("free score: meaning and skills in common, no AI; the AI's detailed score wins when there is one", () => {
  const strong = fitScore(0.8, ["python", "sql", "docker"], [])!;
  const weak = fitScore(0.5, [], ["comptabilite", "sage", "excel"])!;
  assert.ok(strong.score >= 90, `strong ${strong.score}`);
  assert.ok(weak.score <= 5, `weak ${weak.score}`);
  const mid = fitScore(0.65, ["python"], ["java"])!;
  assert.ok(mid.score > weak.score && mid.score < strong.score);
  // Only one of the two signals: still a score.
  assert.ok(fitScore(null, ["excel"], ["sage"])!.score > 0);
  assert.ok(fitScore(0.7)!.score > 0);
  assert.equal(fitScore(null), null);
  // A long wish list does not sink a good match.
  assert.ok(fitScore(0.75, ["a", "b", "c", "d", "e", "f"], ["g", "h", "i", "j", "k", "l"])!.score >= 85);
  assert.deepEqual(displayScore({ match_score: 72, fit: strong }), { score: 72, detailed: true });
  assert.deepEqual(displayScore({ match_score: null, fit: mid }), { score: mid.score, detailed: false });
  assert.equal(displayScore({ match_score: null, fit: null }), null);
});

test("shared reader: card parsed and normalized, nothing invented", () => {
  const card = parseCard(
    JSON.stringify({
      missions: ["Développer l'API", "Écrire les tests", "Suivre la prod", "Une quatrième"],
      stack: ["Python", "PostgreSQL"],
      conditions: "Alternance 12 mois, Paris, 2 j de télétravail",
      skills: ["Python", "PostgreSQL", "Anglais", "python"],
      level: "Bac+5",
      remote: "partiel",
    }),
  )!;
  assert.equal(card.missions?.length, 3);
  assert.deepEqual(card.skills, ["python", "postgresql", "anglais"]);
  assert.equal(card.level, "bac+5");
  assert.equal(card.remote, "partiel");
  assert.equal(parseCard("pas du json"), null);
  assert.equal(parseCard(JSON.stringify({ level: "master", remote: "souvent" }))!.level, null);
  assert.match(readerPrompt({ title: "Dev", description: "x".repeat(9000) }), /n'invente rien/);
  assert.ok(readerPrompt({ title: "Dev", description: "x".repeat(9000) }).length < 7000);
});

test("shared reader: database failures are reported instead of looking like an empty queue", async () => {
  const { db } = fakeSupabase({}, { missingTables: ["offers"] });
  await assert.rejects(readPendingOffers(db, { ai: async () => ({ text: "{}", model: "test" }) }), /Lecture du catalogue impossible/);
});

test("shared reader: each offer read once, newest first, platform cost recorded, short texts skipped", async () => {
  const offers = [
    { id: "a", title: "Dev Python", status: "open", summary: null, description: "Développer des services Python et SQL ".repeat(5), first_seen_at: "2026-10-06" },
    { id: "b", title: "Comptable", status: "open", summary: null, description: "trop court", first_seen_at: "2026-10-06" },
    { id: "c", title: "Déjà lue", status: "open", summary: { missions: [] }, description: "x".repeat(300), first_seen_at: "2026-10-06" },
  ];
  const { db, tables } = fakeSupabase({ offers, ai_usage: [] });
  let calls = 0;
  const ai = async () => {
    calls += 1;
    return { text: JSON.stringify({ missions: ["Coder"], stack: ["Python"], conditions: "", skills: ["Python", "SQL"], level: null, remote: null }), model: "gemini-2.5-flash-lite", usage: { input: 1200, output: 300 } };
  };
  const r = await readPendingOffers(db, { ai, env: {} });
  assert.deepEqual(r, { read: 1, failed: 0 });
  assert.equal(calls, 1);
  assert.deepEqual((tables.offers[0].summary as { skills: string[] }).skills, ["python", "sql"]);
  assert.equal(tables.ai_usage.length, 1);
  assert.equal(tables.ai_usage[0].user_id, null);
  assert.ok(Number(tables.ai_usage[0].cost_usd) > 0);
  // Second round: nothing left to read.
  assert.deepEqual(await readPendingOffers(db, { ai, env: {} }), { read: 0, failed: 0 });
  assert.equal(calls, 1);
});
