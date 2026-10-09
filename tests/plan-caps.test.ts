import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PLAN_CODE, PLAN_MONTHLY_CODE, PRO_DEFAULTS, checkMonthlyCap, checkPlan, planUsage, proCap, recordKit } from "../lib/plan";
import { fakeSupabase } from "./fake-supabase";

const now = new Date("2026-10-15T10:00:00Z");
const inMonth = "2026-10-05T10:00:00Z";
const lastMonth = "2026-09-20T10:00:00Z";

const world = (opts: { plan?: "free" | "pro"; admin?: boolean; docs?: string[]; kits?: string[]; events?: { kind: string; created_at: string }[]; missing?: string[] } = {}) =>
  fakeSupabase(
    {
      app_admins: [],
      user_settings: [{ user_id: "u1", plan: opts.plan ?? "free" }],
      documents: (opts.docs ?? []).map((job_id) => ({ user_id: "u1", job_id, kind: "TAILORED_CV", created_at: inMonth })),
      usage_events: [
        ...(opts.kits ?? []).map((job_id) => ({ user_id: "u1", kind: "kit", job_id, created_at: inMonth })),
        ...(opts.events ?? []).map((e) => ({ user_id: "u1", ...e })),
      ],
    },
    {
      missingTables: opts.missing,
      rpc: { is_admin: () => Boolean(opts.admin) },
    },
  );
const jobs = (n: number, prefix = "j") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

test("PRO CEILINGS — defaults 30 / 90 / 600, the environment may change them, 0 or nonsense is never 'unlimited'", () => {
  assert.deepEqual(PRO_DEFAULTS, { kits: 30, revisions: 90, analyses: 600 });
  assert.equal(proCap("kits", {}), 30);
  assert.equal(proCap("kits", { PRO_KITS_PER_MONTH: "12" }), 12);
  assert.equal(proCap("revisions", { PRO_REVISIONS_PER_MONTH: "45.9" }), 45);
  for (const bad of ["0", "-3", "abc", "", "  ", "NaN"]) assert.equal(proCap("analyses", { PRO_ANALYSES_PER_MONTH: bad }), 600, bad);
});

test("KITS — a paid account stops at its monthly ceiling; rewriting an offer already done this month stays free; the administrator is not capped", async () => {
  const full = world({ plan: "pro", docs: jobs(30) });
  const refused = await checkPlan(full.db, "u1", "new", {}, now);
  assert.ok(!refused.ok && refused.status === 402 && refused.body.code === PLAN_CODE);
  assert.match(!refused.ok ? refused.body.error : "", /Formule Plus : 30 dossiers/);
  assert.deepEqual(await checkPlan(full.db, "u1", "j3", {}, now), { ok: true });
  const almost = world({ plan: "pro", docs: jobs(29) });
  assert.deepEqual(await checkPlan(almost.db, "u1", "new", {}, now), { ok: true });
  assert.ok(!(await checkPlan(world({ plan: "pro", docs: jobs(2) }).db, "u1", "new", { PRO_KITS_PER_MONTH: "2" }, now)).ok);
  // Last month's kits do not count.
  const old = fakeSupabase({ app_admins: [], user_settings: [{ user_id: "u1", plan: "pro" }], documents: jobs(40).map((job_id) => ({ user_id: "u1", job_id, kind: "TAILORED_CV", created_at: lastMonth })), usage_events: [] }, { rpc: { is_admin: () => false } });
  assert.deepEqual(await checkPlan(old.db, "u1", "new", {}, now), { ok: true });
  assert.deepEqual(await checkPlan(world({ plan: "pro", admin: true, docs: jobs(99) }).db, "u1", "new", {}, now), { ok: true });
  // The paid plan still lets the automatic pipeline work (the free plan does not).
  assert.deepEqual(await checkPlan(world({ plan: "pro" }).db, "u1", "x", {}, now, true), { ok: true });
});

test("KITS — deleting the documents does not give the allowance back: the server-held lines still count (free and paid)", async () => {
  const free = world({ plan: "free", docs: [], kits: ["a", "b"] });
  const refused = await checkPlan(free.db, "u1", "c", {}, now);
  assert.ok(!refused.ok && refused.status === 402);
  assert.deepEqual(await checkPlan(free.db, "u1", "a", {}, now), { ok: true }, "an offer already counted stays free to rewrite");
  const pro = world({ plan: "pro", docs: [], kits: jobs(30) });
  assert.ok(!(await checkPlan(pro.db, "u1", "new", {}, now)).ok);
  // One offer seen by both witnesses counts once.
  const both = world({ plan: "free", docs: ["a"], kits: ["a"] });
  assert.equal((await planUsage(both.db, "u1", {}, now)).used, 1);
  const usage = await planUsage(pro.db, "u1", {}, now);
  assert.deepEqual([usage.plan, usage.used, usage.limit], ["pro", 30, 30]);
});

test("KITS — before the migration (no job_id column / kind refused) the documents are still counted, and an unreadable counter stops paid work", async () => {
  const before = world({ plan: "free", docs: ["a", "b"], missing: ["usage_events"] });
  assert.ok(!(await checkPlan(before.db, "u1", "c", {}, now)).ok, "documents alone still enforce the free plan");
  const blind = fakeSupabase({ app_admins: [], user_settings: [{ user_id: "u1", plan: "pro" }], usage_events: [] }, { missingTables: ["documents"], rpc: { is_admin: () => false } });
  const stopped = await checkPlan(blind.db, "u1", "c", {}, now);
  assert.ok(!stopped.ok && stopped.status === 503 && stopped.body.code === "PLAN_UNAVAILABLE");
});

test("RECORD — one server-held line per offer and month, never an exception", async () => {
  // j1 already has its line this month (the database stamps created_at; the fake needs it written).
  const w = world({ plan: "free", kits: ["j1"] });
  await recordKit(w.db, "u1", "j1", now);
  await recordKit(w.db, "u1", "j2", now);
  assert.deepEqual(w.tables.usage_events.filter((e) => e.kind === "kit").map((e) => e.job_id), ["j1", "j2"]);
  assert.deepEqual(w.tables.usage_events.find((e) => e.job_id === "j2"), { id: "usage_events-1", user_id: "u1", kind: "kit", job_id: "j2" });
  await recordKit(world({ missing: ["usage_events"] }).db, "u1", "j1", now);
});

test("MONTHLY CAPS — a paid account has 90 revisions and 600 analyses a month; the free plan and the administrator are left to the daily limits", async () => {
  const events = (kind: string, n: number) => Array.from({ length: n }, () => ({ kind, created_at: inMonth }));
  const pro90 = world({ plan: "pro", events: events("revision", 90) });
  const refused = await checkMonthlyCap(pro90.db, "u1", "revision", {}, now);
  assert.ok(!refused.ok && refused.status === 429 && refused.body.code === PLAN_MONTHLY_CODE);
  assert.deepEqual(await checkMonthlyCap(world({ plan: "pro", events: events("revision", 89) }).db, "u1", "revision", {}, now), { ok: true });
  assert.ok(!(await checkMonthlyCap(world({ plan: "pro", events: events("analysis", 5) }).db, "u1", "analysis", { PRO_ANALYSES_PER_MONTH: "5" }, now)).ok);
  assert.deepEqual(await checkMonthlyCap(world({ plan: "pro", events: events("analysis", 599) }).db, "u1", "analysis", {}, now), { ok: true });
  assert.deepEqual(await checkMonthlyCap(world({ plan: "free", events: events("revision", 500) }).db, "u1", "revision", {}, now), { ok: true });
  assert.deepEqual(await checkMonthlyCap(world({ plan: "pro", admin: true, events: events("revision", 500) }).db, "u1", "revision", {}, now), { ok: true });
  // Last month's uses do not count.
  assert.deepEqual(await checkMonthlyCap(world({ plan: "pro", events: Array.from({ length: 200 }, () => ({ kind: "revision", created_at: lastMonth })) }).db, "u1", "revision", {}, now), { ok: true });
  const unreadable = await checkMonthlyCap(world({ plan: "pro", missing: ["usage_events"] }).db, "u1", "analysis", {}, now);
  assert.ok(!unreadable.ok && unreadable.status === 503);
});

test("WIRING — the kit is recorded after the documents are saved; the ceilings run before the paid call; nothing here takes a payment or sets a plan", () => {
  const generate = readFileSync("lib/pipeline/generate.ts", "utf8");
  assert.ok(generate.indexOf("recordKit(") > generate.indexOf('from("documents").insert(docs)'));
  const analyze = readFileSync("lib/pipeline/analyze.ts", "utf8");
  assert.ok(analyze.indexOf('checkMonthlyCap(ctx.supabase, ctx.userId, "analysis"') < analyze.indexOf('consumeQuota(ctx.supabase, ctx.userId, "analysis"'));
  const revise = readFileSync("app/api/documents/[id]/revise/route.ts", "utf8");
  assert.ok(revise.indexOf('checkMonthlyCap(supabase, userId, "revision")') < revise.indexOf("consumeRevisionQuota(supabase, userId)"));
  const plan = readFileSync("lib/plan.ts", "utf8");
  assert.doesNotMatch(plan, /stripe|payment_intent|plan: "pro"|update\(\{ plan/i);
});
