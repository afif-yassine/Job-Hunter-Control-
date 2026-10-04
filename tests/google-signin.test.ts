import { test } from "node:test";
import assert from "node:assert/strict";
import { googleSignInEnabled } from "../lib/google-signin";

test("Google sign-in stays off unless explicitly enabled", () => {
  assert.equal(googleSignInEnabled({}), false);
  assert.equal(googleSignInEnabled({ NEXT_PUBLIC_GOOGLE_SIGNIN: "0" }), false);
  assert.equal(googleSignInEnabled({ NEXT_PUBLIC_GOOGLE_SIGNIN: "true" }), false);
  assert.equal(googleSignInEnabled({ NEXT_PUBLIC_GOOGLE_SIGNIN: "1" }), true);
});
