import assert from "node:assert/strict";
import { test } from "node:test";
import { stillOnlineCached, stillOnline } from "../lib/pipeline/availability";
import { fakeSupabase } from "./fake-supabase";

test("availability reuses a shared check and expires it without an AI call", async () => {
  const { db } = fakeSupabase({ offers: [{ id: "offer" }] });
  const job = { offer_id: "offer", source_url: "https://example.com/job" };
  let calls = 0;
  const http: typeof fetch = async () => { calls++; return new Response("", { status: 200 }); };
  const now = Date.parse("2026-10-07T12:00:00Z");
  assert.equal((await stillOnlineCached(job, db, {}, http, now)).online, true);
  await stillOnlineCached(job, db, {}, http, now + 1000);
  assert.equal(calls, 1);
  await stillOnlineCached(job, db, {}, http, now + 3_600_001);
  assert.equal(calls, 2);
  await stillOnlineCached({ ...job, source_url: "https://example.com/new" }, db, {}, http, now + 3_600_002);
  assert.equal(calls, 3);
});

test("private addresses and redirect responses remain unknown", async () => {
  let calls = 0;
  const http: typeof fetch = async (_url, init) => { calls++; assert.equal(init?.redirect, "manual"); return new Response("", { status: 302 }); };
  for (const source_url of ["https://127.0.0.1/x", "https://[::1]/x", "https://user:pass@example.com/x", "https://a.localhost/x", "https://example.com:8443/x"]) {
    assert.equal((await stillOnline({ source_url }, {}, http)).online, null);
  }
  assert.equal(calls, 0);
  assert.equal((await stillOnline({ source_url: "https://example.com/job" }, {}, http)).online, null);
  assert.equal(calls, 1);
});
