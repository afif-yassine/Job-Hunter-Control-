import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { generateForJob } from "../lib/pipeline/generate";
import { seedFromCatalogue } from "../lib/scan";
import { OFFER_LOCKED, ensureDailyBatch, offerLocked, unlockGate, unlockedState } from "../lib/unlock";
import { fakeSupabase } from "./fake-supabase";

const U = "u1";
const day1 = new Date("2026-10-10T10:00:00Z");
const day2 = new Date("2026-10-11T10:00:00Z");
const iso = (d: Date) => d.toISOString();

const offer = (n: number, over: Record<string, unknown> = {}) => ({
  id: `o${n}`, fingerprint: `fp${n}`, title: `Alternance DevOps ${n}`, company: `Societe ${n}`, location: "Paris", contract_type: "Contrat apprentissage",
  source: "francetravail", url: `https://x.test/${n}`, apply_url: null, published_at: "2026-10-09", rome_code: "M1827", board: null,
  categories: ["devops"], contract_kind: "alternance", status: "open", last_seen_at: "2026-10-10T09:00:00Z",
  description: "Mise en place de pipelines CI/CD, Docker et Kubernetes en alternance dans une équipe plateforme.",
  summary: { skills: ["docker", "kubernetes", "python"] },
  ...over,
});

/** A world with `count` good offers; the in-memory rpc mimics claim_daily_unlock (same rules as the SQL). */
function world(opts: { count?: number; offers?: Record<string, unknown>[]; admin?: boolean; settings?: unknown; profile?: boolean; missingUnlocks?: boolean } = {}) {
  let dbDay = "2026-10-10";
  const data: Record<string, Record<string, unknown>[]> = {
    offers: opts.offers ?? Array.from({ length: opts.count ?? 12 }, (_, i) => offer(i + 1)),
    offer_unlocks: [], jobs: [], job_sources: [], applications: [], documents: [], agent_runs: [], notifications: [],
    app_admins: opts.admin ? [{ user_id: U }] : [],
    user_settings: [{ user_id: U, scan_config: opts.settings ?? { contracts: ["alternance"], categories: ["devops"], keywords: [], city: "", departments: [] } }],
    candidate_profiles: opts.profile === false ? [] : [{ user_id: U, profile: { skills: ["Docker", "Kubernetes", "Python"] }, skills: ["docker", "kubernetes", "python"], semantic_hash: "h" }],
  };
  const claims: string[][] = [];
  const f = fakeSupabase(data, {
    missingTables: opts.missingUnlocks ? ["offer_unlocks"] : undefined,
    rpc: {
      match_offers_for_me_v2: () => data.offers.map((o, i) => ({ offer_id: o.id, similarity: 0.9 - i / 100, model: "perplexity/pplx-embed-v1-0.6b@retrieval-v1" })),
      claim_daily_unlock: (args) => {
        const ids = args.p_offer_ids as string[];
        if (data.offer_unlocks.some((r) => r.user_id === args.p_user && r.origin === "daily" && r.unlocked_on === dbDay)) return [];
        const take = ids
          .filter((id) => data.offers.some((o) => o.id === id && o.status === "open") && !data.offer_unlocks.some((r) => r.user_id === args.p_user && r.offer_id === id))
          .slice(0, Math.min(Number(args.p_limit), 8));
        for (const id of take) data.offer_unlocks.push({ user_id: args.p_user, offer_id: id, unlocked_on: dbDay, origin: "daily" });
        claims.push(take);
        return take.map((id) => ({ o_offer_id: id }));
      },
    },
  });
  return { ...f, data, claims, setDay: (d: string) => (dbDay = d) };
}

test("TABLE ABSENT — the site behaves as before: nothing is locked, the route says NOT_READY, scan and kits are untouched", async () => {
  const w = world({ missingUnlocks: true });
  assert.deepEqual(await unlockGate(w.db, U, w.db), { active: false });
  assert.deepEqual(await unlockedState(w.db, U, day1, w.db), { mode: "not_ready" });
  assert.equal(await offerLocked(w.db, U, { offer_id: "o1" }), false);
  // The existing search path still copies the whole catalogue answer, as before the feature.
  const inserted = await seedFromCatalogue(w.db, U, { refreshVector: false, service: w.db });
  assert.ok(inserted > 8, `copied ${inserted}`);
});

test("ADMIN — never locked, sees everything", async () => {
  const w = world({ admin: true });
  assert.deepEqual(await unlockedState(w.db, U, day1, w.db), { mode: "all" });
  assert.equal(await offerLocked(w.db, U, { offer_id: "o1" }), false);
  const inserted = await seedFromCatalogue(w.db, U, { refreshVector: false, service: w.db });
  assert.ok(inserted > 8);
});

test("DAILY LOT — 8 offers and their copies on the first visit, none again the same day, 4 new ones the next day, never twice", async () => {
  const w = world({ count: 12 });
  const first = await unlockedState(w.db, U, day1, w.db);
  assert.equal(first.mode, "list");
  if (first.mode !== "list") return;
  assert.equal(first.newToday, 8);
  assert.equal(first.unlocked.length, 8);
  assert.ok(first.unlocked.every((e) => e.origin === "daily" && e.unlockedOn === "2026-10-10"));
  assert.equal(w.data.jobs.length, 8, "only the unlocked offers are copied into the list");
  assert.deepEqual([...w.data.jobs.map((j) => j.offer_id)].sort(), ["o1", "o2", "o3", "o4", "o5", "o6", "o7", "o8"], "best similarity first");
  const again = await unlockedState(w.db, U, day1, w.db);
  assert.ok(again.mode === "list" && again.newToday === 0 && again.unlocked.length === 8);
  w.setDay("2026-10-11");
  const next = await unlockedState(w.db, U, day2, w.db);
  assert.ok(next.mode === "list" && next.newToday === 4 && next.unlocked.length === 12);
  assert.equal(new Set(w.data.offer_unlocks.map((r) => r.offer_id)).size, 12);
  assert.equal(w.data.jobs.length, 12);
  // The earlier day keeps its date: the front groups by it.
  assert.deepEqual(next.mode === "list" ? [...new Set(next.unlocked.map((e) => e.unlockedOn))].sort() : [], ["2026-10-10", "2026-10-11"]);
});

test("CONCURRENCY — two tabs opening at once unlock 8 offers, not 16", async () => {
  const w = world({ count: 20 });
  const gate = await unlockGate(w.db, U, w.db);
  assert.ok(gate.active);
  if (!gate.active) return;
  const [a, b] = await Promise.all([ensureDailyBatch(w.db, gate, U, day1), ensureDailyBatch(w.db, gate, U, day1)]);
  assert.equal(a.newlyUnlocked + b.newlyUnlocked, 8);
  assert.equal(w.data.offer_unlocks.length, 8);
  assert.equal(w.data.jobs.length, 8);
});

test("QUALITY — a short lot rather than bad offers: wrong contract and fewer than 2 skills in common are not unlocked", async () => {
  const w = world({
    offers: [
      offer(1), offer(2, { summary: { skills: ["python", "cobol"] } }), offer(3, { contract_kind: "cdi", contract_type: "CDI" }),
      offer(4, { summary: null }), offer(5, { summary: { skills: ["rigueur", "docker"] } }),
    ],
  });
  const state = await unlockedState(w.db, U, day1, w.db);
  assert.ok(state.mode === "list");
  if (state.mode !== "list") return;
  assert.deepEqual(w.data.offer_unlocks.map((r) => r.offer_id), ["o1"]);
  assert.equal(state.unlocked.length, 1);
  // Nothing passes: said, not silent, and the day is not consumed.
  const poor = world({ offers: [offer(2, { summary: { skills: ["cobol"] } })] });
  const empty = await unlockedState(poor.db, U, day1, poor.db);
  assert.ok(empty.mode === "list" && empty.unlocked.length === 0 && empty.note === "NONE_ABOVE_THRESHOLD");
  assert.equal(poor.data.offer_unlocks.length, 0);
});

test("SIGNALS — no search chosen, no profile: the lot is empty and says why, nothing is claimed", async () => {
  const noSearch = world({ settings: { contracts: ["alternance"], categories: [], keywords: [], city: "", departments: [] } });
  const a = await unlockedState(noSearch.db, U, day1, noSearch.db);
  assert.ok(a.mode === "list" && a.note === "NO_SEARCH" && a.unlocked.length === 0);
  const noProfile = world({ profile: false });
  const b = await unlockedState(noProfile.db, U, day1, noProfile.db);
  assert.ok(b.mode === "list" && b.note === "NO_PROFILE" && b.unlocked.length === 0);
  assert.equal(noSearch.data.offer_unlocks.length + noProfile.data.offer_unlocks.length, 0);
});

test("FAILURE — if the claim fails, the offers unlocked so far stay and the note is DEGRADED, never an exception", async () => {
  const w = world({ count: 10 });
  await unlockedState(w.db, U, day1, w.db);
  const broken = fakeSupabase(w.data, { rpc: { match_offers_for_me_v2: () => [], claim_daily_unlock: () => { throw new Error("db down"); } } });
  w.setDay("2026-10-11");
  const state = await unlockedState(broken.db, U, day2, broken.db);
  assert.ok(state.mode === "list");
  if (state.mode !== "list") return;
  assert.equal(state.note, "DEGRADED");
  assert.equal(state.unlocked.length, 8);
});

test("HEAL — an offer unlocked but never copied (a run stopped halfway) is copied on the next visit", async () => {
  const w = world({ count: 3 });
  w.data.offer_unlocks.push({ user_id: U, offer_id: "o2", unlocked_on: "2026-10-09", origin: "daily" });
  const state = await unlockedState(w.db, U, day1, w.db);
  assert.ok(state.mode === "list");
  assert.ok(w.data.jobs.some((j) => j.offer_id === "o2"));
});

test("GUARD — the kit of a locked offer is refused with OFFER_LOCKED before anything is spent; unlocked, manual and admin offers pass", async () => {
  const w = world({ count: 2 });
  w.data.offer_unlocks.push({ user_id: U, offer_id: "o1", unlocked_on: "2026-10-10", origin: "daily" });
  assert.equal(await offerLocked(w.db, U, { offer_id: "o2" }), true);
  assert.equal(await offerLocked(w.db, U, { offer_id: "o1" }), false);
  assert.equal(await offerLocked(w.db, U, { offer_id: null }), false);
  // A column the account can edit does not unlock anything.
  w.data.jobs.push({ id: "j2", user_id: U, offer_id: "o2", status: "ANALYZED", stage: "interview", seen_at: "2026-10-10", notes: "x", title: "T", company: "C", description: "d".repeat(100) });
  let called = false;
  const ai = async () => { called = true; throw new Error("no AI call expected"); };
  const refused = await generateForJob({ supabase: w.db, userId: U, jobId: "j2", ai, env: {} });
  assert.equal(refused.status, 403);
  assert.equal((refused.body as { code: string }).code, OFFER_LOCKED);
  assert.equal(called, false);
  assert.equal(w.data.documents.length, 0);
  // The administrator is never refused (the next check, here the missing profile, is reached instead).
  w.data.app_admins.push({ user_id: U });
  const admin = await generateForJob({ supabase: w.db, userId: U, jobId: "j2", ai, env: {} });
  assert.notEqual((admin.body as { code?: string }).code, OFFER_LOCKED);
});

test("MIGRATION — read-only for accounts, cap of 8 enforced in the database, backfill of the existing lists, not applied", () => {
  const sql = readFileSync("supabase/migrations/20261009090000_daily_offer_unlocks.sql", "utf8");
  assert.match(sql, /NON APPLIQUÉE/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /for select to authenticated using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(sql, /revoke insert, update, delete on public\.offer_unlocks from anon, authenticated/);
  assert.match(sql, /security definer set search_path = public/);
  assert.match(sql, /limit least\(greatest\(coalesce\(p_limit, 0\), 0\), 8\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /revoke all on function public\.claim_daily_unlock\(uuid, uuid\[\], integer\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.claim_daily_unlock\(uuid, uuid\[\], integer\) to service_role/);
  assert.match(sql, /'backfill'/);
  assert.doesNotMatch(sql, /(drop table|delete from|truncate|update public)/i);
});

test("ROUTE — /api/offers/unlocked answers GET only, for the signed-in account, and falls back to NOT_READY on any failure", () => {
  const route = readFileSync("app/api/offers/unlocked/route.ts", "utf8");
  assert.match(route, /authenticatedClient\(\)/);
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /catch \{\s*return Response\.json\(\{ unlocked: null, reason: "NOT_READY" \}\)/);
  for (const file of ["lib/pipeline/generate.ts", "lib/pipeline/analyze.ts"]) {
    const code = readFileSync(file, "utf8");
    assert.ok(code.indexOf("offerLocked(") > 0 && code.indexOf("offerLocked(") < (code.indexOf("consumeQuota(") > 0 ? code.indexOf("consumeQuota(") : Infinity), `${file}: guard before any spend`);
  }
});
