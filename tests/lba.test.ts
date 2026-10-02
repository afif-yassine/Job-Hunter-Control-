import assert from "node:assert/strict";
import { test } from "node:test";
import type { ScanConfig } from "../lib/scan/config";
import { DEFAULT_TECH_ROMES, lbaJobsIn, mapLbaJob, scanLba } from "../lib/scan/sources/lba";

const config: ScanConfig = { queries: [{ keywords: "alternance développeur" }], departments: ["75"], city: "Paris", maxAgeDays: 30, targets: [] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const NESTED = {
  identifier: { id: "abc", partner_label: "France Travail" },
  offer: { title: "Alternance Développeur Web", description: "<p>Missions</p>", rome_codes: ["M1805"], publication: { creation: new Date().toISOString() } },
  workplace: { name: "Acme", location: { address: "75002 Paris" } },
  contract: { type: ["Apprentissage"] },
  apply: { url: "https://labonnealternance.apprentissage.beta.gouv.fr/offre/abc" },
};

test("La bonne alternance: nested (explorer) and flat shapes both map; partner kept as source", () => {
  const a = mapLbaJob(NESTED)!;
  assert.equal(a.title, "Alternance Développeur Web");
  assert.equal(a.company, "Acme");
  assert.equal(a.location, "75002 Paris");
  assert.equal(a.contract_type, "Apprentissage");
  assert.equal(a.romeCode, "M1805");
  assert.equal(a.source, "lba:francetravail");
  const b = mapLbaJob({ title: "Stage data", url: "https://x.test/1", company: "Globex" })!;
  assert.equal(b.source, "lba");
  assert.equal(b.company, "Globex");
  assert.equal(mapLbaJob({ title: "sans lien" }), null);
  assert.equal(lbaJobsIn({ jobs: [1], offres_emploi_partenaires: [2, 3], recruiters: [4] }).length, 3);
});

test("La bonne alternance: geocodes the city, sends ROME codes and the key, explains a refused key", async () => {
  const calls: { url: string; auth: string | null }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
    if (url.includes("api-adresse")) return json({ features: [{ geometry: { coordinates: [2.35, 48.85] } }] });
    return json({ jobs: [NESTED] });
  };
  const offers = await scanLba(config, { LBA_API_KEY: "k" }, fetchImpl, ["M1805", "M1806"]);
  assert.equal(offers.length, 1);
  const search = new URL(calls[1].url);
  assert.equal(search.pathname, "/api/job/v1/search");
  assert.equal(search.searchParams.get("latitude"), "48.85");
  assert.equal(search.searchParams.get("romes"), "M1805,M1806");
  assert.equal(calls[1].auth, "Bearer k");

  await assert.rejects(
    scanLba(config, { LBA_API_KEY: "bad" }, async (input) =>
      String(input).includes("api-adresse") ? json({ features: [{ geometry: { coordinates: [2, 48] } }] }) : json({}, 401),
    ),
    /Clé La bonne alternance refusée/,
  );
  assert.ok(DEFAULT_TECH_ROMES.includes("M1805"));
});
