import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runPipeline } from "../lib/pipeline-client";

type Row = Record<string, unknown>;

/** Just enough of supabase-js for the pipeline: one user, a jobs list, recorded inserts. */
function stub(jobs: Row[]) {
  const inserted: { table: string; row: Row }[] = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        insert: (row: Row) => (inserted.push({ table, row }), Promise.resolve({ error: null })),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === "jobs" ? jobs : [], error: null }).then(resolve),
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { db, inserted };
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function route(handlers: Record<string, (url: string, body: unknown) => Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const path = String(url);
    calls.push(path);
    const key = Object.keys(handlers).find((k) => path.includes(k));
    if (!key) throw new Error(`unexpected call ${path}`);
    return handlers[key](path, init?.body ? JSON.parse(String(init.body)) : {});
  }) as typeof fetch;
  return calls;
}

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const job = (id: string, extra: Row = {}) => ({
  id,
  company: `Co${id}`,
  title: "Alternant dev",
  description: "x".repeat(200),
  official_url: "https://example.com",
  source_url: null,
  last_checked_at: null,
  ...extra,
});

test("pipeline: scan → analyse → write documents for strong offers → read forms", async () => {
  const { db, inserted } = stub([job("1"), job("2")]);
  const calls = route({
    "/api/scan": () => reply({ found: 9, inserted: 4, duplicates: 5, needsDescription: 0, reports: [] }),
    "/analyze": (url) => reply({ total: url.includes("/1/") ? 91 : 55 }),
    "/generate": () => reply({ documents: [{}, {}], applicationId: "app-1", questionStats: { asked: 1 } }),
    "/api/worker/dispatch": () => reply({ fields: [{}], questions: [] }),
  });
  const report = await runPipeline({ supabase: db, scan: true, prepare: true });
  assert.equal(report.inserted, 4);
  assert.equal(report.analyzed, 2);
  assert.equal(report.strong, 1);
  assert.equal(report.generated, 1);
  assert.equal(report.prepared, 1);
  assert.equal(report.questions, 1);
  assert.equal(report.issues.length, 0);
  assert.equal(calls.filter((c) => c.includes("/generate")).length, 1);
  const run = inserted.find((i) => i.table === "agent_runs")!.row;
  assert.equal(run.run_type, "PIPELINE");
  assert.equal(run.status, "COMPLETED");
  assert.ok(inserted.some((i) => i.table === "notifications" && i.row.notification_type === "PIPELINE_DONE"));
});

test("pipeline: without a connected source it still processes waiting offers and says so", async () => {
  const { db } = stub([job("1")]);
  route({
    "/api/scan": () => reply({ error: "Aucune source", configured: false }, 503),
    "/analyze": () => reply({ total: 40 }),
  });
  const report = await runPipeline({ supabase: db, scan: true, prepare: true });
  assert.equal(report.noSource, true);
  assert.equal(report.analyzed, 1);
  assert.equal(report.issues.length, 0);
});

test("pipeline: a dead worker stops the form step after one explained failure", async () => {
  const { db, inserted } = stub([job("1"), job("2"), job("3")]);
  let dispatches = 0;
  route({
    "/analyze": () => reply({ total: 90 }),
    "/generate": (url) => reply({ documents: [{}], applicationId: `app-${url}`, questionStats: {} }),
    "/api/worker/dispatch": () => (dispatches++, reply({ error: "Worker Playwright injoignable (fetch failed)." }, 502)),
  });
  const report = await runPipeline({ supabase: db, scan: false, prepare: true });
  assert.equal(report.generated, 3);
  assert.equal(dispatches, 1);
  assert.equal(report.prepared, 0);
  assert.equal(report.issues.length, 1);
  assert.match(report.issues[0].title, /ne répond pas/);
  // Documents were still produced, so the run is not a failure.
  assert.equal(inserted.find((i) => i.table === "agent_runs")!.row.status, "COMPLETED");
});

test("pipeline: quota error stops analysing, unreadable ads are counted not failed", async () => {
  const { db } = stub([job("1", { description: null }), job("2"), job("3"), job("4")]);
  let analysed = 0;
  route({
    "/analyze": (url) => {
      analysed += 1;
      if (url.includes("/1/"))
        return reply({ error: "Impossible de lire l’annonce automatiquement : ouvre l’offre" }, 400);
      return reply({ error: "429 RESOURCE_EXHAUSTED quota" }, 502);
    },
  });
  const report = await runPipeline({ supabase: db, scan: false, prepare: false });
  assert.equal(report.needsDescription, 1);
  assert.ok(analysed <= 3, `stopped early (${analysed} calls)`);
  assert.equal(report.analyzed, 0);
  assert.ok(report.issues.length >= 1);
});

test("pipeline: offers we could not read recently are not retried every run", async () => {
  const recent = new Date(Date.now() - 3_600_000).toISOString();
  const { db } = stub([job("1", { description: null, last_checked_at: recent })]);
  const calls = route({});
  const report = await runPipeline({ supabase: db, scan: false, prepare: false });
  assert.equal(calls.length, 0);
  assert.equal(report.needsDescription, 1);
});
