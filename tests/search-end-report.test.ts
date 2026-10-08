import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyReport, noSearchOf, summarize } from "../lib/pipeline-client";

test("an account that chose no job gets the server's own sentence, not '0 nouvelle offre'", () => {
  const sentence = "Choisis tes métiers pour lancer la recherche.";
  assert.equal(noSearchOf({ noSearch: true, message: sentence, found: 0 }), sentence);
  const report = { ...emptyReport(), scanned: true, noSearch: sentence };
  assert.equal(summarize(report), sentence);
  assert.doesNotMatch(summarize(report), /nouvelle/);
});

test("the sentence comes from the server: another wording is shown as it is", () => {
  assert.equal(noSearchOf({ noSearch: true, message: "Autre phrase du serveur." }), "Autre phrase du serveur.");
});

test("a generic fallback only applies when the server sent no sentence", () => {
  const fallback = "Aucune recherche n’a été lancée : aucun métier n’est choisi.";
  assert.equal(noSearchOf({ noSearch: true }), fallback);
  assert.equal(noSearchOf({ noSearch: true, message: "   " }), fallback);
  assert.equal(noSearchOf({ noSearch: true, message: 42 }), fallback);
});

test("a normal search is untouched: no flag, the usual summary", () => {
  assert.equal(noSearchOf({ message: "Scan terminé : 3 offre(s)…", found: 3 }), null);
  assert.equal(noSearchOf({ noSearch: false, message: "x" }), null);
  assert.equal(emptyReport().noSearch, null);
  assert.equal(summarize({ ...emptyReport(), scanned: true, inserted: 2 }), "2 nouvelles offres");
  assert.equal(summarize({ ...emptyReport(), scanned: true, inserted: 0 }), "0 nouvelle offre");
});

test("no connected source keeps its own message", () => {
  assert.match(summarize({ ...emptyReport(), noSource: true }), /Aucune source d’offres n’est connectée/);
});
