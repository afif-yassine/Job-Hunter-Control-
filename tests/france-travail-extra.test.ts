import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchAccessRate } from "../lib/france-travail/acces-emploi";
import { franceTravailApiReady, getFranceTravailToken } from "../lib/france-travail/client";
import { fetchTrainingSuggestions } from "../lib/france-travail/formation";
import { fetchMarketInsight } from "../lib/france-travail/market";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const READY_ENV = {
  FRANCE_TRAVAIL_CLIENT_ID: "id",
  FRANCE_TRAVAIL_CLIENT_SECRET: "secret",
  FRANCE_TRAVAIL_MARCHE_SCOPE: "api_marcheDuTravailv1 marcheDuTravail",
  FRANCE_TRAVAIL_MARCHE_URL: "https://api.francetravail.io/partenaire/marche-travail/v1/stats",
  FRANCE_TRAVAIL_FORMATION_SCOPE: "api_offreformationv1 openformation",
  FRANCE_TRAVAIL_FORMATION_URL: "https://api.francetravail.io/partenaire/offreformation/v1/offres",
  FRANCE_TRAVAIL_ACCES_EMPLOI_SCOPE: "api_accesEmploiv1 accesEmploi",
  FRANCE_TRAVAIL_ACCES_EMPLOI_URL: "https://api.francetravail.io/partenaire/acces-emploi/v1/taux",
};

function fetchSequence(...responses: Response[]) {
  let i = 0;
  return (async () => responses[Math.min(i++, responses.length - 1)]) as typeof fetch;
}

test("franceTravailApiReady: true only once credentials, scope and url are all set", () => {
  assert.equal(franceTravailApiReady("FRANCE_TRAVAIL_MARCHE_SCOPE", "FRANCE_TRAVAIL_MARCHE_URL", READY_ENV), true);
  assert.equal(franceTravailApiReady("FRANCE_TRAVAIL_MARCHE_SCOPE", "FRANCE_TRAVAIL_MARCHE_URL", {}), false);
  assert.equal(
    franceTravailApiReady("FRANCE_TRAVAIL_MARCHE_SCOPE", "FRANCE_TRAVAIL_MARCHE_URL", {
      FRANCE_TRAVAIL_CLIENT_ID: "id",
      FRANCE_TRAVAIL_CLIENT_SECRET: "secret",
    }),
    false,
  );
});

test("getFranceTravailToken: explains a refused auth clearly, with the scope in the message", async () => {
  globalThis.fetch = (async () => new Response("no", { status: 401 })) as typeof fetch;
  await assert.rejects(() => getFranceTravailToken("api_x", READY_ENV), /refusée \(401\).*api_x/s);
});

test("fetchMarketInsight: not configured → null, no network call", async () => {
  let calls = 0;
  globalThis.fetch = (async () => (calls++, new Response("{}"))) as typeof fetch;
  const result = await fetchMarketInsight({ romeCode: "M1805" }, {});
  assert.equal(result, null);
  assert.equal(calls, 0);
});

test("fetchMarketInsight: reads the token then the stat, tolerant to field naming", async () => {
  globalThis.fetch = fetchSequence(
    new Response(JSON.stringify({ access_token: "tok" })),
    new Response(
      JSON.stringify({ resultats: [{ tensionLibelle: "Tension forte", salaireMin: 2200, salaireMax: 3400, nombreEmbauches: 120 }] }),
    ),
  );
  const result = await fetchMarketInsight({ romeCode: "M1805", department: "75" }, READY_ENV);
  assert.deepEqual(result, {
    tensionLabel: "Tension forte",
    tensionScore: null,
    avgSalaryMin: 2200,
    avgSalaryMax: 3400,
    hiringVolume: 120,
    raw: { resultats: [{ tensionLibelle: "Tension forte", salaireMin: 2200, salaireMax: 3400, nombreEmbauches: 120 }] },
  });
});

test("fetchMarketInsight: a 204 (no data for this métier) is not an error", async () => {
  globalThis.fetch = fetchSequence(new Response(JSON.stringify({ access_token: "tok" })), new Response(null, { status: 204 }));
  assert.equal(await fetchMarketInsight({ romeCode: "M1805" }, READY_ENV), null);
});

test("fetchTrainingSuggestions: not configured → empty array", async () => {
  assert.deepEqual(await fetchTrainingSuggestions({ romeCode: "M1805" }, {}), []);
});

test("fetchTrainingSuggestions: caps at the requested limit and flags CPF-funded trainings", async () => {
  globalThis.fetch = fetchSequence(
    new Response(JSON.stringify({ access_token: "tok" })),
    new Response(
      JSON.stringify({
        formations: [
          { intitule: "Docker & Kubernetes", organismeFormation: "OpenClassrooms", urlFormation: "https://x/1", dureeIndicativeHeures: 30, modaliteFinancement: "CPF" },
          { intitule: "Terraform avancé", organismeFormation: "Simplon", dureeIndicativeHeures: 20 },
          { intitule: "AWS certifié", organismeFormation: "CNAM" },
        ],
      }),
    ),
  );
  const result = await fetchTrainingSuggestions({ romeCode: "M1805", limit: 2 }, READY_ENV);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "Docker & Kubernetes");
  assert.equal(result[0].funded, true);
  assert.equal(result[1].funded, null);
});

test("fetchAccessRate: not configured → null; reads the 6-month rate once configured", async () => {
  assert.equal(await fetchAccessRate({ romeCode: "M1805" }, {}), null);
  globalThis.fetch = fetchSequence(
    new Response(JSON.stringify({ access_token: "tok" })),
    new Response(JSON.stringify({ tauxAcces6Mois: 62.4 })),
  );
  const result = await fetchAccessRate({ romeCode: "M1805" }, READY_ENV);
  assert.equal(result?.rate6Months, 62.4);
});
