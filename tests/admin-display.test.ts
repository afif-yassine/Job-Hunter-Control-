import assert from "node:assert/strict";
import { test } from "node:test";
import { gapText, gatewayReasonText, orDash, originText, spendTitle, UNKNOWN, unpricedText, usdFixed, vectorBarLabel, yesNoOrDash } from "../components/admin/admin-display";

test("an unknown number is a dash, never zero", () => {
  assert.equal(UNKNOWN, "—");
  assert.equal(orDash(null, String), "—");
  assert.equal(orDash(undefined, String), "—");
  assert.equal(orDash(Number.NaN, String), "—");
  assert.equal(orDash(0, (n) => `${n} $`), "0 $");
  assert.equal(orDash(12, (n) => `${n} $`), "12 $");
});

test("an unknown yes/no fact is a dash, never 'non'", () => {
  assert.equal(yesNoOrDash(null, "oui", "non"), "—");
  assert.equal(yesNoOrDash(undefined, "oui", "non"), "—");
  assert.equal(yesNoOrDash(true, "oui", "non"), "oui");
  assert.equal(yesNoOrDash(false, "oui", "non"), "non");
});

test("every origin is said in French, as the backend defines it", () => {
  assert.equal(originText("measured"), "mesuré");
  assert.equal(originText("measured_or_estimated"), "mesuré ou estimé, non distingué");
  assert.equal(originText("estimated"), "estimé");
  assert.equal(originText("assumption"), "hypothèse");
  assert.equal(originText(null), null);
  assert.equal(originText(undefined), null);
});

test("'réelle' is said only when every line is measured", () => {
  assert.equal(spendTitle(["measured", "measured"]), "Dépense réelle par modèle");
  assert.equal(spendTitle(["measured", "estimated"]), "Dépense par modèle");
  assert.equal(spendTitle(["measured_or_estimated"]), "Dépense par modèle");
  assert.equal(spendTitle([]), "Dépense par modèle");
});

test("an unknown balance or gap is a dash, never a zero", () => {
  assert.equal(usdFixed(null), "—");
  assert.equal(usdFixed(undefined), "—");
  assert.equal(usdFixed(0), "0,00 $");
  assert.equal(usdFixed(12.3), "12,30 $");
  assert.equal(gapText(null), "—");
  assert.equal(gapText(0), "0,00 $");
  assert.equal(gapText(0.5), "+0,50 $");
  assert.equal(gapText(-1.25), "-1,25 $");
});

test("each reason a balance cannot be read is said in French and is not a balance", () => {
  assert.match(gatewayReasonText("not_configured"), /pas configurée/);
  assert.match(gatewayReasonText("unauthorized"), /refusé/);
  assert.match(gatewayReasonText("unavailable"), /pas répondu/);
  for (const reason of ["not_configured", "unauthorized", "unavailable"] as const) assert.doesNotMatch(gatewayReasonText(reason), /\d/);
});

test("the catalogue bar names the column it counts", () => {
  assert.equal(vectorBarLabel("semantic_embedding"), "Vectorisées");
  assert.equal(vectorBarLabel("legacy_embedding"), "Ancienne colonne");
});

test("calls without a stored cost are counted, not priced", () => {
  assert.equal(unpricedText(0), null);
  assert.equal(unpricedText(-1), null);
  assert.equal(unpricedText(1), "1 appel sans coût enregistré : compté en appels et en jetons, pas en dollars.");
  assert.equal(unpricedText(7), "7 appels sans coût enregistré : comptés en appels et en jetons, pas en dollars.");
});
