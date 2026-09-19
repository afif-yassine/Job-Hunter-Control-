import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyQuestion, matchOption, reuseAnswer } from "../lib/questions";

test("the questions blocking the dashboard map to stable keys", () => {
  const key = (question: string, category = "") => classifyQuestion({ question, category }).key;
  assert.equal(key("Situation particulière : Souhaitez-vous mentionner un statut de handicap ou des éléments relatifs au casier judiciaire ?"), "situation_particuliere");
  assert.equal(key("Identifiants et titre de séjour : Quels sont le statut, le type exact et la date d'expiration de votre titre de séjour couvrant la période du stage en 2027 ?"), "titre_sejour");
  assert.equal(key("Adresse postale : Quelle est votre adresse postale exacte à Paris / Île-de-France ?"), "adresse");
  assert.equal(key("Validation institutionnelle : L'établissement ESTIAM Paris répond-il aux exigences exactes de convention de stage ?"), "convention_ecole");
});

test("same meaning, different wording → same key (asked only once)", () => {
  const a = classifyQuestion({ question: "Nationalité : Quelle est votre nationalité officielle ?" }).key;
  assert.equal(a, classifyQuestion({ question: "Nationality" }).key);
  assert.equal(a, classifyQuestion({ question: "What is your citizenship?" }).key);
});

test("CAPTCHA / unknown fields are acknowledgements, never remembered", () => {
  const s = classifyQuestion({ question: "Intervention humaine requise: captcha", category: "HUMAN_VERIFICATION" });
  assert.equal(s.type, "ack");
  assert.equal(s.remember, false);
});

test("offer-specific and legal declarations are not remembered by default", () => {
  assert.equal(classifyQuestion({ question: "Pourquoi voulez-vous rejoindre notre entreprise ?" }).remember, false);
  assert.equal(classifyQuestion({ question: "J'accepte les conditions générales" }).remember, false);
});

test("remembered select answers are mapped onto the form's own options", () => {
  const spec = classifyQuestion({ question: "Niveau d'anglais", options: ["B1", "B2", "C1"] });
  assert.equal(reuseAnswer(spec, { question_key: spec.key, answer: "B2" }), "B2");
});

test("a sensitive answer is never guessed onto a different option", () => {
  const spec = classifyQuestion({ question: "Situation particulière", options: ["Oui", "Non", "Préfère ne pas répondre"] });
  assert.equal(reuseAnswer(spec, { question_key: spec.key, answer: "Non concerné(e)" }), null);
  assert.equal(matchOption("Non concerné(e)", ["Oui", "Non"]), null);
});

test("an expired answer (residence permit) is asked again", () => {
  const spec = classifyQuestion({ question: "Titre de séjour ?" });
  const stored = { question_key: spec.key, answer: "Carte étudiant", expires_at: "2026-01-01" };
  assert.equal(reuseAnswer(spec, stored, new Date("2026-09-20")), null);
  assert.equal(reuseAnswer(spec, { ...stored, expires_at: "2027-06-01" }, new Date("2026-09-20")), "Carte étudiant");
});
