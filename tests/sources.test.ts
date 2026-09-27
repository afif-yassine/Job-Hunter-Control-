import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanRaw, explainError } from "../lib/errors";
import { decryptValues, encryptValues, saveIntegration } from "../lib/integrations";
import { runSummary } from "../lib/run-summary";
import { configFromPrefs, DEFAULT_PREFS, normalizePrefs, type ScanConfig } from "../lib/scan/config";
import { extractJobText, isPublicHttpsUrl } from "../lib/scan/enrich";
import { mapAdzunaOffer, scanAdzuna } from "../lib/scan/sources/adzuna";
import { scanJooble } from "../lib/scan/sources/jooble";
import { mapJSearchOffer, scanJSearch } from "../lib/scan/sources/jsearch";
import { fakeSupabase } from "./fake-supabase";

const config: ScanConfig = {
  queries: [{ keywords: "alternance développeur" }, { keywords: "stage data" }],
  departments: ["75"],
  city: "Paris",
  maxAgeDays: 14,
  targets: [],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("Adzuna: maps results and reports refused keys clearly", async () => {
  const offer = mapAdzunaOffer({
    title: "Alternance Développeur Python",
    redirect_url: "https://www.adzuna.fr/land/ad/1",
    company: { display_name: "Alan" },
    location: { display_name: "Paris, Île-de-France" },
    contract_time: "full_time",
    created: "2026-09-18T10:00:00Z",
  });
  assert.equal(offer?.source, "adzuna");
  assert.equal(offer?.company, "Alan");
  assert.equal(mapAdzunaOffer({ title: "sans lien" }), null);

  const urls: string[] = [];
  const ok: typeof fetch = async (url) => {
    urls.push(String(url));
    return json({ results: [{ title: "Stage Data", redirect_url: "https://x.test/1" }] });
  };
  const offers = await scanAdzuna(config, { ADZUNA_APP_ID: "id", ADZUNA_APP_KEY: "key" }, ok);
  assert.equal(offers.length, 2);
  assert.ok(urls[0].includes("app_id=id") && urls[0].includes("where=Paris"));

  await assert.rejects(scanAdzuna(config, {}, async () => json({}, 401)), /Clés Adzuna refusées/);
});

test("Jooble: filters old offers", async () => {
  const fresh = new Date().toISOString();
  const offers = await scanJooble(
    { ...config, queries: [config.queries[0]] },
    { JOOBLE_API_KEY: "k" },
    async () =>
      json({
        jobs: [
          { title: "Alternant dev", link: "https://j.test/1", updated: fresh },
          { title: "Vieille offre", link: "https://j.test/2", updated: "2020-01-01T00:00:00Z" },
        ],
      }),
  );
  assert.deepEqual(offers.map((o) => o.title), ["Alternant dev"]);
});

test("JSearch: uses the publisher as source, falls back to the second host, explains quota", async () => {
  const mapped = mapJSearchOffer({
    job_title: "Stage IA",
    employer_name: "Qonto",
    job_apply_link: "https://www.linkedin.com/jobs/view/1",
    job_publisher: "LinkedIn",
    job_city: "Paris",
    job_employment_types: ["INTERN"],
  });
  assert.equal(mapped?.source, "jsearch:linkedin");
  assert.equal(mapped?.contract_type, "Stage");

  const hosts: string[] = [];
  const fallback: typeof fetch = async (url) => {
    hosts.push(new URL(String(url)).host);
    return hosts.length === 1 ? json({}, 403) : json({ data: [{ job_title: "Stage IA", job_apply_link: "https://a.test/1" }] });
  };
  const offers = await scanJSearch({ ...config, queries: [config.queries[0]] }, { JSEARCH_API_KEY: "k" }, fallback);
  assert.equal(offers.length, 1);
  assert.deepEqual(hosts, ["jsearch.p.rapidapi.com", "api.openwebninja.com"]);

  await assert.rejects(scanJSearch(config, { JSEARCH_API_KEY: "k" }, async () => json({}, 429)), /Quota JSearch/);
  // Free plan: never more than 3 requests per scan.
  let count = 0;
  await scanJSearch(
    { ...config, queries: Array.from({ length: 8 }, (_, i) => ({ keywords: `q${i}` })) },
    { JSEARCH_API_KEY: "k" },
    async () => (count++, json({ data: [] })),
  );
  assert.equal(count, 3);
});

test("JSearch: a refused call includes the API's own explanation, not just the HTTP code", async () => {
  // Real body confirmed live on jsearch.p.rapidapi.com (v5, Sept 2026).
  await assert.rejects(
    scanJSearch(
      { ...config, queries: [config.queries[0]] },
      { JSEARCH_API_KEY: "k" },
      async () =>
        json(
          {
            status: "ERROR",
            error: { mess: "Invalid date posted value. Date posted value should be 'anytime', 'today', '3days', 'week' or 'month'.", code: 400 },
          },
          404,
        ),
    ),
    /HTTP 404 — Invalid date posted value/,
  );

  // Plain-text (non-JSON) error bodies are also surfaced, truncated.
  await assert.rejects(
    scanJSearch({ ...config, queries: [config.queries[0]] }, { JSEARCH_API_KEY: "k" }, async () => new Response("Not Found", { status: 404 })),
    /HTTP 404 — Not Found/,
  );

  // "page" is no longer part of the v5 request (cursor-based pagination now).
  const urls: string[] = [];
  await scanJSearch({ ...config, queries: [config.queries[0]] }, { JSEARCH_API_KEY: "k" }, async (url) => (
    urls.push(String(url)), json({ data: [] })
  ));
  assert.ok(!urls[0].includes("page="));
});

test("ad page reader: JobPosting JSON-LD first, bot walls and private URLs refused", () => {
  const description = "<p>Missions : " + "développer des API. ".repeat(30) + "</p>";
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    description,
  })}</script></head><body>menu</body></html>`;
  const text = extractJobText(html);
  assert.ok(text && text.includes("développer des API") && !text.includes("<p>"));

  const wall = `<body>${"Just a moment... ".repeat(60)}</body>`;
  assert.equal(extractJobText(wall), null);

  assert.ok(isPublicHttpsUrl("https://www.indeed.com/viewjob?jk=1"));
  assert.ok(!isPublicHttpsUrl("http://example.com"));
  assert.ok(!isPublicHttpsUrl("https://localhost/admin"));
  assert.ok(!isPublicHttpsUrl("https://169.254.169.254/latest"));
});

test("saved API keys are encrypted and never stored in clear", async () => {
  const secret = "une-longue-phrase-secrete";
  const stored = encryptValues({ JSEARCH_API_KEY: "sk-super-secret" }, secret);
  assert.ok(!stored.includes("sk-super-secret"));
  assert.deepEqual(decryptValues(stored, secret), { JSEARCH_API_KEY: "sk-super-secret" });
  assert.throws(() => decryptValues(stored, "autre-secret"));

  process.env.INTEGRATIONS_SECRET = secret;
  const { db, tables } = fakeSupabase({ integrations: [] });
  assert.deepEqual(await saveIntegration(db, "u1", "jsearch", { JSEARCH_API_KEY: "sk-super-secret" }), { ok: true });
  assert.ok(!JSON.stringify(tables.integrations).includes("sk-super-secret"));
  const missing = await saveIntegration(db, "u1", "adzuna", { ADZUNA_APP_ID: "x" });
  assert.equal(missing.ok, false);
});

test("search preferences: sane defaults, capped queries", () => {
  assert.deepEqual(normalizePrefs(null), DEFAULT_PREFS);
  const prefs = normalizePrefs({
    contracts: ["stage"],
    keywords: ["IA", "IA", " data "],
    city: "  Lyon ",
    departments: ["69", "1", "abc"],
    maxAgeDays: 999,
  });
  assert.deepEqual(prefs.keywords, ["IA", "data"]);
  assert.equal(prefs.city, "Lyon");
  assert.deepEqual(prefs.departments, ["69", "01"]);
  assert.equal(prefs.maxAgeDays, DEFAULT_PREFS.maxAgeDays);
  const cfg = configFromPrefs(normalizePrefs({ contracts: ["alternance", "stage", "cdi"], keywords: ["a", "b", "c", "d"] }), 8);
  assert.equal(cfg.queries.length, 8);
  assert.equal(cfg.queries[0].keywords, "alternance a");
});

test("errors are explained in plain French, raw text is cleaned", () => {
  const playwright =
    "browserType.launch: Executable doesn't exist at /x ╔═══╗ ║ Looks like Playwright was just updated. Please update docker image ║ ╚═══╝";
  assert.match(explainError(playwright)!.title, /navigateur du worker/);
  assert.ok(!/[╔║╚]/.test(cleanRaw(playwright)));
  assert.match(explainError("Worker Playwright injoignable (fetch failed)")!.title, /ne répond pas/);
  assert.match(explainError("A public HTTPS application URL is required")!.title, /lien de candidature/);
  assert.equal(explainError(""), null);
});

test("journal summaries", () => {
  const run = (run_type: string, counters: Record<string, unknown>, status = "COMPLETED") => ({
    id: "1",
    run_type,
    status,
    created_at: "",
    error_message: null,
    counters,
  });
  assert.equal(
    runSummary(run("PIPELINE", { inserted: 12, analyzed: 12, strong: 2, generated: 2 })),
    "12 nouvelles offres · 12 analysées · 2 très bonnes · 2 dossiers prêts",
  );
  assert.match(runSummary(run("PLAYWRIGHT_PREPARE", { fields: 14, questions: 1 })), /14 champs détectés, 1 question/);
  assert.equal(runSummary(run("PLAYWRIGHT_PREPARE", {}, "FAILED")), "");
});
