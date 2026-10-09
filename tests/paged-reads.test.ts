import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { exportTables } from "../lib/account-export";
import { EXPORT_TABLES } from "../lib/account";
import { readAll } from "../lib/paged";
import { ingestOffers } from "../lib/scan/ingest";
import { categoryCounts } from "../lib/scan/catalogue";
import { offerLocked, readUnlocks } from "../lib/unlock";
import { fakeSupabase } from "./fake-supabase";

const rows = (n: number, make: (i: number) => Record<string, unknown>) => Array.from({ length: n }, (_, i) => make(i));

test("readAll — walks every page (not only the first 1 000 rows), stops on a short page, flags the safety ceiling, stops cleanly on an error", async () => {
  const { db } = fakeSupabase({ t: rows(2500, (i) => ({ id: i, user_id: "u" })) });
  const all = await readAll<{ id: number }>((from, to) => db.from("t").select("id").eq("user_id", "u").order("id").range(from, to));
  assert.equal(all.rows.length, 2500);
  assert.equal(all.truncated, false);
  assert.equal(all.error, undefined);
  assert.deepEqual(all.rows.slice(998, 1002).map((r) => r.id), [998, 999, 1000, 1001], "no row lost or repeated at a page border");
  const capped = await readAll<{ id: number }>((from, to) => db.from("t").select("id").order("id").range(from, to), { max: 1500 });
  assert.equal(capped.rows.length, 1500);
  assert.equal(capped.truncated, true);
  const calls: number[] = [];
  const failing = await readAll((from) => (calls.push(from), Promise.resolve({ data: from === 0 ? Array.from({ length: 1000 }, () => ({})) : null, error: from === 0 ? null : { message: "boom" } })));
  assert.deepEqual([failing.rows.length, failing.error, failing.truncated, calls], [1000, "boom", false, [0, 1000]]);
  const small = await readAll<{ id: number }>((from, to) => fakeSupabase({ t: rows(3, (i) => ({ id: i })) }).db.from("t").select("id").range(from, to));
  assert.equal(small.rows.length, 3);
});

test("ACCOUNT EXPORT — complete beyond 1 000 rows per table, and an unreadable or capped table is named instead of silently emptied", async () => {
  const { db } = fakeSupabase({
    jobs: rows(2300, (i) => ({ id: `j${i}`, user_id: "u1" })),
    documents: rows(5, (i) => ({ id: `d${i}`, user_id: "u1" })),
    offer_unlocks: rows(1200, (i) => ({ offer_id: `o${i}`, user_id: "u1", unlocked_on: "2026-10-10", origin: "backfill" })),
    usage_events: rows(10, (i) => ({ id: i, user_id: "someone-else" })),
  }, { missingTables: ["audit_events"] });
  const out = await exportTables(db, "u1");
  assert.equal(out.tables.jobs.length, 2300);
  assert.equal(out.tables.offer_unlocks.length, 1200, "the unlocked offers are part of the export");
  assert.equal(out.tables.usage_events.length, 0, "another account's rows are never read");
  assert.ok(EXPORT_TABLES.some((t) => t.table === "offer_unlocks"));
  assert.deepEqual(Object.keys(out.incomplete), ["audit_events"]);
  assert.match(out.incomplete.audit_events, /lecture interrompue/);
  const capped = await exportTables(db, "u1", 1500);
  assert.match(capped.incomplete.jobs, /plafond de sécurité de 1500 lignes/);
  assert.equal(capped.tables.jobs.length, 1500);
  const route = readFileSync("app/api/account/export/route.ts", "utf8");
  assert.match(route, /exportTables\(db, auth\.userId\)/);
  assert.match(route, /incomplete,/);
});

test("UNLOCKS — an account with more than 1 000 unlocked offers keeps them all, and the guard looks the offer up directly", async () => {
  const { db } = fakeSupabase({ offer_unlocks: rows(1500, (i) => ({ user_id: "u1", offer_id: `o${i}`, unlocked_on: "2026-10-10", origin: "daily" })), app_admins: [] });
  assert.equal((await readUnlocks(db, "u1"))?.length, 1500);
  assert.equal(await offerLocked(db, "u1", { offer_id: "o1400" }), false);
  assert.equal(await offerLocked(db, "u1", { offer_id: "other" }), true);
});

test("INGEST — an offer already in the list is recognised even when the list holds more than 1 000 jobs", async () => {
  const { db, tables } = fakeSupabase({
    jobs: rows(1300, (i) => ({ id: `j${i}`, user_id: "u1", company: `Societe ${i}`, title: `Poste ${i}`, location: "Paris", contract_type: "Alternance", status: "NEW", source_url: `https://x.test/${i}`, official_url: null })),
    job_sources: [], applications: [],
  });
  const offer = { source: "francetravail", company: "Societe 1250", title: "Poste 1250", location: "Paris", contract_type: "Alternance", description: "d".repeat(200), url: "https://x.test/1250", applyUrl: null, publishedAt: "2026-10-09" };
  const result = await ingestOffers(db, "u1", [offer]);
  assert.equal(result.inserted, 0);
  assert.equal(result.duplicates, 1);
  assert.equal(tables.jobs.length, 1300);
});

test("CATEGORY COUNTS — cover the whole catalogue, not its first 1 000 rows", async () => {
  const { db } = fakeSupabase({
    offers: rows(2500, (i) => ({ id: `o${i}`, status: "open", title: "Alternance DevOps", location: "Paris", contract_type: "Contrat apprentissage", source: "francetravail", rome_code: "M1827", published_at: new Date().toISOString().slice(0, 10), categories: ["devops"], contract_kind: "alternance" })),
  });
  const counts = await categoryCounts(db, { city: "", departments: [], maxAgeDays: 30, contracts: ["alternance"] });
  assert.equal(counts.total, 2500);
  assert.equal(counts.byCategory.devops, 2500);
});

test("CEILING COMMENTS — every remaining read that asks for more than 1 000 rows says that 1 000 is the real cap", () => {
  for (const file of ["lib/admin/overview.ts", "lib/admin/users.ts", "lib/plan.ts", "lib/pipeline/server.ts", "app/api/admin/harvest/route.ts", "lib/scan/harvest.ts"]) {
    const code = readFileSync(file, "utf8");
    const risky = code.split(/\r?\n/).filter((line) => /\.limit\((?:[2-9]\d{3}|\d{5,})\)/.test(line));
    for (const line of risky) assert.match(line, /1 ?000|1000/, `${file}: ${line.trim().slice(0, 80)}`);
  }
});

test("ORDERED FIT FUNCTIONS — the prepared migration only adds an order by, keeps the signatures, and is not applied", () => {
  const sql = readFileSync("supabase/migrations/20261010110000_ordered_job_fit.sql", "utf8");
  assert.match(sql, /NON APPLIQUÉE/);
  for (const name of ["my_job_fit_v2", "my_job_fit", "my_job_similarity"]) assert.match(sql, new RegExp(`create or replace function public\.${name}\(\)`));
  assert.equal((sql.match(/order by (j\.)?id;/g) ?? []).length, 3);
  assert.doesNotMatch(sql, /(drop table|delete from|truncate)/i);
});
