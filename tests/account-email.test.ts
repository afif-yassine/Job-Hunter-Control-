import assert from "node:assert/strict";
import { test } from "node:test";
import { shownEmail } from "../components/use-account";

test("the address read now from the account wins over the one of the token", () => {
  // After an address change the token still carries the old one.
  assert.equal(shownEmail({ email: "nouvelle@exemple.fr" }, "ancienne@exemple.fr"), "nouvelle@exemple.fr");
});

test("until the account is loaded, or when it cannot be read, the token address stays", () => {
  assert.equal(shownEmail(null, "token@exemple.fr"), "token@exemple.fr");
  assert.equal(shownEmail(undefined, "token@exemple.fr"), "token@exemple.fr");
  assert.equal(shownEmail({ email: "" }, "token@exemple.fr"), "token@exemple.fr");
  assert.equal(shownEmail({ email: "   " }, "token@exemple.fr"), "token@exemple.fr");
});

test("no address at all stays empty, never invented", () => {
  assert.equal(shownEmail(null, ""), "");
});
