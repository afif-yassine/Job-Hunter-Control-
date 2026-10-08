import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeRevisionQuota, quotaLimit, quotaMessage, quotaRefusal, QUOTA_DEFAULTS } from "../lib/quota";

type Call = { fn: string; args: Record<string, unknown> };

/** A counter that behaves like consume_quota; `kinds` are the values the database accepts. */
function counter(kinds: string[]) {
  const used = new Map<string, number>();
  const calls: Call[] = [];
  const db = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      const kind = String(args.p_kind);
      if (!kinds.includes(kind)) return { data: null, error: { code: "23514", message: 'new row for relation "usage_events" violates check constraint "usage_events_kind_check"' } };
      const key = `${args.p_user_id}:${kind}`;
      const count = used.get(key) ?? 0;
      if (count >= Number(args.p_limit)) return { data: false, error: null };
      used.set(key, count + 1);
      return { data: true, error: null };
    },
  } as unknown as SupabaseClient;
  return { db, calls, used };
}

test("revisions are free but capped: the 16th of the day is refused and another account is untouched", async () => {
  assert.equal(QUOTA_DEFAULTS.revision, 15);
  const { db, calls } = counter(["scan", "analysis", "generation", "revision"]);
  for (let i = 0; i < 15; i++) assert.equal((await consumeRevisionQuota(db, "u1", {})).ok, true, `revision ${i + 1}`);
  const sixteenth = await consumeRevisionQuota(db, "u1", {});
  assert.deepEqual({ ok: sixteenth.ok, limit: sixteenth.limit, kind: sixteenth.kind, unavailable: sixteenth.unavailable }, { ok: false, limit: 15, kind: "revision", unavailable: undefined });
  const refusal = quotaRefusal(sixteenth.kind, sixteenth.limit, sixteenth.unavailable);
  assert.equal(refusal.status, 429);
  assert.equal(refusal.body.code, "QUOTA_REACHED");
  assert.match(String(refusal.body.error), /15 modifications de CV et de lettre par jour/);
  assert.equal((await consumeRevisionQuota(db, "u2", {})).ok, true);
  // The 2 free kits a month are another counter: nothing is spent on it.
  assert.ok(calls.every((c) => c.args.p_kind === "revision"));
});

test("the limit can be changed or lifted, and an unreadable counter closes the door", async () => {
  assert.equal(quotaLimit("revision", { QUOTA_REVISIONS_PER_DAY: "3" }), 3);
  assert.equal(quotaLimit("revision", { QUOTA_REVISIONS_PER_DAY: "abc" }), 15);
  const free = counter(["revision"]);
  assert.deepEqual(await consumeRevisionQuota(free.db, "u1", { QUOTA_REVISIONS_PER_DAY: "0" }), { ok: true, limit: 0, kind: "revision" });
  assert.deepEqual(free.calls, []);
  const broken = { rpc: async () => ({ data: null, error: { code: "XX000", message: "boom" } }) } as unknown as SupabaseClient;
  const down = await consumeRevisionQuota(broken, "u1", {});
  assert.deepEqual({ ok: down.ok, unavailable: down.unavailable }, { ok: false, unavailable: true });
  const refusal = quotaRefusal(down.kind, down.limit, down.unavailable);
  assert.equal(refusal.status, 503);
  assert.equal(refusal.body.code, "QUOTA_UNAVAILABLE");
});

test("before the migration the database refuses the new kind: revisions count against the daily writing quota instead", async () => {
  const { db, calls } = counter(["scan", "analysis", "generation"]);
  const env = { QUOTA_GENERATIONS_PER_DAY: "2" };
  const first = await consumeRevisionQuota(db, "u1", env);
  assert.deepEqual({ ok: first.ok, kind: first.kind, limit: first.limit }, { ok: true, kind: "generation", limit: 2 });
  assert.equal((await consumeRevisionQuota(db, "u1", env)).ok, true);
  const third = await consumeRevisionQuota(db, "u1", env);
  assert.deepEqual({ ok: third.ok, kind: third.kind }, { ok: false, kind: "generation" });
  assert.match(quotaMessage(third.kind, third.limit), /rédactions de CV et lettre/);
  // Never unlimited and never an outage: the revision kind was tried, then the writing kind.
  assert.equal(calls[0].args.p_kind, "revision");
  assert.equal(calls[1].args.p_kind, "generation");
});

test("the revision route takes the quota before the paid model call and answers with the quota refusal", () => {
  const route = readFileSync("app/api/documents/[id]/revise/route.ts", "utf8");
  const quota = route.indexOf("consumeRevisionQuota(supabase, userId)");
  assert.ok(quota > 0, "the route must consume the revision quota");
  assert.ok(quota < route.indexOf('generateJson(prompt, "writing")'), "the quota comes before the model call");
  assert.match(route, /quotaRefusal\(quota\.kind, quota\.limit, quota\.unavailable\)/);
});
