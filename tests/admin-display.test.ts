import assert from "node:assert/strict";
import { test } from "node:test";
import { orDash, originText, spendTitle, UNKNOWN, unpricedText, vectorBarLabel, yesNoOrDash } from "../components/admin/admin-display";

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
