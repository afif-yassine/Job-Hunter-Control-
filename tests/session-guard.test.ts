import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldReload } from "../components/session-guard";

const A = "user-a";
const B = "user-b";

test("a page reloads when the browser now acts as another account, whatever the event", () => {
  for (const event of ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION", "VISIBLE"])
    assert.equal(shouldReload({ event, startedAs: A, nowUserId: B }), true, event);
});

test("a page reloads on a sign-out", () => {
  assert.equal(shouldReload({ event: "SIGNED_OUT", startedAs: A, nowUserId: null }), true);
  assert.equal(shouldReload({ event: "SIGNED_OUT", startedAs: A, nowUserId: A }), true);
});

test("the same account never causes a reload: token refresh, initial event, user update, coming back to the tab", () => {
  for (const event of ["TOKEN_REFRESHED", "INITIAL_SESSION", "SIGNED_IN", "USER_UPDATED", "PASSWORD_RECOVERY", "VISIBLE"])
    assert.equal(shouldReload({ event, startedAs: A, nowUserId: A }), false, event);
});

test("a missing session without a sign-out is a transient state, not a reason to reload", () => {
  assert.equal(shouldReload({ event: "VISIBLE", startedAs: A, nowUserId: null }), false);
  assert.equal(shouldReload({ event: "TOKEN_REFRESHED", startedAs: A, nowUserId: null }), false);
  assert.equal(shouldReload({ event: "INITIAL_SESSION", startedAs: A, nowUserId: null }), false);
});

test("without a known starting account (demo, no client) nothing is compared and nothing reloads", () => {
  for (const event of ["SIGNED_OUT", "SIGNED_IN", "TOKEN_REFRESHED", "VISIBLE"]) {
    assert.equal(shouldReload({ event, startedAs: null, nowUserId: B }), false, event);
    assert.equal(shouldReload({ event, startedAs: "", nowUserId: B }), false, event);
  }
});
