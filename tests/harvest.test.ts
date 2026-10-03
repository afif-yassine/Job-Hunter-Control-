import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORIES, EXTRA_ROMES, SCOPE_ROMES, categorize, contractKind } from "../lib/scan/categories";
import { FT_REGIONS, FT_SEGMENTS, inScope, planTasks, runHarvestSlice, slotOf } from "../lib/scan/harvest";
import { ftTotal } from "../lib/scan/sources/francetravail";
import { fakeSupabase } from "./fake-supabase";

test("categories: titles first (several possible), ROME code otherwise; contract kinds", () => {
  assert.deepEqual(categorize({ title: "Alternance Développeur Web React (H/F)" }), ["web"]);
  assert.deepEqual(categorize({ title: "Développeur mobile Flutter - stage" }).sort(), ["mobile", "web"]);
  assert.deepEqual(categorize({ title: "Chef de projet Data - alternance" }).sort(), ["data", "projet"]);
  assert.deepEqual(categorize({ title: "STAGE - Business Developpeur - EDU (F/H)" }), []);
  assert.deepEqual(categorize({ title: "IT Support Technician Intern" }), ["systemes"]);
  assert.deepEqual(categorize({ title: "Assistante administrative et commerciale" }), ["bureautique"]);
  assert.deepEqual(categorize({ title: "Ingénieur DevOps / SRE" }), ["devops"]);
  assert.deepEqual(categorize({ title: "Poste polyvalent", romeCode: "M1827" }), ["devops"]);
  assert.equal(contractKind({ title: "Développeur web", contract_type: "Contrat apprentissage · CDD" }), "alternance");
  assert.equal(contractKind({ title: "Stagiaire data" }), "stage");
  assert.equal(contractKind({ title: "Technicien support", contract_type: "Contrat à durée déterminée - 6 Mois" }), "cdd");
  assert.equal(contractKind({ title: "Développeur web", source: "lba:francetravail" }), "alternance");
  assert.equal(contractKind({ title: "Développeur senior", contract_type: "CDI" }), "cdi");
  assert.ok(inScope({ source: "adzuna", company: "A", title: "Alternance développeur", location: "Paris", contract_type: null, description: null, url: "https://x", publishedAt: null }));
  assert.ok(!inScope({ source: "adzuna", company: "A", title: "Développeur senior", location: "Paris", contract_type: "CDI", description: null, url: "https://x", publishedAt: null }));
  // The ROME list stays consistent.
  assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
  assert.ok(EXTRA_ROMES.every((r) => !r.startsWith("M18")) && SCOPE_ROMES.includes("M1855"));
});

test("runs start at 04:00 and 12:00 UTC; the morning run also searches Adzuna", async () => {
  assert.equal(slotOf(new Date("2026-10-04T03:00:00Z")), "2026-10-03T12");
  assert.equal(slotOf(new Date("2026-10-04T05:30:00Z")), "2026-10-04T04");
  assert.equal(slotOf(new Date("2026-10-04T13:00:00Z")), "2026-10-04T12");
  assert.equal(ftTotal("offres 0-149/1234"), 1234);
  const db = fakeSupabase({ offers: [{ board: "lever:acme" }], user_settings: [{ scan_config: { targets: ["greenhouse:doctolib"] }, discovered_targets: { items: [{ key: "ashby:alan" }] } }] }).db;
  const env = { FRANCE_TRAVAIL_CLIENT_ID: "i", FRANCE_TRAVAIL_CLIENT_SECRET: "s", ADZUNA_APP_ID: "a", ADZUNA_APP_KEY: "k" };
  const morning = await planTasks(db, "2026-10-04T04", env);
  const afternoon = await planTasks(db, "2026-10-04T12", env);
  const by = (tasks: { source: string }[], s: string) => tasks.filter((t) => t.source === s).length;
  assert.equal(by(morning, "francetravail"), Object.keys(FT_REGIONS).length * FT_SEGMENTS.length);
  assert.equal(by(morning, "ats"), 3);
  assert.equal(by(morning, "adzuna"), CATEGORIES.length * 2 * 5);
  assert.equal(by(afternoon, "adzuna"), 0);
  assert.equal((await planTasks(db, "2026-10-04T12", {})).filter((t) => t.source === "francetravail").length, 0);
});

test("a run: France Travail by region (split by département when too big), stored with categories, closures once complete", async () => {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const stored: Record<string, unknown>[] = [];
  const { db, tables } = fakeSupabase(
    { harvest_runs: [], harvest_tasks: [], offers: [], user_settings: [] },
    {
      rpc: {
        upsert_offers: (a) => {
          stored.push(...(a.p_rows as Record<string, unknown>[]));
          return [];
        },
        close_unseen_offers: (a) => (calls.push({ fn: "close_unseen_offers", args: a }), 3),
        expire_offers: () => 0,
        record_source_run: (a) => (calls.push({ fn: "record_source_run", args: a }), null),
        consume_source_budget: () => true,
      },
    },
  );
  const ft = (id: string, title: string, nature: string) => ({
    id,
    intitule: title,
    entreprise: { nom: "Acme" },
    lieuTravail: { libelle: "75 - PARIS 11" },
    natureContrat: nature,
    typeContratLibelle: "Contrat à durée déterminée - 12 Mois",
    romeCode: "M1855",
    dateCreation: "2026-10-03T08:00:00Z",
    description: "Développement web.",
  });
  const asked: URLSearchParams[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.includes("access_token")) return new Response(JSON.stringify({ access_token: "t" }));
    const p = url.searchParams;
    asked.push(p);
    if (p.get("region") === "11" && p.get("natureContrat") === "E2" && p.get("grandDomaine") === "M18")
      return new Response(JSON.stringify({ resultats: [ft("1", "Développeur web", "Contrat apprentissage"), ft("2", "Assistant administratif", "Contrat apprentissage")] }), {
        status: 200,
        headers: { "content-range": "offres 0-1/2" },
      });
    if (p.get("region") === "32" && p.get("natureContrat") === "E2")
      return new Response(JSON.stringify({ resultats: [] }), { status: 206, headers: { "content-range": "offres 0-149/5000" } });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const env = { FRANCE_TRAVAIL_CLIENT_ID: "i", FRANCE_TRAVAIL_CLIENT_SECRET: "s" };
  const now = new Date("2026-10-04T13:00:00Z");

  const report = await runHarvestSlice(db, { env, now, budgetMs: 120_000, fetchImpl });
  assert.equal(report.created, true);
  assert.equal(report.finished, true);
  assert.equal(report.offers, 2);
  // Stored once for everybody, with category and contract kind.
  assert.deepEqual(stored.map((r) => [r.categories, r.contract_kind]), [[["web"], "alternance"], [["bureautique"], "alternance"]]);
  // Hauts-de-France had 5 000 apprenticeships: read département by département.
  const split = tables.harvest_tasks.filter((t) => String(t.key).startsWith("ft:d") && String(t.key).endsWith(":it-app"));
  assert.deepEqual(split.map((t) => t.params && (t.params as { departement: string }).departement).sort(), FT_REGIONS["32"]);
  assert.ok(asked.some((p) => p.get("departement") === "59" && p.get("grandDomaine") === "M18"));
  assert.ok(asked.every((p) => p.get("publieeDepuis") === "31"));
  assert.ok(asked.some((p) => (p.get("codeROME") ?? "").split(",").includes("M1607")));
  // Every France Travail search succeeded: what it no longer lists is closed (licence).
  const closed = calls.find((c) => c.fn === "close_unseen_offers")!.args;
  assert.equal(closed.p_rome_prefix, "M18");
  assert.equal(report.closed, 3);
  assert.equal(tables.harvest_runs[0].status, "done");

  // Same slot again: nothing more to do.
  const again = await runHarvestSlice(db, { env, now, budgetMs: 120_000, fetchImpl });
  assert.equal(again.finished, true);
  assert.equal(again.processed, 0);
});

test("a run cut by the time limit resumes where it stopped, and an error never closes anything", async () => {
  const { db, tables } = fakeSupabase(
    { harvest_runs: [], harvest_tasks: [], offers: [], user_settings: [] },
    { rpc: { upsert_offers: () => [], close_unseen_offers: () => 99, expire_offers: () => 0, record_source_run: () => null } },
  );
  let n = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.includes("access_token")) return new Response(JSON.stringify({ access_token: "t" }));
    n += 1;
    return n === 3 ? new Response("boom", { status: 500 }) : new Response(null, { status: 204 });
  }) as typeof fetch;
  const env = { FRANCE_TRAVAIL_CLIENT_ID: "i", FRANCE_TRAVAIL_CLIENT_SECRET: "s" };
  const now = new Date("2026-10-04T13:00:00Z");
  // No time at all: the run is created, nothing processed.
  const first = await runHarvestSlice(db, { env, now, budgetMs: 0, fetchImpl });
  assert.equal(first.created, true);
  assert.equal(first.processed, 0);
  assert.equal(first.pending, Object.keys(FT_REGIONS).length * FT_SEGMENTS.length);
  const second = await runHarvestSlice(db, { env, now, budgetMs: 120_000, fetchImpl });
  assert.equal(second.finished, true);
  assert.equal(tables.harvest_tasks.filter((t) => t.status === "error").length, 1);
  assert.equal(second.closed, undefined); // one France Travail search failed: no closure
  assert.equal(tables.harvest_runs[0].status, "partial");
});

test("ticked categories: prefs kept clean, shared queries, catalogue match by category, scope-wide relevance", async () => {
  const { configFromPrefs, normalizePrefs, isRelevant } = await import("../lib/scan/config");
  const { matchesCategories } = await import("../lib/scan/catalogue");
  const prefs = normalizePrefs({ contracts: ["alternance", "cdi", "cdd"], categories: ["devops", "nope", "bureautique"], keywords: [] });
  assert.deepEqual(prefs.contracts, ["alternance", "cdd"]);
  assert.deepEqual(prefs.categories, ["devops", "bureautique"]);
  assert.deepEqual(prefs.keywords, []); // categories chosen: no default keywords forced
  const config = configFromPrefs(prefs);
  assert.deepEqual(config.queries.map((q) => q.keywords), ["alternance devops", "cdd devops", "alternance assistant administratif", "cdd assistant administratif"]);
  const row = { title: "Ingénieur Cloud AWS", contract_type: "Contrat apprentissage", source: "francetravail", rome_code: null, categories: [], contract_kind: null };
  assert.ok(matchesCategories(row, config));
  assert.ok(!matchesCategories({ ...row, contract_type: "Stage" }, config)); // stage not wanted
  assert.ok(!matchesCategories({ ...row, title: "Data analyst" }, config));
  assert.ok(isRelevant({ title: "Assistant administratif", contract_type: "CDD 6 mois" }));
  assert.ok(isRelevant({ title: "Community manager (alternance)" }));
  assert.ok(!isRelevant({ title: "Développeur senior", contract_type: "CDI" }));
  assert.ok(!isRelevant({ title: "Vendeur en alternance" }));
});
