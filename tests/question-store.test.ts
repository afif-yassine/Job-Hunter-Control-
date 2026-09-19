import assert from "node:assert/strict";
import { test } from "node:test";
import { answerQuestion, queueQuestions } from "../lib/question-store";
import { fakeSupabase } from "./fake-supabase";

const U = "user-1";
const open = (id: string, application_id: string, question: string, extra = {}) => ({
  id, user_id: U, application_id, question, category: "legal", answer: null, blocking: true, approved: false, ...extra,
});

test("queueQuestions answers from memory and only blocks on new questions", async () => {
  const { db, tables } = fakeSupabase({
    profile_answers: [{ user_id: U, question_key: "nationalite", answer: "Marocaine" }],
    application_questions: [],
  });
  const result = await queueQuestions(db, U, "app-1", [
    { question: "Nationality", category: "legal" },
    { question: "Quelle est votre nationalité officielle ?", category: "legal" }, // duplicate on the same application
    { question: "Adresse postale : Quelle est votre adresse exacte ?", category: "personal_info" },
  ]);
  assert.deepEqual([result.asked, result.autoAnswered, result.duplicates], [1, 1, 1]);
  const rows = tables.application_questions;
  assert.equal(rows.length, 2);
  const nat = rows.find((r) => r.question_key === "nationalite")!;
  assert.deepEqual([nat.answer, nat.approved, nat.blocking, nat.auto_answered], ["Marocaine", true, false, true]);
  const adr = rows.find((r) => r.question_key === "adresse")!;
  assert.deepEqual([adr.answer, adr.approved, adr.blocking], [null, false, true]);
});

test("queueQuestions still works before the SQL migration is applied", async () => {
  const { db, tables } = fakeSupabase(
    { application_questions: [] },
    { missingTables: ["profile_answers"], missingColumns: ["question_key", "answer_type", "options", "auto_answered", "answered_at"] },
  );
  const result = await queueQuestions(db, U, "app-1", [{ question: "Nationalité ?", category: "legal" }]);
  assert.equal(result.asked, 1);
  assert.equal(tables.application_questions.length, 1);
  assert.equal("question_key" in tables.application_questions[0], false);
});

test("answering once fills every identical question and is remembered for later", async () => {
  const { db, tables } = fakeSupabase({
    application_questions: [
      open("q1", "app-alan", "Nationalité : Quelle est votre nationalité officielle ?"),
      open("q2", "app-2i", "Nationality"),
      open("q3", "app-2i", "Adresse postale : Quelle est votre adresse exacte ?"),
    ],
    profile_answers: [],
  });
  const outcome = await answerQuestion(db, U, "q1", { answer: "Marocaine", remember: true });
  assert.ok(outcome.ok && outcome.remembered && outcome.propagated === 1);
  const byId = Object.fromEntries(tables.application_questions.map((r) => [r.id, r]));
  assert.equal(byId.q2.answer, "Marocaine");
  assert.equal(byId.q2.approved, true);
  assert.equal(byId.q3.approved, false, "unrelated question stays open");
  assert.equal(tables.profile_answers.length, 1);

  // A brand new application later: the same question is not asked again.
  const later = await queueQuestions(db, U, "app-new", [{ question: "Quelle est votre nationalité ?", category: "legal" }]);
  assert.deepEqual([later.asked, later.autoAnswered], [0, 1]);
});

test("remember=false answers only that question", async () => {
  const { db, tables } = fakeSupabase({
    application_questions: [open("q1", "a", "Nationalité ?"), open("q2", "b", "Nationality")],
    profile_answers: [],
  });
  const outcome = await answerQuestion(db, U, "q1", { answer: "Française", remember: false });
  assert.ok(outcome.ok && !outcome.remembered && outcome.propagated === 0);
  assert.equal(tables.application_questions[1].approved, false);
  assert.equal(tables.profile_answers.length, 0);
});

test("without the profile_answers table the answer is saved and a warning explains why", async () => {
  const { db, tables } = fakeSupabase(
    { application_questions: [open("q1", "a", "Nationalité ?")] },
    { missingTables: ["profile_answers"] },
  );
  const outcome = await answerQuestion(db, U, "q1", { answer: "Française", remember: true });
  assert.ok(outcome.ok && !outcome.remembered && /migration/.test(outcome.warning ?? ""));
  assert.equal(tables.application_questions[0].approved, true);
});

test("a sensitive answer is only propagated onto identical options", async () => {
  const { db, tables } = fakeSupabase({
    application_questions: [
      open("q1", "a", "Situation particulière : handicap ou casier ?", { options: ["Oui", "Non", "Préfère ne pas répondre"] }),
      open("q2", "b", "Situation particulière : handicap ou casier ?", { options: ["Oui", "Non", "Ne souhaite pas répondre"] }),
    ],
    profile_answers: [],
  });
  const outcome = await answerQuestion(db, U, "q1", { answer: "Préfère ne pas répondre", remember: true });
  assert.ok(outcome.ok && outcome.propagated === 0);
  assert.equal(tables.application_questions[1].approved, false);
});
