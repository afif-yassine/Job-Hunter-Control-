import assert from "node:assert/strict";
import { test } from "node:test";
import { displayScore, fitScore } from "../lib/fit";
import { parseCard, readPendingOffers, readerPrompt } from "../lib/offer-reader";
import { isGenericQuality, normalizeSkill, normalizeSkills, profileSkills } from "../lib/skills";
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

test("free score is a comparison of skills, never a probability of being hired: coverage stays exact outside the calibrated space", () => {
  const technical = ["python", "sql", "docker", "git", "linux", "java", "c#", "aws"];
  const noise = ["autonomie", "rigueur", "curiosite", "ecoute"];
  const model = "perplexity-pplx-embed";
  // 12 asked skills of which 4 are personal qualities: the denominator is 8, not 12.
  assert.equal(fitScore(0.9, technical.slice(0, 2), [...technical.slice(2), ...noise], model)!.score, 25);
  assert.equal(fitScore(null, technical.slice(0, 2), [...technical.slice(2), ...noise], "skills-v1")!.score, 25);
  // Without the noise it is the same: removing qualities never raises a real gap.
  assert.equal(fitScore(null, technical.slice(0, 2), technical.slice(2), "skills-v1")!.score, 25);
  // No cap: 6 proven of 12 technical skills stays 50, and nothing proven stays 0.
  const twelve = [...technical, "azure", "react", "node", "typescript"];
  assert.equal(fitScore(null, twelve.slice(0, 6), twelve.slice(6), "skills-v1")!.score, 50);
  assert.equal(fitScore(null, [], twelve, "skills-v1")!.score, 0);
});

test("personal qualities neither count nor show as gaps; technical terms stay, even rare ones", () => {
  const qualities = ["autonomie", "Curiosité", "écoute", "rigueur", "motivation", "dynamisme", "esprit d'équipe", "communication", "adaptabilité", "organisation", "résolution de problèmes", "apprentissage"];
  assert.ok(qualities.every(isGenericQuality));
  assert.ok(!["gestion de projet", "optimisation des processus", "activites commerciales", "administratif", "wsn", "v2x", "sdn"].some(isGenericQuality));
  const fit = fitScore(null, ["python"], [...qualities, "sql", "wsn"], "skills-v1")!;
  assert.deepEqual(fit.missing, ["sql", "wsn"]);
  assert.deepEqual(fit.matched, ["python"]);
  assert.equal(fit.score, 33);
  // Only qualities asked: no skills signal, so no invented score.
  assert.equal(fitScore(null, [], qualities, "skills-v1"), null);
  assert.equal(fitScore(0.7, [], qualities)!.similarity, 0.7);
});

test("AI and data skills use one safe form on both sides, without wide equivalences", () => {
  assert.equal(normalizeSkill("ML"), "machine learning");
  assert.equal(normalizeSkill("Apprentissage automatique"), "machine learning");
  assert.equal(normalizeSkill("Apprentissage profond"), "deep learning");
  assert.equal(normalizeSkill("DL"), "deep learning");
  assert.equal(normalizeSkill("GenAI"), "ia generative");
  assert.equal(normalizeSkill("Generative AI"), "ia generative");
  assert.equal(normalizeSkill("IA générative"), "ia generative");
  assert.equal(normalizeSkill("Intelligence artificielle"), "ia");
  assert.equal(normalizeSkill("Torch"), "pytorch");
  // A purely numeric version tail is dropped, so "Java 17/21" meets an offer asking for "Java".
  for (const [raw, expected] of [["Java 17/21", "java"], ["Python 3.12", "python"], ["Spring Boot 3", "spring boot"], ["Node.js 20", "node"], ["Angular 17", "angular"], ["Java 8+", "java"], ["Python (3.12)", "python"]])
    assert.equal(normalizeSkill(raw), expected, raw);
  // A number that is part of the name stays.
  for (const name of ["C++", "ES6", "S3", "K8s", "Web3", "Web 3", "Industrie 4.0", "Kimi k2.5", "3D", "Python3", "Office 365"])
    assert.equal(normalizeSkill(name), normalizeSkill(name.toLowerCase()), name);
  assert.equal(normalizeSkill("K8s"), "kubernetes");
  assert.equal(normalizeSkill("Kimi k2.5"), "kimi k2 5");
  assert.equal(normalizeSkill("Industrie 4.0"), "industrie 4 0");
  assert.equal(normalizeSkill("Web 3"), "web 3");
  assert.equal(normalizeSkill("3D"), "3d");
  assert.equal(normalizeSkill("S3"), "s3");
  assert.equal(normalizeSkill("C++"), "c++");
  assert.notEqual(normalizeSkill("Java 17"), normalizeSkill("JavaScript"));
  // Standards and levels: the number is the identity, two of them never match.
  const different: [string, string][] = [["ISO 27001", "ISO 9001"], ["ISO/IEC 27001", "ISO/IEC 9001"], ["Bac 5", "Bac 2"], ["Bac+5", "Bac+3"], ["Niveau 7", "Niveau 6"], ["IEEE 802.11", "IEEE 802.3"], ["PCI DSS 4", "PCI DSS 3"], ["OWASP Top 10", "OWASP Top 5"], ["AS 9100", "AS 9120"], ["DO 178", "DO 254"]];
  for (const [a, b] of different) assert.notEqual(normalizeSkill(a), normalizeSkill(b), `${a} / ${b}`);
  assert.equal(normalizeSkill("ISO 27001"), "iso 27001");
  // Coherent on both sides: a versioned product still meets its plain name.
  assert.equal(normalizeSkill("Windows Server 2019"), normalizeSkill("Windows Server"));
  assert.equal(normalizeSkill("Excel 2019"), "excel");
  // Neighbouring skills are not merged: a TensorFlow CV does not prove PyTorch.
  assert.notEqual(normalizeSkill("TensorFlow"), normalizeSkill("PyTorch"));
  assert.notEqual(normalizeSkill("Machine learning"), normalizeSkill("Deep learning"));
});

test("the shared reader asks for technical skills, not personal qualities", () => {
  assert.match(readerPrompt({ title: "Dev", description: "x" }), /sans qualités personnelles/);
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

test("shared reader: provider outages preserve the cause instead of reporting unreadable offers", async () => {
  const { AiUnavailable } = await import("../lib/ai");
  const { db } = fakeSupabase({ offers: [{ id: "a", status: "open", summary: null, description: "x".repeat(150) }] });
  await assert.rejects(readPendingOffers(db, {
    ai: async () => { throw new AiUnavailable(new Error("Model unavailable")); },
  }), /momentanément indisponible/);
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
