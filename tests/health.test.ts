import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { buildAdminOverview } from "../lib/admin/overview";
import { runScan } from "../lib/scan";
import { budgetFor, cacheKey, classifyError } from "../lib/scan/health";
import { mapAtsJobs, parseAtsTarget } from "../lib/scan/sources/ats";
import { fakeSupabase } from "./fake-supabase";

const realFetch = globalThis.fetch;
const saved = { ...process.env };
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ["JSEARCH_API_KEY", "JOOBLE_API_KEY"]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const JOB = {
  job_title: "Alternance Développeur Python",
  employer_name: "Acme",
  job_apply_link: "https://acme.example/jobs/1",
  job_city: "Paris",
  job_country: "FR",
  job_description: "Développement backend Python en alternance.",
  job_publisher: "LinkedIn",
};

function world(rpc: Record<string, (args: Record<string, unknown>) => unknown> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  type Fn = (args: Record<string, unknown>) => unknown;
  const handlers: Record<string, Fn> = { consume_source_budget: () => true, record_source_run: () => null, ...rpc };
  const wrap: Record<string, Fn> = {};
  for (const [k, f] of Object.entries(handlers))
    wrap[k] = (args) => {
      calls.push({ fn: k, args });
      return f(args);
    };
  const w = fakeSupabase({ jobs: [], job_sources: [], applications: [], user_settings: [], agent_runs: [], notifications: [] }, { rpc: wrap });
  return { ...w, calls };
}

test("errors are classified: quota, refused key, other", () => {
  assert.equal(classifyError("Quota JSearch atteint pour ce mois (plan gratuit)."), "quota");
  assert.equal(classifyError("HTTP 429 Too Many Requests"), "quota");
  assert.equal(classifyError("Clé Jooble refusée : vérifie la clé reçue par e-mail."), "auth");
  assert.equal(classifyError("Adzuna « x » : HTTP 403"), "auth");
  assert.equal(classifyError("fetch failed: ECONNRESET"), "error");
});

test("free budgets: JSearch per month, Adzuna per day, overridable", () => {
  const now = new Date("2026-09-28T10:00:00Z");
  assert.deepEqual(budgetFor("jsearch", {}, now), { period: "2026-09", limit: 180 });
  assert.deepEqual(budgetFor("adzuna", {}, now), { period: "2026-09-28", limit: 240 });
  assert.deepEqual(budgetFor("jsearch", { JSEARCH_MONTHLY_BUDGET: "50" }, now), { period: "2026-09", limit: 50 });
  assert.equal(budgetFor("francetravail", {}, now), null);
  assert.equal(cacheKey({ a: 1 }), cacheKey({ a: 1 }));
});

test("platform key: every request spends the shared budget; when it runs out the admin is told, the scan goes on", async () => {
  process.env.JSEARCH_API_KEY = "platform-key";
  let requests = 0;
  globalThis.fetch = (async () => (requests++, new Response(JSON.stringify({ data: [JOB] }), { status: 200 }))) as typeof fetch;
  let left = 1;
  const { db, calls } = world({ consume_source_budget: () => left-- > 0 });
  const summary = await runScan({ supabase: db, userId: "u1", env: { JSEARCH_API_KEY: "platform-key" }, cacheDb: null });
  assert.equal(requests, 1);
  const report = summary.reports.find((r) => r.source.startsWith("JSearch"))!;
  assert.equal(report.status, "skipped");
  assert.match(report.message ?? "", /Budget gratuit atteint/);
  const recorded = calls.find((c) => c.fn === "record_source_run" && c.args.p_source === "jsearch")!;
  assert.equal(recorded.args.p_status, "budget");
});

test("a key typed by one account is not charged to the platform budget", async () => {
  delete process.env.JSEARCH_API_KEY;
  globalThis.fetch = (async () => new Response(JSON.stringify({ data: [JOB] }), { status: 200 })) as typeof fetch;
  const { db, calls } = world({ consume_source_budget: () => false });
  const summary = await runScan({ supabase: db, userId: "u1", env: { JSEARCH_API_KEY: "my-own-key" }, cacheDb: null });
  assert.equal(summary.reports.find((r) => r.source.startsWith("JSearch"))!.status, "ok");
  assert.equal(calls.filter((c) => c.fn === "consume_source_budget").length, 0);
});

test("shared cache: the same search for another account does not call the source again", async () => {
  process.env.JSEARCH_API_KEY = "platform-key";
  let requests = 0;
  globalThis.fetch = (async () => (requests++, new Response(JSON.stringify({ data: [JOB] }), { status: 200 }))) as typeof fetch;
  const cache = fakeSupabase({ source_cache: [] });
  const a = world();
  await runScan({ supabase: a.db, userId: "u1", env: { JSEARCH_API_KEY: "platform-key" }, cacheDb: cache.db });
  const afterFirst = requests;
  assert.ok(afterFirst > 0);
  assert.equal(cache.tables.source_cache.length, 1);
  const b = world();
  const second = await runScan({ supabase: b.db, userId: "u2", env: { JSEARCH_API_KEY: "platform-key" }, cacheDb: cache.db });
  assert.equal(requests, afterFirst);
  assert.match(second.reports.find((r) => r.source.startsWith("JSearch"))!.message ?? "", /cache/);
  assert.equal(second.inserted, 1);
  assert.ok(b.calls.some((c) => c.fn === "record_source_run" && c.args.p_cached === true));
});

test("a refused key is recorded as 'auth' so the admin gets an alert", async () => {
  process.env.JOOBLE_API_KEY = "bad";
  globalThis.fetch = (async () => new Response("no", { status: 403 })) as typeof fetch;
  const { db, calls } = world();
  const summary = await runScan({ supabase: db, userId: "u1", env: { JOOBLE_API_KEY: "bad" }, cacheDb: null });
  assert.equal(summary.reports.find((r) => r.source === "Jooble")!.status, "error");
  assert.equal(calls.find((c) => c.fn === "record_source_run" && c.args.p_source === "jooble")!.args.p_status, "auth");
});

test("Recruitee careers pages are recognised and read", () => {
  assert.deepEqual(parseAtsTarget("https://acme.recruitee.com/"), { ats: "recruitee", slug: "acme" });
  const offers = mapAtsJobs({ ats: "recruitee", slug: "acme" }, {
    offers: [
      {
        title: "Stagiaire Data",
        company_name: "Acme",
        city: "Lyon",
        country: "France",
        description: "<p>Analyse de données</p>",
        requirements: "<p>Python</p>",
        careers_url: "https://acme.recruitee.com/o/stagiaire-data",
        careers_apply_url: "https://acme.recruitee.com/o/stagiaire-data/c/new",
        published_at: "2026-09-20 10:00:00 UTC",
        employment_type_code: "internship",
      },
    ],
  });
  assert.equal(offers[0].source, "ats:recruitee");
  assert.equal(offers[0].location, "Lyon, France");
  assert.ok(offers[0].description?.includes("Python"));
});

test("admin page: numbered sources with state, budget, quality, and the manual actions", async () => {
  const now = new Date("2026-09-28T10:00:00Z");
  const { db } = fakeSupabase(
    {
      integrations: [],
      user_settings: [{ user_id: "admin", scan_config: { targets: ["greenhouse:doctolib"] } }],
      source_runs: [
        { source: "jsearch", status: "budget", found: 0, cached: false, message: "Budget gratuit atteint", created_at: "2026-09-28T09:00:00Z" },
        { source: "francetravail", status: "ok", found: 30, cached: false, message: null, created_at: "2026-09-28T09:00:00Z" },
        { source: "ats:greenhouse", status: "ok", found: 5, cached: false, message: null, created_at: "2026-09-28T09:00:00Z" },
      ],
      source_budget: [{ source: "jsearch", period: "2026-09", used: 180 }],
      usage_events: [{ kind: "analysis", created_at: "2026-09-28T08:00:00Z" }, { kind: "generation", created_at: "2026-09-28T08:30:00Z" }],
      notifications: [{ notification_type: "SOURCE_ALERT", title: "Budget gratuit atteint : jsearch", message: "…", created_at: "2026-09-28T09:00:00Z", read_at: null }],
      agent_runs: [],
    },
    {
      rpc: {
        admin_source_stats: () => [{ source: "francetravail", offers: 30, links: 40, analyzed: 20, avg_score: "72.5", strong: 4, suspected: 1, to_review: 2, unreadable: 0 }],
      },
    },
  );
  const env = {
    GEMINI_API_KEY: "x",
    JSEARCH_API_KEY: "x",
    FRANCE_TRAVAIL_CLIENT_ID: "x",
    FRANCE_TRAVAIL_CLIENT_SECRET: "x",
    JOOBLE_API_KEY: "x",
  };
  const o = await buildAdminOverview({ supabase: db, userId: "admin", env, now, worker: { online: true, browserReady: true } });
  assert.equal(o.ai.provider, "Google Gemini");
  assert.equal(o.ai.usageToday.analysis, 1);
  assert.equal(o.sources[0].n, 1);
  const byId = Object.fromEntries(o.sources.map((s) => [s.id, s]));
  assert.equal(byId.francetravail.state, "active");
  assert.equal(byId.francetravail.quality?.avgScore, 72.5);
  assert.equal(byId.jsearch.state, "budget");
  assert.deepEqual(byId.jsearch.budget, { used: 180, limit: 180, period: "2026-09" });
  assert.equal(byId.adzuna.state, "missing_key");
  assert.equal(byId["ats:greenhouse"].companies, 1);
  assert.equal(byId["ats:lever"].state, "idle");
  assert.equal(o.alerts.length, 1);
  assert.ok(o.actions.some((a) => /CRON_SECRET/.test(a.text)));
  assert.ok(o.actions.some((a) => a.level === "recommended" && /JSearch/.test(a.text)));
  assert.ok(!o.actions.some((a) => a.level === "required"));
});

test("admin page: Marché du travail and Accès à l'emploi are 'à terminer' until set; Open Formation is never nagged about", async () => {
  const { db } = fakeSupabase({ integrations: [], user_settings: [], source_runs: [], source_budget: [], usage_events: [], notifications: [], agent_runs: [] });
  const baseEnv = { GEMINI_API_KEY: "x", FRANCE_TRAVAIL_CLIENT_ID: "id", FRANCE_TRAVAIL_CLIENT_SECRET: "secret" };
  const notReady = await buildAdminOverview({ supabase: db, userId: "admin", env: baseEnv, now: new Date("2026-09-29T10:00:00Z") });
  assert.equal(notReady.enrichment.length, 3);
  assert.ok(notReady.enrichment.every((e) => !e.ready));
  const formation = notReady.enrichment.find((e) => e.id === "ft:formation")!;
  assert.equal(formation.unused, true);
  assert.deepEqual(formation.missing, []);
  const nudge = notReady.actions.find((a) => a.level === "recommended" && /API France Travail secondaires/.test(a.text))!;
  assert.match(nudge.text, /Marché du travail/);
  assert.doesNotMatch(nudge.text, /Open Formation/);
  // The confirmed values are there to be copied.
  assert.match(notReady.enrichment.find((e) => e.id === "ft:marche")!.urlValue!, /stat-demandeurs$/);

  const ready = await buildAdminOverview({
    supabase: db,
    userId: "admin",
    now: new Date("2026-09-29T10:00:00Z"),
    env: {
      ...baseEnv,
      FRANCE_TRAVAIL_MARCHE_SCOPE: "api_marcheDuTravailv1 marcheDuTravail",
      FRANCE_TRAVAIL_MARCHE_URL: "https://api.francetravail.io/partenaire/marche-travail/v1/stats",
      FRANCE_TRAVAIL_ACCES_EMPLOI_SCOPE: "api_accesEmploiv1 accesEmploi",
      FRANCE_TRAVAIL_ACCES_EMPLOI_URL: "https://api.francetravail.io/partenaire/acces-emploi/v1/taux",
    },
  });
  assert.ok(ready.enrichment.every((e) => e.ready || e.unused));
  assert.ok(!ready.actions.some((a) => /API France Travail secondaires/.test(a.text)));
});
