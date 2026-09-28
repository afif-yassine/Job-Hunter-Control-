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

// Scopes/URLs confirmed from the live francetravail.io docs (Sept 2026).
const READY_ENV = {
  FRANCE_TRAVAIL_CLIENT_ID: "id",
  FRANCE_TRAVAIL_CLIENT_SECRET: "secret",
  FRANCE_TRAVAIL_MARCHE_SCOPE: "api_stats-offres-demandes-emploiv1 offresetdemandesemploi",
  FRANCE_TRAVAIL_MARCHE_URL: "https://api.francetravail.io/partenaire/stats-offres-demandes-emploi/v1/indicateur/stat-demandeurs",
  FRANCE_TRAVAIL_FORMATION_SCOPE: "api_openformationv1 openFormation",
  FRANCE_TRAVAIL_FORMATION_URL: "https://api.francetravail.io/partenaire/openformation/v1/offres",
  FRANCE_TRAVAIL_ACCES_EMPLOI_SCOPE: "api_stats-perspectives-retour-emploiv1 retouremploi",
  FRANCE_TRAVAIL_ACCES_EMPLOI_URL: "https://api.francetravail.io/partenaire/stats-perspectives-retour-emploi/v1/indicateur/stat-acces-emploi",
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

test("getFranceTravailToken: posts to the confirmed francetravail.io domain by default, overridable", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => (
    urls.push(String(input)), new Response(JSON.stringify({ access_token: "tok" }))
  )) as typeof fetch;
  await getFranceTravailToken("api_x", READY_ENV);
  assert.match(urls[0], /^https:\/\/authentification-partenaire\.francetravail\.io\//);
  await getFranceTravailToken("api_x", { ...READY_ENV, FRANCE_TRAVAIL_TOKEN_URL: "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire" });
  assert.match(urls[1], /^https:\/\/entreprise\.francetravail\.fr\//);
});

test("fetchMarketInsight: not configured (no department, or missing scope/url) → null, no network call", async () => {
  let calls = 0;
  globalThis.fetch = (async () => (calls++, new Response("{}"))) as typeof fetch;
  assert.equal(await fetchMarketInsight({ romeCode: "M1805" }, {}), null);
  assert.equal(await fetchMarketInsight({ romeCode: "M1805" }, READY_ENV), null); // no department
  assert.equal(calls, 0);
});

test("fetchMarketInsight: POSTs a JSON body (confirmed shape), tolerant to field naming in the response", async () => {
  let body: unknown;
  let call = 0;
  globalThis.fetch = (async (_url, init) => {
    call++;
    if (call === 1) return new Response(JSON.stringify({ access_token: "tok" }));
    body = init?.body;
    return new Response(JSON.stringify({ resultats: [{ valeur: 340, periode: "2026T3" }] }));
  }) as typeof fetch;
  const result = await fetchMarketInsight({ romeCode: "M1805", department: "75" }, READY_ENV);
  assert.deepEqual(JSON.parse(body as string), {
    codeTypeTerritoire: "DEP",
    codeTerritoire: "75",
    codeTypeActivite: "ROME",
    codeActivite: "M1805",
    codeTypePeriode: "TRIMESTRE",
    codeTypeNomenclature: "CATCAND",
  });
  assert.equal(result?.jobseekerCount, 340);
  assert.equal(result?.period, "2026T3");
});

test("fetchMarketInsight: a 204 (no data for this métier) is not an error", async () => {
  globalThis.fetch = fetchSequence(new Response(JSON.stringify({ access_token: "tok" })), new Response(null, { status: 204 }));
  assert.equal(await fetchMarketInsight({ romeCode: "M1805", department: "75" }, READY_ENV), null);
});

test("fetchTrainingSuggestions: kept unused (Open Formation has no search-by-métier endpoint), returns [] when not configured", async () => {
  assert.deepEqual(await fetchTrainingSuggestions({ romeCode: "M1805" }, {}), []);
});

test("fetchAccessRate: not configured or no department → null; reads the rate once configured", async () => {
  assert.equal(await fetchAccessRate({ romeCode: "M1805" }, {}), null);
  assert.equal(await fetchAccessRate({ romeCode: "M1805" }, READY_ENV), null); // no department
  globalThis.fetch = fetchSequence(
    new Response(JSON.stringify({ access_token: "tok" })),
    new Response(JSON.stringify({ resultats: [{ tauxAcces6Mois: 62.4 }] })),
  );
  const result = await fetchAccessRate({ romeCode: "M1805", department: "75" }, READY_ENV);
  assert.equal(result?.rate6Months, 62.4);
});

test("fetchAccessRate: POSTs the confirmed ACC_1 body shape (own endpoint docs, Sept 2026)", async () => {
  let body: unknown;
  let call = 0;
  globalThis.fetch = (async (_url, init) => {
    call++;
    if (call === 1) return new Response(JSON.stringify({ access_token: "tok" }));
    body = init?.body;
    return new Response(JSON.stringify({ resultats: [{ tauxAcces6Mois: 62.4 }] }));
  }) as typeof fetch;
  await fetchAccessRate({ romeCode: "A1203", department: "75" }, READY_ENV);
  assert.deepEqual(JSON.parse(body as string), {
    codeTypeTerritoire: "DEP",
    codeTerritoire: "75",
    codeTypeActivite: "ROME",
    codeActivite: "A1203",
    codeTypePeriode: "TRIMESTRE",
    codeTypeNomenclature: "DUREEEMP",
  });
});
