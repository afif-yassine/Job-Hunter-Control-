import assert from "node:assert/strict";
import { test } from "node:test";
import { lastKitBlock, LOCKED_NOTE, monthBanner, monthFullNote, monthWindow } from "../components/panel-notes";

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

test("the Plus window, the last-kit block and the banner say what the plan wrote", () => {
  const w = monthWindow(2, "1er novembre", 30, 20);
  assert.equal(w.title, "Tes 2 dossiers du mois sont utilisés");
  assert.equal(w.text, "Les 2 prochains arrivent le 1er novembre. Avec LeBonTaf Plus : 30 dossiers par mois et jusqu’à 20 offres par jour. Le paiement n’est pas encore ouvert, tu peux demander l’accès anticipé.");
  assert.equal(w.stay, "Attendre le 1er novembre");
  assert.deepEqual(lastKitBlock(30), { title: "Il te reste 1 dossier ce mois-ci", text: "Garde-le pour l’offre qui compte le plus. Avec LeBonTaf Plus : 30 dossiers par mois." });
  assert.deepEqual(monthBanner(2, "1er novembre"), { title: "Tes 2 dossiers du mois sont utilisés", text: "Prochains dossiers le 1er novembre. Tu peux toujours suivre tes offres et modifier tes dossiers." });
  const all = [w.title, w.text, w.stay, lastKitBlock(30).text, monthBanner(2, "1er novembre").text].join(" ");
  assert.doesNotMatch(all, /illimité|garanti|exclusi|dernière chance|plus que|expire|décroche/i);
});

test("none of these notes sells anything or promises what is forbidden", () => {
  const all = [LOCKED_NOTE.title, LOCKED_NOTE.text, LOCKED_NOTE.action, monthFullNote(2, "1er novembre").title, monthFullNote(2, "1er novembre").text].join(" ");
  assert.doesNotMatch(all, FORBIDDEN);
});
