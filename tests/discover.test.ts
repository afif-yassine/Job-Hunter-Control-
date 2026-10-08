import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { runScan } from "../lib/scan";
import { boardsInOffers, mergeDiscovered, normalizeDiscovered, type Discovered } from "../lib/scan/discover";
import { ATS_IDS, boardUrl, parseAtsTarget } from "../lib/scan/sources/ats";
import { mapJSearchOffer } from "../lib/scan/sources/jsearch";
import type { ScannedOffer } from "../lib/scan/types";
import { fakeSupabase } from "./fake-supabase";
import { SEARCH_DEV_PARIS } from "./prefs";

const offer = (extra: Partial<ScannedOffer>): ScannedOffer => ({
  source: "jsearch:linkedin",
  company: "Acme",
  title: "Alternance développeur",
  location: "Paris",
  contract_type: null,
  description: null,
  url: "https://www.linkedin.com/jobs/view/1",
  publishedAt: null,
  ...extra,
});

test("how a platform is recognised: the shape of the offer's link names the company", () => {
  const found = boardsInOffers([
    offer({ applyUrl: "https://jobs.lever.co/acme/5f1c-uuid/apply" }),
    offer({ company: "Globex", links: ["https://www.indeed.fr/x", "https://job-boards.greenhouse.io/globex/jobs/123"] }),
    offer({ company: "Initech", applyUrl: "https://boards.greenhouse.io/embed/job_app?for=initech&token=42" }),
    offer({ company: "Umbrella", source: "francetravail", applyUrl: "https://jobs.ashbyhq.com/umbrella/abc" }),
    offer({ company: "Hooli", applyUrl: "https://apply.workable.com/hooli/j/ABC123/" }),
    offer({ company: "Stark", applyUrl: "https://stark.recruitee.com/o/dev" }),
    // The company's own domain embedding Greenhouse does not name the board: ignored.
    offer({ company: "Wayne", applyUrl: "https://careers.wayne.com/jobs?gh_jid=123" }),
    // Offers already read from a board teach nothing new.
    offer({ source: "ats:lever", applyUrl: "https://jobs.lever.co/already/1" }),
  ]);
  assert.deepEqual([...found.keys()].sort(), [
    "ashby:umbrella",
    "greenhouse:globex",
    "greenhouse:initech",
    "lever:acme",
    "recruitee:stark",
    "workable:hooli",
  ]);
  assert.equal(found.get("ashby:umbrella")!.via, "francetravail");
});

test("JSearch's other application links are kept, so the company board is found even behind LinkedIn", () => {
  const mapped = mapJSearchOffer({
    job_title: "Stage data",
    job_apply_link: "https://www.linkedin.com/jobs/view/9",
    apply_options: [{ apply_link: "https://www.linkedin.com/jobs/view/9" }, { apply_link: "https://jobs.lever.co/acme/9" }],
  });
  assert.ok(boardsInOffers([mapped!]).has("lever:acme"));
});

test("the list grows by itself, never re-adds an ignored or hand-typed company, forgets silent ones", () => {
  const now = new Date("2026-09-28T10:00:00Z");
  const old = new Date("2026-05-01T10:00:00Z").toISOString();
  const current: Discovered = {
    items: [
      { key: "lever:acme", company: "Acme", via: "jsearch:linkedin", link: "", firstSeen: old, lastSeen: old },
      { key: "ashby:stale", company: "Stale", via: "adzuna", link: "", firstSeen: old, lastSeen: old },
    ],
    ignored: ["greenhouse:nope"],
  };
  const { next, added } = mergeDiscovered(
    current,
    [
      offer({ applyUrl: "https://jobs.lever.co/acme/1" }), // known → refreshed
      offer({ company: "Entreprise non communiquée", applyUrl: "https://jobs.ashbyhq.com/newco/1" }), // new, name from slug
      offer({ applyUrl: "https://job-boards.greenhouse.io/nope/jobs/1" }), // ignored by the user
      offer({ applyUrl: "https://jobs.lever.co/mine/1" }), // typed by hand already
    ],
    new Set(["lever:mine"]),
    now,
  );
  assert.deepEqual(added.map((a) => [a.key, a.company]), [["ashby:newco", "newco"]]);
  assert.deepEqual(next.items.map((i) => i.key).sort(), ["ashby:newco", "lever:acme"]); // "stale" not seen for 150 days
  assert.equal(next.items.find((i) => i.key === "lever:acme")!.lastSeen, now.toISOString());
  assert.deepEqual(next.ignored, ["greenhouse:nope"]);
  assert.deepEqual(normalizeDiscovered({ items: [{ key: "not a board" }, { key: "lever:ok" }] }).items.map((i) => i.key), ["lever:ok"]);
});

test("every platform's public page link reads back as the same board", () => {
  for (const ats of ATS_IDS) assert.deepEqual(parseAtsTarget(boardUrl({ ats, slug: "acme" })), { ats, slug: "acme" }, ats);
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("end to end: a JSearch offer on Lever makes the next scan read that company's Lever board", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("api.lever.co"))
      return new Response(JSON.stringify([{ text: "Stage développeur", hostedUrl: "https://jobs.lever.co/acme/2", categories: { location: "Paris" } }]));
    return new Response(
      JSON.stringify({
        data: { jobs: [{ job_title: "Alternance développeur", employer_name: "Acme", job_apply_link: "https://jobs.lever.co/acme/1", job_city: "Paris" }] },
      }),
    );
  }) as typeof fetch;
  const { db, tables } = fakeSupabase(
    { jobs: [], job_sources: [], applications: [], user_settings: [{ user_id: "u1", scan_config: SEARCH_DEV_PARIS }], agent_runs: [], notifications: [] },
    { rpc: { consume_source_budget: () => true, record_source_run: () => null } },
  );
  const env = { JSEARCH_API_KEY: "k" };

  const first = await runScan({ supabase: db, userId: "u1", env, cacheDb: null });
  assert.equal(first.discovered, 1);
  const row = tables.user_settings.find((r) => r.user_id === "u1")!;
  assert.equal((row.discovered_targets as Discovered).items[0].key, "lever:acme");
  assert.ok(!urls.some((u) => u.includes("api.lever.co")));

  const second = await runScan({ supabase: db, userId: "u1", env, cacheDb: null });
  assert.equal(second.discovered, 0);
  assert.ok(urls.some((u) => u.startsWith("https://api.lever.co/v0/postings/acme")));
});
