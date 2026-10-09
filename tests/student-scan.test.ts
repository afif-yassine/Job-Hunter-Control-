import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { runServerTick } from "../lib/pipeline/server";
import { runScan } from "../lib/scan";
import { studentCatalogueOnly } from "../lib/scan/config";
import { fakeSupabase } from "./fake-supabase";

const realFetch = globalThis.fetch;
const realKey = process.env.JSEARCH_API_KEY;
const realHook = process.env.SCAN_WEBHOOK_URL;
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.JSEARCH_API_KEY; else process.env.JSEARCH_API_KEY = realKey;
  if (realHook === undefined) delete process.env.SCAN_WEBHOOK_URL; else process.env.SCAN_WEBHOOK_URL = realHook;
});

const HOOK = "https://hooks.example.test/scan";
const ALL_KEYS = {
  JSEARCH_API_KEY: "k", ADZUNA_APP_ID: "a", ADZUNA_APP_KEY: "b", JOOBLE_API_KEY: "j", LBA_API_KEY: "l",
  FRANCE_TRAVAIL_CLIENT_ID: "x", FRANCE_TRAVAIL_CLIENT_SECRET: "y",
  GMAIL_CLIENT_ID: "g", GMAIL_CLIENT_SECRET: "s", GMAIL_REFRESH_TOKEN: "r",
  SCAN_WEBHOOK_URL: HOOK,
};
const now = new Date().toISOString();
const offer = (id: string, over: Record<string, unknown> = {}) => ({
  id, fingerprint: `fp${id}`, title: "Alternance Ingénieur DevOps", company: `C${id}`, location: "Paris", contract_type: "Contrat apprentissage",
  source: "francetravail", url: `https://x.test/${id}`, apply_url: null, published_at: now.slice(0, 10), rome_code: "M1827", board: null,
  categories: ["devops"], contract_kind: "alternance", status: "open", last_seen_at: now,
  description: "Mise en place de pipelines CI/CD et d’infrastructure cloud en alternance.",
  ...over,
});
const search = { contracts: ["alternance"], categories: ["devops"], keywords: ["développeur"], city: "Paris", departments: ["75"] };
const names = (reports: { source: string }[]) => reports.map((r) => r.source).join(" | ");
const jobSite = (url: string) => !url.includes("hooks.example.test") && !url.includes("api.lever.co");

function watch() {
  const seen: { url: string; body: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, body: String(init?.body ?? "") });
    if (url.includes("api.lever.co/v0/postings/acme"))
      return new Response(JSON.stringify([{ text: "Alternance développeur", hostedUrl: "https://jobs.lever.co/acme/2", categories: { location: "Paris" }, descriptionPlain: "Développement web en alternance au sein de l’équipe produit." }]));
    if (url.includes("hooks.example.test")) return new Response("[]");
    return new Response(JSON.stringify({ data: [], jobs: [], results: [] }), { status: 200 });
  }) as typeof fetch;
  return seen;
}

function world(extra: Record<string, Record<string, unknown>[]> = {}, scanConfig: unknown = search) {
  const rpcCalls: string[] = [];
  const account = fakeSupabase(
    {
      offers: [offer("1"), offer("2")],
      jobs: [], job_sources: [], applications: [], agent_runs: [], notifications: [],
      user_settings: [{ user_id: "u1", auto_scan: true, last_scan_at: null, scan_config: scanConfig }],
      ...extra,
    },
    { rpc: { record_source_run: () => (rpcCalls.push("run"), null), consume_source_budget: () => (rpcCalls.push("budget"), true) } },
  );
  return { ...account, rpcCalls };
}

test("PRIVACY — a student's search never uses the operator's mailbox or the webhook, and sends no account id; job sites are still called", async () => {
  const seen = watch();
  const { db } = world();
  const summary = await runScan({ supabase: db, userId: "u1", env: ALL_KEYS, cacheDb: null, student: true });
  assert.ok(!seen.some((r) => r.url.includes("hooks.example.test")), "the webhook is not called");
  assert.ok(!JSON.stringify(seen).includes("u1"), "no account id leaves the application");
  assert.ok(!/Gmail|Scanner externe/.test(names(summary.reports)), names(summary.reports));
  // Unchanged for now: the job sites are still called for a student.
  assert.ok(seen.some((r) => jobSite(r.url)), "job sites are still searched");
  assert.ok(summary.reports.some((r) => /JSearch/.test(r.source)));
});

test("PRIVACY — the administrator's search keeps the mailbox and the webhook, with the account id", async () => {
  const seen = watch();
  const { db } = world();
  // The webhook address is read from the process environment, as in production.
  process.env.SCAN_WEBHOOK_URL = HOOK;
  const env = { JSEARCH_API_KEY: "k", SCAN_WEBHOOK_URL: HOOK };
  await runScan({ supabase: db, userId: "u1", env, cacheDb: null });
  const hook = seen.find((r) => r.url.includes("hooks.example.test"));
  assert.ok(hook, "the webhook is called for the administrator's own account");
  assert.match(hook.body, /"user_id":"u1"/);
  assert.ok(seen.some((r) => jobSite(r.url)));
});

test("PRIVACY — companies learnt from the catalogue are the collection's job: a student does not read them, the administrator does", async () => {
  const extra = { offers: [offer("1", { board: "lever:acme" }), offer("2", { board: "lever:other" })] };
  const student = watch();
  await runScan({ supabase: world({ ...extra }).db, userId: "u1", env: {}, cacheDb: null, student: true });
  assert.ok(!student.some((r) => /lever\.co\/v0\/postings\/other/.test(r.url)), "no catalogue board for a student");
  const admin = watch();
  await runScan({ supabase: world({ ...extra }).db, userId: "u1", env: {}, cacheDb: null });
  assert.ok(admin.some((r) => /lever\.co\/v0\/postings\/other/.test(r.url)), "the administrator still reads them");
});

test("CATALOGUE ONLY — no job site, Gmail or webhook is called, even with every key configured", async () => {
  const seen = watch();
  const { db, tables, rpcCalls } = world();
  const summary = await runScan({ supabase: db, userId: "u1", env: ALL_KEYS, cacheDb: null, catalogueOnly: true });
  assert.equal(summary.configured, true);
  assert.equal(summary.inserted, 2);
  assert.deepEqual(tables.jobs.map((j) => j.offer_id).sort(), ["1", "2"]);
  assert.deepEqual(seen, [], "no outgoing request at all");
  assert.deepEqual(rpcCalls, [], "no shared budget or source health is touched");
  assert.ok(!/Gmail|Scanner externe|JSearch|Adzuna|Jooble|France Travail|bonne alternance/i.test(names(summary.reports)), names(summary.reports));
  assert.ok(summary.reports.some((r) => r.source === "Sources d’emploi externes" && r.status === "skipped"));
});

test("CATALOGUE ONLY — a company the student typed is still read; learnt companies are not", async () => {
  const learnt = { items: [{ key: "greenhouse:zeta", company: "Zeta", via: "jsearch:x", url: "https://x.test/z", seen_at: now, last_seen_at: now }], ignored: [] };
  const extra = { offers: [offer("1", { board: "lever:acme" }), offer("2", { board: "lever:other" })] };
  const config = { ...search, targets: ["lever:acme"] };
  const run = async (catalogueOnly: boolean) => {
    const seen = watch();
    const w = world({ ...extra }, config);
    w.tables.user_settings[0].discovered_targets = learnt;
    const summary = await runScan({ supabase: w.db, userId: "u1", env: {}, cacheDb: null, catalogueOnly });
    return { seen, summary, w };
  };
  const only = await run(true);
  assert.ok(only.seen.some((r) => r.url.includes("api.lever.co/v0/postings/acme")), "the explicit target is read");
  assert.ok(!only.seen.some((r) => /other|zeta/.test(r.url)), "no learnt board is read");
  assert.equal(only.seen.length, 1);
  assert.ok(only.summary.reports.some((r) => r.source.startsWith("Pages carrière") && r.status === "ok"));
  assert.ok(only.w.tables.jobs.length >= 1);
  // The difference is the option, not the data: the same account run in full reads the learnt boards.
  const full = await run(false);
  assert.ok(full.seen.some((r) => /other|zeta/.test(r.url)));
});

test("SWITCH — catalogue-only for students is off unless STUDENT_CATALOGUE_ONLY is exactly 1", () => {
  assert.equal(studentCatalogueOnly({}), false);
  for (const value of ["", "0", "true", "yes", "2"]) assert.equal(studentCatalogueOnly({ STUDENT_CATALOGUE_ONLY: value }), false, value);
  assert.equal(studentCatalogueOnly({ STUDENT_CATALOGUE_ONLY: "1" }), true);
  assert.equal(studentCatalogueOnly({ STUDENT_CATALOGUE_ONLY: " 1 " }), true);
});

test("SERVER RUN — a student account never reaches the webhook; with the switch on it reaches no job site either; the administrator keeps both", async () => {
  process.env.JSEARCH_API_KEY = "k";
  process.env.SCAN_WEBHOOK_URL = HOOK;
  const run = async (admins: Record<string, unknown>[], env: Record<string, string>) => {
    const seen = watch();
    const { db } = world({ app_admins: admins, candidate_profiles: [] });
    const ai = async () => { throw new Error("no AI call expected"); };
    await runServerTick({ supabase: db, env, ai, fetchPage: async () => null });
    return seen;
  };
  const student = await run([], {});
  assert.ok(!student.some((r) => r.url.includes("hooks.example.test")), "no webhook for a student");
  assert.ok(student.some((r) => jobSite(r.url)), "job sites still searched while the switch is off");
  assert.deepEqual(await run([], { STUDENT_CATALOGUE_ONLY: "1" }), []);
  const admin = await run([{ user_id: "u1" }], { STUDENT_CATALOGUE_ONLY: "1" });
  assert.ok(admin.some((r) => r.url.includes("hooks.example.test")) && admin.some((r) => jobSite(r.url)));
  // An unreadable list of administrators makes nobody one.
  const seen = watch();
  const { db } = fakeSupabase({
    user_settings: [{ user_id: "u1", auto_scan: true, last_scan_at: null, scan_config: search }],
    offers: [offer("1")], jobs: [], job_sources: [], applications: [], agent_runs: [], notifications: [],
  }, { missingTables: ["app_admins"] });
  await runServerTick({ supabase: db, env: { STUDENT_CATALOGUE_ONLY: "1" }, ai: async () => { throw new Error("no AI call expected"); }, fetchPage: async () => null });
  assert.deepEqual(seen, []);
});

test("ROUTE — the scan route decides on the server and spends no quota only for a catalogue-only update", () => {
  const route = readFileSync("app/api/scan/route.ts", "utf8");
  const admin = route.indexOf("await isAdmin(auth.supabase)");
  assert.ok(admin > 0 && admin < route.indexOf("consumeQuota(auth.supabase"), "the administrator is determined before the quota");
  assert.match(route, /const catalogueOnly = !admin && \(studentCatalogueOnly\(\) \|\| gate\.active\)/);
  assert.match(route, /if \(!catalogueOnly\) \{\s*const quota = await consumeQuota/);
  assert.match(route, /student: !admin,\s*catalogueOnly,/);
  assert.doesNotMatch(route, /student: body|catalogueOnly: body/);
});
