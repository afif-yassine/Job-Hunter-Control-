import assert from "node:assert/strict";
import { test } from "node:test";
import { categoriesFailedMessage, CV_SAVED_NOTE, profileCardLines, profileSavedMessage, readCounts } from "../components/profile-card";
import type { ProfileSummary } from "../lib/profile-store";

const summary: ProfileSummary = {
  full_name: "Yassine",
  updated_at: "2026-10-08T08:00:00.000Z",
  experience: 3,
  education: 1,
  projects: 2,
  skills: 24,
  languages: 2,
  source: "CV_Yassine.pdf",
};
const ago = (iso: string) => `il y a (${iso})`;

test("a saved CV shows its file, when it was updated and what was read", () => {
  assert.deepEqual(profileCardLines(summary, ago), [
    "CV importé : « CV_Yassine.pdf »",
    "Mis à jour il y a (2026-10-08T08:00:00.000Z).",
    "Ce qui a été lu : 3 expériences · 1 formation · 24 compétences.",
  ]);
});

test("the plural follows the number, and a part that was not read is left out", () => {
  assert.equal(readCounts({ experience: 1, education: 2, skills: 1 }), "1 expérience · 2 formations · 1 compétence");
  assert.equal(readCounts({ experience: 0, education: 0, skills: 5 }), "5 compétences");
  assert.equal(readCounts({ experience: 0, education: 0, skills: 0 }), null);
});

test("an unknown file or date is never invented", () => {
  assert.deepEqual(profileCardLines({ ...summary, source: null, updated_at: null, experience: 0, education: 0, skills: 0 }, ago), ["CV enregistré"]);
  assert.equal(profileCardLines({ ...summary, source: null }, ago)[0], "CV enregistré");
});

test("the confirmation after a saved profile says what happened to the suggested jobs", () => {
  assert.equal(profileSavedMessage({ picked: 0, imported: 0 }), "Profil enregistré : tes prochains CV et lettres partiront de lui.");
  assert.equal(profileSavedMessage({ picked: 3, imported: 0 }), "Profil enregistré. 3 métier(s) coché(s).");
  assert.equal(profileSavedMessage({ picked: 3, imported: 12 }), "Profil enregistré. 3 métier(s) coché(s), 12 offre(s) ajoutée(s) tout de suite.");
});

test("when the jobs could not be ticked, the profile is still said saved and the student is told where to choose them", () => {
  const message = categoriesFailedMessage();
  assert.match(message, /^Profil enregistré\./);
  assert.match(message, /n’ont pas pu être cochés/);
  assert.match(message, /2 · Ce que tu cherches/);
  // No technical cause is shown to the student.
  assert.doesNotMatch(message, /HTTP|fetch|Error|undefined/i);
});

test("the reassurance sentence says the CV does not need to be uploaded again", () => {
  assert.match(CV_SAVED_NOTE, /pas besoin de le déposer à nouveau/);
  assert.match(CV_SAVED_NOTE, /sauf pour le remplacer/);
});
