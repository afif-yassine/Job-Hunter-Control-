import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_PASSWORD, passwordError, passwordProblem } from "../lib/auth-messages";

test("password rules: 8 to 72 characters, with a clear message", () => {
  assert.match(passwordProblem("court")!, new RegExp(String(MIN_PASSWORD)));
  assert.equal(passwordProblem("12345678"), null);
  assert.match(passwordProblem("x".repeat(73))!, /trop long/);
});

test("password errors from Supabase become French sentences, leaked passwords included", () => {
  assert.match(passwordError({ code: "weak_password", message: "Password is known to be weak and easy to guess" }), /fuite de données/);
  assert.match(passwordError({ status: 429, code: "over_email_send_rate_limit" }), /Attends une minute/);
  assert.match(passwordError({ code: "same_password" }), /différent/);
  assert.match(passwordError({ message: "boom" }), /Réessaie/);
});
