import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gatewayCredits, readGatewayBalance } from "../lib/admin/gateway-credits";
import { growthFrom, type RawStats } from "../lib/admin/growth";
import { listAccounts, pageParams } from "../lib/admin/users";
import { demoGrowthRaw } from "../lib/demo-data";
import { fakeSupabase } from "./fake-supabase";

const now = new Date("2026-10-16T10:00:00Z");

test("GROWTH — the stored cost of the calls is used as is and every amount names its origin", () => {
  const raw = {
    ...demoGrowthRaw,
    ai_month: { unpriced: 3 },
    ai_by_model: [
      { model: "qwen/qwen3.7-flash", calls: 10, input: 1_000_000, output: 1_000_000, usd: 0.0421 },
      { model: "openai/gpt-6-luna", calls: 4, input: 50_000, output: 20_000, usd: "0.0100" },
    ],
  } as unknown as RawStats;
  const g = growthFrom(raw, [], {}, now);
  assert.deepEqual(g.ai.byModel.map((m) => m.usd), [0.0421, 0.01], "the figure of the database, not tokens × coded price");
  assert.ok(g.ai.byModel.every((m) => m.origin === "measured_or_estimated"));
  assert.ok(Math.abs(g.money.aiUsdMonth - 0.0521) < 1e-9);
  assert.equal(g.ai.unpricedCalls, 3);
  assert.equal(g.origins.money.aiUsdMonth, "measured_or_estimated");
  assert.equal(g.origins.money.aiUsdMonthProjected, "estimated");
  for (const key of ["proPrice", "proNet", "mrrEur", "netEur", "hostingUsd", "marginEur", "eurUsd", "breakEvenPro"] as const)
    assert.equal(g.origins.money[key], "assumption", key);
  assert.deepEqual([g.origins.perUser, g.origins.levels, g.origins.selfHosting], ["assumption", "assumption", "assumption"]);
});

test("GROWTH — without any stored cost the line is priced from tokens and says it is an estimate", () => {
  const g = growthFrom(demoGrowthRaw, [], {}, now);
  assert.ok(g.ai.byModel.length > 0 && g.ai.byModel.every((m) => m.origin === "estimated"));
  assert.equal(g.origins.money.aiUsdMonth, "estimated");
  assert.equal(g.ai.unpricedCalls, 0);
});

const credits = (status: number, body: unknown, seen: { url?: string; auth?: string | null }[] = []) =>
  (async (url: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(url), auth: new Headers(init?.headers).get("authorization") });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;

test("GATEWAY — reads /v1/credits (two strings in USD), sends the key only to Vercel and never returns it", async () => {
  const seen: { url?: string; auth?: string | null }[] = [];
  const result = await readGatewayBalance({ AI_GATEWAY_API_KEY: "secret-key-123" }, credits(200, { balance: "1.62", total_used: "0.38" }, seen));
  assert.deepEqual(result, { available: true, balanceUsd: 1.62, totalUsedUsd: 0.38, origin: "measured", scope: "Toute l’équipe Vercel, toutes les clés, depuis l’origine." });
  assert.equal(seen[0].url, "https://ai-gateway.vercel.sh/v1/credits");
  assert.equal(seen[0].auth, "Bearer secret-key-123");
  assert.ok(!JSON.stringify(result).includes("secret-key-123"));
});

test("GATEWAY — no key, refused key, error, odd shape or network failure: a clean 'unavailable', never an invented zero", async () => {
  let called = false;
  const never = (async () => ((called = true), new Response("{}"))) as typeof fetch;
  assert.deepEqual(await readGatewayBalance({}, never), { available: false, reason: "not_configured", origin: "measured" });
  assert.equal(called, false, "no call without a key");
  const env = { AI_GATEWAY_API_KEY: "k" };
  assert.equal((await readGatewayBalance(env, credits(401, {}))).available, false);
  assert.deepEqual(await readGatewayBalance(env, credits(403, {})), { available: false, reason: "unauthorized", origin: "measured" });
  assert.deepEqual(await readGatewayBalance(env, credits(503, {})), { available: false, reason: "unavailable", origin: "measured" });
  assert.deepEqual(await readGatewayBalance(env, credits(200, { balance: "5" })), { available: false, reason: "unavailable", origin: "measured" });
  assert.deepEqual(await readGatewayBalance(env, credits(200, { balance: "x", total_used: "y" })), { available: false, reason: "unavailable", origin: "measured" });
  assert.deepEqual(await readGatewayBalance(env, credits(200, "not json")), { available: false, reason: "unavailable", origin: "measured" });
  assert.deepEqual(await readGatewayBalance(env, (async () => { throw new Error("offline"); }) as typeof fetch), { available: false, reason: "unavailable", origin: "measured" });
});

test("GATEWAY — the gap is what Vercel counted minus what the application recorded", async () => {
  const rows = [
    { user_id: "a", model: "m1", calls: 4, input_tokens: 10, output_tokens: 5, cost_usd: "0.10", unpriced_input: 0, unpriced_output: 0 },
    { user_id: null, model: "m2", calls: 6, input_tokens: 20, output_tokens: 8, cost_usd: 0.05, unpriced_input: 7, unpriced_output: 1 },
  ];
  const { db } = fakeSupabase({}, { rpc: { admin_ai_usage_by_model: (args) => ((args.p_since as string).startsWith("1970") ? rows : []) } });
  const result = await gatewayCredits(db, { AI_GATEWAY_API_KEY: "k" }, credits(200, { balance: "1.00", total_used: "0.40" }), now);
  assert.deepEqual(result.recorded, { usd: 0.15, calls: 10, unpricedCalls: 6, origin: "measured_or_estimated" });
  assert.equal(result.gapUsd, 0.25);
  // Gateway down: the recorded side is still shown, the gap is unknown.
  const down = await gatewayCredits(db, {}, credits(200, {}), now);
  assert.equal(down.gapUsd, null);
  assert.equal(down.recorded?.usd, 0.15);
  // Recorded side unreadable: the gap is unknown too.
  const blind = await gatewayCredits(fakeSupabase({}).db, { AI_GATEWAY_API_KEY: "k" }, credits(200, { balance: "1", total_used: "2" }), now);
  assert.equal(blind.recorded, null);
  assert.equal(blind.gapUsd, null);
});

function withAuth(db: SupabaseClient, users: Record<string, unknown>[], total = users.length) {
  const asked: { page: number; perPage: number }[] = [];
  const service = db as unknown as { auth: unknown };
  service.auth = {
    admin: {
      listUsers: async (opts: { page: number; perPage: number }) => {
        asked.push(opts);
        const start = (opts.page - 1) * opts.perPage;
        return { data: { users: users.slice(start, start + opts.perPage), total }, error: null };
      },
    },
  };
  return { service: db, asked };
}

test("ACCOUNTS — one page of accounts with dates, CV, plan, kits of the month and AI cost; nothing from the profile or the documents", async () => {
  const users = [
    { id: "u1", email: "a@example.test", created_at: "2026-09-01T10:00:00Z", last_sign_in_at: "2026-10-15T08:00:00Z" },
    { id: "u2", email: "b@example.test", created_at: "2026-10-10T10:00:00Z", last_sign_in_at: null },
  ];
  const { db } = fakeSupabase(
    {
      candidate_profiles: [{ user_id: "u1", profile: { name: "SECRET NAME" } }],
      app_admins: [{ user_id: "u1" }],
      user_settings: [{ user_id: "u1", plan: "free" }, { user_id: "u2", plan: "pro" }],
      documents: [
        { user_id: "u1", job_id: "j1", kind: "TAILORED_CV", created_at: "2026-10-05T10:00:00Z", content: "SECRET CV" },
        { user_id: "u1", job_id: "j1", kind: "TAILORED_CV", created_at: "2026-10-06T10:00:00Z" },
        { user_id: "u1", job_id: "j2", kind: "TAILORED_CV", created_at: "2026-10-07T10:00:00Z" },
        { user_id: "u1", job_id: "j3", kind: "TAILORED_CV", created_at: "2026-09-07T10:00:00Z" },
        { user_id: "u2", job_id: "j9", kind: "COVER_LETTER", created_at: "2026-10-07T10:00:00Z" },
      ],
    },
    { rpc: { admin_ai_usage_by_model: () => [
      { user_id: "u1", model: "m", calls: 3, input_tokens: 1, output_tokens: 1, cost_usd: "0.0123", unpriced_input: 0, unpriced_output: 0 },
      { user_id: "u9", model: "m", calls: 8, input_tokens: 1, output_tokens: 1, cost_usd: "5", unpriced_input: 0, unpriced_output: 0 },
    ] } },
  );
  const { service, asked } = withAuth(db, users);
  const page = await listAccounts(service, { page: 1, perPage: 25 }, {}, now);
  assert.deepEqual(asked, [{ page: 1, perPage: 25 }]);
  assert.equal(page.total, 2);
  assert.equal(page.hasMore, false);
  assert.deepEqual(page.accounts[0], {
    userId: "u1", email: "a@example.test", createdAt: "2026-09-01T10:00:00Z", lastSignInAt: "2026-10-15T08:00:00Z",
    hasCv: true, plan: "free", isAdmin: true, kitsThisMonth: 2, aiCalls30d: 3, aiCostUsd30d: 0.0123,
  });
  assert.deepEqual(page.accounts[1], {
    userId: "u2", email: "b@example.test", createdAt: "2026-10-10T10:00:00Z", lastSignInAt: null,
    hasCv: false, plan: "pro", isAdmin: false, kitsThisMonth: 0, aiCalls30d: 0, aiCostUsd30d: 0,
  });
  assert.ok(!/SECRET/.test(JSON.stringify(page)), "no profile or document content");
  assert.equal(page.aiCostOrigin, "measured_or_estimated");
});

test("ACCOUNTS — pagination is passed to the auth service and a failed lookup is 'unknown' (null), not 'no' or zero", async () => {
  const users = Array.from({ length: 7 }, (_, i) => ({ id: `u${i}`, email: null, created_at: "2026-10-01T00:00:00Z", last_sign_in_at: null }));
  const { db } = fakeSupabase({ candidate_profiles: [], user_settings: [], documents: [], app_admins: [] }, { missingTables: ["candidate_profiles", "app_admins"] });
  const { service, asked } = withAuth(db, users);
  const page = await listAccounts(service, { page: 2, perPage: 3 }, {}, now);
  assert.deepEqual(asked, [{ page: 2, perPage: 3 }]);
  assert.deepEqual(page.accounts.map((a) => a.userId), ["u3", "u4", "u5"]);
  assert.equal(page.total, 7);
  assert.equal(page.hasMore, true);
  for (const a of page.accounts) {
    assert.equal(a.hasCv, null);
    assert.equal(a.isAdmin, null);
    assert.equal(a.aiCalls30d, null, "the AI figures function is missing here: unknown");
    assert.equal(a.aiCostUsd30d, null);
    assert.equal(a.plan, "free");
    assert.equal(a.kitsThisMonth, 0);
  }
  const last = await listAccounts(service, { page: 3, perPage: 3 }, {}, now);
  assert.equal(last.hasMore, false);
});

test("ACCOUNTS — page parameters are bounded", () => {
  const q = (s: string) => pageParams(new URLSearchParams(s));
  assert.deepEqual(q(""), { page: 1, perPage: 25 });
  assert.deepEqual(q("page=3&perPage=50"), { page: 3, perPage: 50 });
  assert.deepEqual(q("perPage=100000"), { page: 1, perPage: 100 });
  assert.deepEqual(q("page=0&perPage=-4"), { page: 1, perPage: 25 });
  assert.deepEqual(q("page=abc&perPage=1e9"), { page: 1, perPage: 25 });
});

test("ROUTES — both admin routes check the administrator before the service key, answer GET only, and write nothing", () => {
  for (const file of ["app/api/admin/gateway-credits/route.ts", "app/api/admin/users/route.ts"]) {
    const route = readFileSync(file, "utf8");
    assert.ok(route.indexOf("adminRefusal(") > 0 && route.indexOf("adminRefusal(") < route.indexOf("serviceClient()"), `${file}: admin first`);
    assert.match(route, /authenticatedClient\("probe"\)/, `${file}: rate limited`);
    assert.match(route, /export async function GET/);
    assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/, `${file}: read only`);
    assert.doesNotMatch(route, /\.(insert|update|upsert|delete)\(/, `${file}: no write`);
  }
  const lib = readFileSync("lib/admin/gateway-credits.ts", "utf8") + readFileSync("lib/admin/users.ts", "utf8");
  assert.doesNotMatch(lib, /console\./, "no log of addresses or keys");
});
