import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage, isEmail, magicLinkError, safeNext } from "../lib/auth-messages";

test("safeNext keeps paths of this site and refuses other sites", () => {
  assert.equal(safeNext(null), "/");
  assert.equal(safeNext(""), "/");
  assert.equal(safeNext("/"), "/");
  assert.equal(safeNext("/?view=offres#top"), "/?view=offres#top");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("javascript:alert(1)"), "/");
  assert.equal(safeNext("/\tfoo"), "/");
  assert.equal(safeNext("evil.com"), "/");
});

test("only known error codes reach the page, as French text", () => {
  assert.equal(authErrorMessage(undefined), null);
  assert.match(authErrorMessage("link_expired") ?? "", /expiré/);
  assert.equal(authErrorMessage("<script>Ton compte est bloqué</script>"), authErrorMessage("unknown"));
});

test("e-mail check", () => {
  assert.equal(isEmail("lea@exemple.fr"), true);
  assert.equal(isEmail("lea@exemple"), false);
  assert.equal(isEmail("lea exemple.fr"), false);
});

test("Supabase OTP errors become French sentences", () => {
  assert.match(magicLinkError({ status: 429, message: "Email rate limit exceeded" }), /une minute/);
  assert.match(magicLinkError({ message: "For security purposes, you can only request this after 42 seconds." }), /une minute/);
  assert.match(magicLinkError({ code: "email_address_not_authorized", message: "Email address not authorized" }), /Google/);
  assert.match(magicLinkError({ message: "Signups not allowed for otp" }), /Google/);
  assert.match(magicLinkError({ message: "Unable to validate email address: invalid format" }), /valide/);
  assert.match(magicLinkError({ message: "boom" }), /Réessaie/);
});
