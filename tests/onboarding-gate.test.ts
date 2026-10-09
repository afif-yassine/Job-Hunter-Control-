import assert from "node:assert/strict";
import { test } from "node:test";
import { onboardingGate, ONBOARDING_TEXT, parseOnboardingStatus, readyText, stepLabel, type GateInput } from "../components/onboarding";

const base: GateInput = {
  demo: false,
  isAdmin: false,
  statusFailed: false,
  server: null,
  hasProfile: true,
  profileFailed: false,
  searchChosen: true,
  searchFailed: false,
};
const gate = (extra: Partial<GateInput>) => onboardingGate({ ...base, ...extra });

test("the demo and the administrator never see the journey", () => {
  assert.deepEqual(gate({ demo: true, hasProfile: false }), { kind: "open" });
  assert.deepEqual(gate({ isAdmin: true, hasProfile: false }), { kind: "open" });
});

test("while the account is not known the screen waits, and a failed status lets the student in", () => {
  assert.deepEqual(gate({ isAdmin: undefined }), { kind: "wait" });
  assert.deepEqual(gate({ isAdmin: undefined, statusFailed: true }), { kind: "open" });
});

test("with the server route: a CV not confirmed, then a search not chosen, then in", () => {
  const ok = { vector: "ready" as const };
  assert.deepEqual(gate({ server: { ...ok, profileConfirmed: false, searchChosen: false, ready: false } }), { kind: "step", step: "cv" });
  assert.deepEqual(gate({ server: { ...ok, profileConfirmed: true, searchChosen: false, ready: false } }), { kind: "step", step: "search" });
  assert.deepEqual(gate({ server: { ...ok, profileConfirmed: true, searchChosen: true, ready: true } }), { kind: "open" });
  assert.deepEqual(gate({ server: undefined }), { kind: "wait" });
});

test("without the server route the gate is deduced from the profile and the search", () => {
  assert.deepEqual(gate({ hasProfile: false }), { kind: "step", step: "cv" });
  assert.deepEqual(gate({ hasProfile: true, searchChosen: false }), { kind: "step", step: "search" });
  assert.deepEqual(gate({ hasProfile: true, searchChosen: true }), { kind: "open" });
});

test("an account with a CV but no job starts at the second step", () => {
  assert.deepEqual(gate({ hasProfile: true, searchChosen: false }), { kind: "step", step: "search" });
});

test("any failure to know lets the student in", () => {
  assert.deepEqual(gate({ hasProfile: undefined, profileFailed: true }), { kind: "open" });
  assert.deepEqual(gate({ hasProfile: true, searchChosen: undefined, searchFailed: true }), { kind: "open" });
  assert.deepEqual(gate({ hasProfile: undefined }), { kind: "wait" });
  assert.deepEqual(gate({ hasProfile: true, searchChosen: undefined }), { kind: "wait" });
});

test("the server answer is read strictly", () => {
  assert.deepEqual(parseOnboardingStatus({ profileConfirmed: true, searchChosen: false, vector: "pending", ready: false }), {
    profileConfirmed: true,
    searchChosen: false,
    vector: "pending",
    ready: false,
  });
  assert.equal(parseOnboardingStatus({ ready: true }), null);
  assert.equal(parseOnboardingStatus(null), null);
  assert.equal(parseOnboardingStatus({ profileConfirmed: "yes", searchChosen: true, ready: true }), null);
});

test("the screens are numbered and say plainly what is going on", () => {
  assert.equal(stepLabel("cv"), "Étape 1 sur 3 · Ton CV");
  assert.equal(stepLabel("ready"), "Étape 3 sur 3 · Ta première sélection");
  assert.match(readyText(8), /^8 offres choisies pour toi t’attendent\.$/);
  assert.equal(readyText(1), "1 offre choisie pour toi t’attend.");
  assert.match(readyText(0), /On prépare ta première sélection/);
  assert.match(readyText(null), /entrer dans ton espace/);
});

test("no step offers to skip, and none sells anything", () => {
  const all = JSON.stringify(ONBOARDING_TEXT) + readyText(3);
  assert.doesNotMatch(all, /passer|ignorer|€|\bPlus\b|\bPro\b|payant|catalogue/);
});
