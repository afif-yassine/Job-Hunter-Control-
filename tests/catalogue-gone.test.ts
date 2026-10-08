import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { analyzeJob } from "../lib/pipeline/analyze";
import { closedInCatalogue } from "../lib/pipeline/availability";
import { generateForJob } from "../lib/pipeline/generate";
import { fakeSupabase } from "./fake-supabase";

const ai = async () => { throw new Error("no AI call expected"); };
// The student cleared the marker on their own row (gone_reason is null) and the row says the offer is analysed.
const job = { id: "j1", user_id: "u1", offer_id: "o1", status: "ANALYZED", gone_reason: null, review_flag: null, title: "Stage dev", company: "Acme", description: "Développer des outils." };
const profile = { user_id: "u1", profile: { skills: ["sql"] }, truth_ledger: {} };
const world = (status: string | null) =>
  fakeSupabase({ jobs: [{ ...job }], candidate_profiles: [profile], offers: status === null ? [] : [{ id: "o1", status }], documents: [], ai_usage: [], usage_events: [] });

test("an offer closed in the shared catalogue stays closed even if the student cleared the marker on their own row", async () => {
  for (const status of ["closed", "expired"]) {
    const { db, tables } = world(status);
    const generated = await generateForJob({ supabase: db, userId: "u1", jobId: "j1", ai });
    assert.equal(generated.status, 410, `generation, catalogue says ${status}`);
    assert.equal(generated.body.code, "GONE");
    const analysed = await analyzeJob({ supabase: db, userId: "u1", jobId: "j1", ai });
    assert.equal(analysed.status, 410, `analysis, catalogue says ${status}`);
    assert.equal(analysed.body.code, "GONE");
    // Nothing was written or spent.
    assert.deepEqual(tables.documents, []);
    assert.deepEqual(tables.ai_usage, []);
    assert.deepEqual(tables.usage_events, []);
  }
});

test("an open offer, or one the catalogue cannot tell about, is not blocked by this check", async () => {
  for (const status of ["open", null]) {
    const { db } = world(status);
    assert.notEqual((await generateForJob({ supabase: db, userId: "u1", jobId: "j1", ai })).status, 410, `catalogue says ${status}`);
  }
  assert.equal(await closedInCatalogue(world("open").db, { offer_id: "o1" }), false);
  assert.equal(await closedInCatalogue(world("closed").db, { offer_id: null }), false);
  assert.equal(await closedInCatalogue(world("closed").db, {}), false);
  const unreadable = fakeSupabase({}, { missingTables: ["offers"] });
  assert.equal(await closedInCatalogue(unreadable.db, { offer_id: "o1" }), false);
  assert.equal(await closedInCatalogue(world("closed").db, { offer_id: "o1" }), true);
});

test("« Elle est toujours en ligne » cannot put back an offer the catalogue has closed", () => {
  const route = readFileSync("app/api/jobs/[id]/availability/route.ts", "utf8");
  const check = route.indexOf("closedInCatalogue(auth.supabase, own)");
  assert.ok(check > 0, "the route must ask the catalogue");
  assert.ok(check < route.indexOf("gone_reason: null"), "the catalogue is asked before the marker is cleared");
  assert.match(route, /status: 409/);
});

test("when the catalogue refuses, the student's own copy is marked gone: once, without touching the shared catalogue, and never as a 500", async () => {
  for (const step of ["generate", "analyze"] as const) {
    const { db, tables } = world("closed");
    const offersBefore = JSON.stringify(tables.offers);
    const run = () => (step === "generate" ? generateForJob({ supabase: db, userId: "u1", jobId: "j1", ai }) : analyzeJob({ supabase: db, userId: "u1", jobId: "j1", ai }));
    assert.equal((await run()).status, 410);
    const first = { reason: tables.jobs[0].gone_reason, at: tables.jobs[0].gone_at };
    assert.match(String(first.reason), /catalogue commun/);
    assert.ok(first.at, `${step}: the date is written`);
    // A second refusal changes nothing, and the shared catalogue is never written.
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal((await run()).status, 410);
    assert.deepEqual({ reason: tables.jobs[0].gone_reason, at: tables.jobs[0].gone_at }, first);
    assert.equal(JSON.stringify(tables.offers), offersBefore);

    // A failing write is not an error for the student: still a clean 410.
    const failing = fakeSupabase({ jobs: [{ ...job }], candidate_profiles: [profile], offers: [{ id: "o1", status: "closed" }] }, { missingColumns: ["gone_reason"] });
    const again = step === "generate"
      ? await generateForJob({ supabase: failing.db, userId: "u1", jobId: "j1", ai })
      : await analyzeJob({ supabase: failing.db, userId: "u1", jobId: "j1", ai });
    assert.equal(again.status, 410);
    assert.equal(again.body.code, "GONE");
  }
});
