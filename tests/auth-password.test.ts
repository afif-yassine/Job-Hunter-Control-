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

test("an address that already has an account gets a clear message (owner chose clarity over enumeration protection, 2026-10-07)", () => {
  assert.match(passwordError({ code: "user_already_exists" }), /compte existe déjà/);
  assert.match(passwordError({ code: "email_exists" }), /compte existe déjà/);
  assert.match(passwordError({ message: "User already registered" }), /compte existe déjà/);
});
