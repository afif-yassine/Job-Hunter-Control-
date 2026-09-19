import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAlertHtml } from "../lib/scan/alerts";
import { isRelevant } from "../lib/scan/config";
import { canonicalUrl, fingerprintOf, ingestOffers } from "../lib/scan/ingest";
import { scanFranceTravail } from "../lib/scan/sources/francetravail";

// NOTE: synthetic alert layouts. Validate against a real alert e-mail before relying on them.
const ALERT = `
<table><tr><td><a href="https://www.linkedin.com/comm/jobs/view/3912345678/?trackingId=abc&amp;refId=zz">Stage Développeur IA (6 mois)</a></td></tr>
<tr><td>Qonto</td></tr><tr><td>Paris, Île-de-France, France</td></tr>
<tr><td><a href="https://www.linkedin.com/comm/jobs/view/3912345678/?x=1">Voir l'offre</a></td></tr></table>
<a href="https://www.welcometothejungle.com/fr/companies/swile/jobs/stage-software-engineer_paris_SWIL_abc123?q=zz">Stage Software Engineer</a>
<a href="https://www.hellowork.com/fr-fr/emplois/12345678.html?utm_source=x">Alternance développeur web H/F</a><p>Capgemini</p><p>Issy-les-Moulineaux - 92</p>
<a href="https://fr.indeed.com/rc/clk?jk=abcdef0123456789&amp;fccid=1">Stagiaire Machine Learning</a><div>Doctolib</div><div>Paris (75)</div>
<a href="https://example.com/unsubscribe">Se désinscrire</a>`;

test("alert e-mails: keeps job links, merges duplicates, ignores the rest", () => {
  const offers = parseAlertHtml(ALERT);
  assert.equal(offers.length, 4);
  const linkedin = offers.find((o) => o.source === "alert:linkedin")!;
  assert.equal(linkedin.title, "Stage Développeur IA (6 mois)");
  assert.equal(linkedin.company, "Qonto");
  assert.equal(offers.find((o) => o.source === "alert:wttj")!.company, "Swile");
});

test("tracking parameters and accents do not create duplicates", () => {
  assert.equal(canonicalUrl("https://www.Example.com/job/1/?utm_source=a&b=2#top"), "https://example.com/job/1?b=2");
  assert.equal(
    fingerprintOf({ company: "Alan", title: "Software Engineer Internship", location: "Paris, Île-de-France, France (hybrid)" }),
    fingerprintOf({ company: "ALAN", title: "Software  engineer internship!", location: "75 - PARIS 08" }),
  );
});

test("relevance filter keeps tech alternance/stage and drops the rest", () => {
  assert.ok(isRelevant({ title: "Alternance Développeur Python" }));
  assert.ok(isRelevant({ title: "Software Engineer Internship (6 months)" }));
  assert.ok(!isRelevant({ title: "Boulanger en alternance" }));
  assert.ok(!isRelevant({ title: "Senior Developer", contract_type: "CDI" }));
});

test("France Travail: OAuth client credentials + search mapping", async () => {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("access_token")) {
      assert.ok(String(init?.body).includes("grant_type=client_credentials"));
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer tok");
    if (u.includes("intelligence")) return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ resultats: [{ id: "1", intitule: "Alternance Développeur Web", description: "…", entreprise: { nom: "Acme" }, lieuTravail: { libelle: "75 - PARIS 08" } }, { id: "no-title" }] }), { status: 206 });
  };
  const offers = await scanFranceTravail(
    { queries: [{ keywords: "alternance développeur" }, { keywords: "alternance intelligence artificielle" }], departments: ["75", "92"], maxAgeDays: 14 },
    { FRANCE_TRAVAIL_CLIENT_ID: "i", FRANCE_TRAVAIL_CLIENT_SECRET: "s" },
    fakeFetch,
    new Date("2026-09-20T00:00:00Z"),
  );
  assert.equal(offers.length, 1);
  assert.equal(offers[0].company, "Acme");
  assert.ok(calls[1].includes("minCreationDate=2026-09-06T00%3A00%3A00Z"));
});

test("ingest de-duplicates against existing jobs, across sources and inside the batch", async () => {
  const existing = [{ company: "Alan", title: "Software Engineer Internship", location: "Paris, Île-de-France, France (hybrid)", source_url: "https://jobs.example/alan/1", official_url: null }];
  const inserted: unknown[] = [];
  const fake = {
    from: () => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: existing, error: null }) }) }),
      insert: async (rows: unknown[]) => { inserted.push(...rows); return { error: null }; },
    }),
  } as never;
  const base = { contract_type: null, description: null, publishedAt: null };
  const result = await ingestOffers(fake, "u1", [
    { ...base, source: "alert:linkedin", company: "Alan", title: "Software Engineer Internship", location: "Paris", url: "https://www.linkedin.com/jobs/view/1/" },
    { ...base, source: "alert:linkedin", company: "À compléter", title: "Stage IA", location: null, url: "https://www.linkedin.com/jobs/view/2/" },
    { ...base, source: "alert:indeed", company: "À compléter", title: "Stage IA", location: null, url: "https://www.linkedin.com/jobs/view/2/?utm_source=z" },
    { ...base, source: "francetravail", company: "Acme", title: "Alternance Développeur Web", location: "PARIS 08", url: "https://ft.example/1", description: "texte" },
  ]);
  assert.deepEqual([result.inserted, result.duplicates, result.needsDescription], [2, 2, 1]);
  assert.equal(inserted.length, 2);
});
