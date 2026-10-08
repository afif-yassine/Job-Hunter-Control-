import assert from "node:assert/strict";
import { test } from "node:test";
import { freshnessText, interpretRefresh, refreshDecision } from "../components/catalogue-refresh";

test("the catalogue is asked once, only when the dashboard is ready and a CV is saved", () => {
  assert.equal(refreshDecision({ enabled: false, started: false, stored: null }), "wait");
  assert.equal(refreshDecision({ enabled: true, started: false, stored: null }), "call");
  assert.equal(refreshDecision({ enabled: true, started: true, stored: null }), "skip");
});

test("a check already made in this browser session is shown again, never repeated", () => {
  assert.equal(refreshDecision({ enabled: true, started: false, stored: "2026-10-08T08:00:00.000Z" }), "reuse");
  assert.equal(refreshDecision({ enabled: true, started: true, stored: "2026-10-08T08:00:00.000Z" }), "skip");
  assert.equal(refreshDecision({ enabled: false, started: false, stored: "2026-10-08T08:00:00.000Z" }), "wait");
});

test("a failure of any kind is silent: nothing checked, nothing reloaded", () => {
  assert.deepEqual(interpretRefresh(false, { error: "x" }), { checked: false, reload: false });
  assert.deepEqual(interpretRefresh(false, { code: "PROFILE_REQUIRED" }), { checked: false, reload: false });
  assert.deepEqual(interpretRefresh(true, null), { checked: false, reload: false });
  assert.deepEqual(interpretRefresh(true, "texte"), { checked: false, reload: false });
});

test("no job chosen is not a check and not an error", () => {
  assert.deepEqual(interpretRefresh(true, { inserted: 0, searched: false, code: "NO_SEARCH", message: "…" }), { checked: false, reload: false });
});

test("the list is reloaded only when offers were added", () => {
  assert.deepEqual(interpretRefresh(true, { inserted: 0, searched: true }), { checked: true, reload: false });
  assert.deepEqual(interpretRefresh(true, { inserted: 12, searched: true }), { checked: true, reload: true });
  assert.deepEqual(interpretRefresh(true, { inserted: "12", searched: true }), { checked: true, reload: false });
});

test("the home card states two separate facts and never promises an automatic update", () => {
  const ago = (iso: string) => `il y a (${iso})`;
  const both = freshnessText({ refreshedAt: "A", lastSearchAt: "B" }, ago);
  assert.equal(both, "Catalogue vérifié il y a (A). Dernière recherche de tes offres : il y a (B).");
  assert.equal(freshnessText({ refreshedAt: null, lastSearchAt: "B" }, ago), "Dernière recherche de tes offres : il y a (B).");
  assert.equal(freshnessText({ refreshedAt: null, lastSearchAt: null }, ago), "Pas encore de recherche.");
  assert.doesNotMatch(both, /automatique/i);
});
