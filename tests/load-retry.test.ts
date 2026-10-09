import assert from "node:assert/strict";
import { test } from "node:test";
import { CONNECTION_TEXT, isClockSkew, loadErrorText, MAX_RETRIES, retryDecision } from "../components/load-retry";

const skew = { message: "JWT issued at future", code: "PGRST301" };

test("the future-dated token is recognised by its message or its code, and nothing else is", () => {
  assert.equal(isClockSkew(skew), true);
  assert.equal(isClockSkew({ message: "JWT issued at future" }), true);
  assert.equal(isClockSkew({ message: "x", code: "PGRST301" }), true);
  assert.equal(isClockSkew({ message: 'relation "jobs" does not exist', code: "42P01" }), false);
  assert.equal(isClockSkew({ message: "JWT expired", code: "PGRST303" }), true);
  assert.equal(isClockSkew(null), false);
  assert.equal(isClockSkew(undefined), false);
});

test("it waits 2 s and asks again, twice at most, and only for this error", () => {
  assert.deepEqual(retryDecision(skew, 0), { retry: true, delayMs: 2000 });
  assert.deepEqual(retryDecision(skew, 1), { retry: true, delayMs: 2000 });
  assert.equal(retryDecision(skew, MAX_RETRIES).retry, false);
  assert.equal(retryDecision({ message: "boom" }, 0).retry, false);
  assert.equal(retryDecision(null, 0).retry, false);
});

test("a student never reads 'JWT'; the administrator keeps the raw message", () => {
  const student = loadErrorText("JWT issued at future", "student");
  assert.equal(student.title, "Connexion à tes données impossible pour l’instant");
  assert.equal(student.hint, "Recharge la page dans un instant. Si ça continue, vérifie que l’heure de ton appareil est réglée automatiquement.");
  assert.doesNotMatch(`${student.title} ${student.hint}`, /JWT|PGRST|supabase/i);
  assert.equal(CONNECTION_TEXT.retry, "Réessayer");
  assert.deepEqual(loadErrorText("JWT issued at future", "admin"), { title: "Impossible de charger les données", hint: "JWT issued at future" });
});

test("another technical failure is neutral for a student, never the platform's words", () => {
  const other = loadErrorText("TypeError: fetch failed at supabase", "student");
  assert.doesNotMatch(`${other.title} ${other.hint}`, /TypeError|supabase|fetch/i);
});
