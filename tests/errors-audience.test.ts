import assert from "node:assert/strict";
import { test } from "node:test";
import { explainError, NEUTRAL_ERROR } from "../lib/errors";

const worker = "Worker Playwright injoignable (fetch failed)";
const gemini = "Gemini n'a pas pu répondre (GEMINI_API_KEY manquante)";

test("the administrator still reads the technical cause", () => {
  assert.match(explainError(worker)!.title, /worker Playwright/);
  assert.match(explainError(worker, "admin")!.hint ?? "", /Railway/);
  assert.match(explainError(gemini, "admin")!.title, /Gemini/);
});

test("a student gets one neutral sentence for causes on the platform side", () => {
  for (const raw of [worker, gemini, "Executable doesn't exist at /ms-playwright", "Unauthorized", "Embeddings Gateway : HTTP 503", "Connexion impossible : fetch failed"])
    assert.deepEqual(explainError(raw, "student"), NEUTRAL_ERROR, raw);
  assert.doesNotMatch(`${NEUTRAL_ERROR.title} ${NEUTRAL_ERROR.hint}`, /railway|vercel|playwright|gemini/i);
});

test("a student keeps the messages that help: timeouts, missing links and our own sentences", () => {
  assert.match(explainError("timeout of 15000ms exceeded", "student")!.title, /trop de temps/);
  assert.match(explainError("A public HTTPS application URL is required", "student")!.title, /lien de candidature/);
  const own = "Offre gratuite : 2 dossiers (CV + lettre) par mois, déjà utilisés.";
  assert.equal(explainError(own, "student")!.title, own);
  assert.equal(explainError("", "student"), null);
});
