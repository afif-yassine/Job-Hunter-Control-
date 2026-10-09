import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCKED_NOTE, monthFullNote } from "../components/panel-notes";

const FORBIDDEN = /€|\bPlus\b|\bPro\b|payant|prix|abonn|débloque|illimité|garanti|exclusi|partenaire|bientôt|décroche/i;

test("an offer outside the selection is told exactly as the business judgment wrote it", () => {
  assert.equal(LOCKED_NOTE.title, "Cette offre n’est pas dans ta sélection");
  assert.equal(LOCKED_NOTE.text, "Tu peux la lire et ouvrir l’annonce sur son site. Les dossiers se préparent sur les offres de ta sélection et sur celles que tu ajoutes toi-même.");
  assert.equal(LOCKED_NOTE.action, "Voir l’annonce");
});

test("the used kits are told with the calculated date and no price, no offer to pay", () => {
  const note = monthFullNote(2, "1er novembre");
  assert.equal(note.title, "Tes 2 dossiers du mois sont utilisés");
  assert.equal(note.text, "Les prochains arrivent le 1er novembre. D’ici là, tu peux toujours garder et suivre tes offres, et modifier tes dossiers.");
  assert.doesNotMatch(note.text, /chercher/);
  assert.equal(monthFullNote(1, "1er décembre").title, "Ton dossier du mois est utilisé");
});

test("none of these notes sells anything or promises what is forbidden", () => {
  const all = [LOCKED_NOTE.title, LOCKED_NOTE.text, LOCKED_NOTE.action, monthFullNote(2, "1er novembre").title, monthFullNote(2, "1er novembre").text].join(" ");
  assert.doesNotMatch(all, FORBIDDEN);
});
