import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePrefs } from "../lib/scan/config";
import { inFrance, mapAtsJobs, parseAtsTarget, scanAts } from "../lib/scan/sources/ats";

test("careers page links are recognised, anything else is refused", () => {
  assert.deepEqual(parseAtsTarget("https://boards.greenhouse.io/doctolib"), { ats: "greenhouse", slug: "doctolib" });
  assert.deepEqual(parseAtsTarget("job-boards.eu.greenhouse.io/alan/jobs/123"), { ats: "greenhouse", slug: "alan" });
  assert.deepEqual(parseAtsTarget("https://jobs.lever.co/mistral"), { ats: "lever", slug: "mistral" });
  assert.deepEqual(parseAtsTarget("https://jobs.ashbyhq.com/Qonto?utm=x"), { ats: "ashby", slug: "qonto" });
  assert.deepEqual(parseAtsTarget("https://careers.smartrecruiters.com/Ubisoft2"), { ats: "smartrecruiters", slug: "ubisoft2" });
  assert.deepEqual(parseAtsTarget("https://apply.workable.com/swile/"), { ats: "workable", slug: "swile" });
  assert.deepEqual(parseAtsTarget("lever:back-market"), { ats: "lever", slug: "back-market" });
  assert.equal(parseAtsTarget("https://www.linkedin.com/company/doctolib"), null);
  assert.equal(parseAtsTarget("https://boards.greenhouse.io/"), null);
  assert.equal(parseAtsTarget("n'importe quoi"), null);
});

test("preferences keep only valid, unique careers pages", () => {
  const prefs = normalizePrefs({
    targets: ["https://jobs.lever.co/mistral", "lever:mistral", "https://example.com", "https://boards.greenhouse.io/doctolib"],
  });
  assert.deepEqual(prefs.targets, ["lever:mistral", "greenhouse:doctolib"]);
  assert.deepEqual(normalizePrefs({}).targets, []);
});

test("each platform's JSON becomes offers with full text and the right links", () => {
  const gh = mapAtsJobs({ ats: "greenhouse", slug: "doctolib" }, {
    jobs: [
      {
        title: "Alternance - Software Engineer",
        company_name: "Doctolib",
        location: { name: "Paris, France" },
        absolute_url: "https://boards.greenhouse.io/doctolib/jobs/1",
        content: "&lt;p&gt;Tu d&amp;eacute;veloppes nos API&lt;/p&gt;",
        first_published: "2026-09-20T10:00:00Z",
      },
    ],
  });
  assert.equal(gh[0].company, "Doctolib");
  assert.equal(gh[0].source, "ats:greenhouse");
  assert.ok(gh[0].description?.includes("API"));
  assert.ok(!gh[0].description?.includes("<p>"));

  const lever = mapAtsJobs({ ats: "lever", slug: "back-market" }, [
    {
      text: "Stage Data Engineer",
      categories: { location: "Paris", commitment: "Internship" },
      hostedUrl: "https://jobs.lever.co/back-market/1",
      applyUrl: "https://jobs.lever.co/back-market/1/apply",
      descriptionPlain: "Pipelines de données",
      lists: [{ text: "Profil", content: "<li>Python</li>" }],
      createdAt: 1790000000000,
    },
  ]);
  assert.equal(lever[0].company, "Back Market");
  assert.equal(lever[0].contract_type, "Internship");
  assert.equal(lever[0].applyUrl, "https://jobs.lever.co/back-market/1/apply");
  assert.ok(lever[0].description?.includes("Python"));

  const sr = mapAtsJobs({ ats: "smartrecruiters", slug: "ubisoft2" }, {
    content: [{ id: "744", name: "Stagiaire IA", company: { name: "Ubisoft" }, location: { city: "Montreuil", country: "fr" }, releasedDate: "2026-09-10T00:00:00Z" }],
  });
  assert.equal(sr[0].url, "https://jobs.smartrecruiters.com/ubisoft2/744");
  assert.equal(sr[0].location, "Montreuil, France");
  assert.equal(sr[0].description, null);

  const ashby = mapAtsJobs({ ats: "ashby", slug: "qonto" }, {
    jobs: [
      { title: "Intern Backend", location: "Paris", jobUrl: "https://jobs.ashbyhq.com/qonto/1", descriptionPlain: "Go, Postgres", isListed: true },
      { title: "Hidden", location: "Paris", jobUrl: "https://jobs.ashbyhq.com/qonto/2", isListed: false },
    ],
  });
  assert.equal(ashby.length, 1);

  const wk = mapAtsJobs({ ats: "workable", slug: "swile" }, {
    name: "Swile",
    jobs: [{ title: "Alternant Dev", city: "Paris", country: "France", url: "https://apply.workable.com/swile/j/AB12", published_on: "2026-09-01" }],
  });
  assert.equal(wk[0].company, "Swile");
});

test("company boards: foreign and stale offers dropped, one broken page never stops the others", async () => {
  assert.equal(inFrance("Berlin, Germany", { city: "Paris" }), false);
  assert.equal(inFrance("Remote - EMEA", { city: "Paris" }), true);
  assert.equal(inFrance(null, { city: "Paris" }), true);
  const recent = new Date().toISOString();
  const fetchImpl = (async (url: string) => {
    if (url.includes("lever")) return new Response("not found", { status: 404 });
    return new Response(
      JSON.stringify({
        jobs: [
          { title: "Stage IA", location: { name: "Paris" }, absolute_url: "https://boards.greenhouse.io/a/jobs/1", first_published: recent },
          { title: "Stage IA Berlin", location: { name: "Berlin" }, absolute_url: "https://boards.greenhouse.io/a/jobs/2", first_published: recent },
          { title: "Vieux stage", location: { name: "Paris" }, absolute_url: "https://boards.greenhouse.io/a/jobs/3", first_published: "2024-01-01T00:00:00Z" },
        ],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const result = await scanAts(
    [
      { ats: "greenhouse", slug: "a" },
      { ats: "lever", slug: "b" },
    ],
    { city: "Paris", maxAgeDays: 14 },
    fetchImpl,
  );
  assert.equal(result.offers.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /introuvable/);
});
