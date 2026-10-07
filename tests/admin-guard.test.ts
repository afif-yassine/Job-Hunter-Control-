import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { adminRefusal } from "../lib/admin";
import { fakeSupabase } from "./fake-supabase";

test("admin guard: only the administrator passes, and an unreadable answer is a refusal", async () => {
  const as = (answer: (() => unknown) | undefined) => fakeSupabase({}, answer ? { rpc: { is_admin: answer } } : {}).db;
  assert.equal(await adminRefusal(as(() => true)), null);
  for (const db of [as(() => false), as(() => "true"), as(() => null), as(undefined)]) {
    const refusal = await adminRefusal(db);
    assert.equal(refusal?.status, 403);
    assert.match(String((await refusal?.json()).error), /administrateur/);
  }
});

test("a student can never push a document to the platform's Drive: the route checks the administrator before anything else", () => {
  const route = readFileSync("app/api/documents/[id]/drive/route.ts", "utf8");
  const guard = route.indexOf("adminRefusal(auth.supabase)");
  assert.ok(guard > 0, "the Drive route must call adminRefusal");
  assert.ok(guard < route.indexOf("credentials()", route.indexOf("export async function POST")), "the check comes before the Drive credentials are read");
  assert.ok(guard < route.indexOf("drive.files.create"), "the check comes before any upload");
});
