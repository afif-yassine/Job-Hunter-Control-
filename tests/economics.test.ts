import assert from "node:assert/strict";
import { test } from "node:test";
import { growthFrom } from "../lib/admin/growth";
import { LEVELS, MANUAL_STEP_IDS, progress } from "../lib/admin/levels";
import { callCost, forecast, priceFor, proNet, userCosts } from "../lib/economics";
import { demoGrowthRaw } from "../lib/demo-data";

const cheap = { analysis: "gemini-2.5-flash-lite", writing: "gemini-3.6-flash", reading: "gemini-2.5-flash-lite", embedding: "gemini-embedding-001" };

test("prices: Flash-Lite is not mistaken for Flash, unknown models fall back", () => {
  assert.equal(priceFor("gemini-2.5-flash-lite")?.input, 0.1);
  assert.equal(priceFor("gemini-2.5-flash")?.input, 0.3);
  assert.equal(priceFor("gemini-3.6-flash")?.output, 7.5);
  assert.equal(priceFor("mystery-model"), null);
  assert.equal(callCost("mystery-model", { input: 1_000_000, output: 0 }, {}), 0.3);
  assert.ok(Math.abs(callCost("gemini-3.6-flash", { input: 2361, output: 5273 }, {}) - 0.0430890) < 1e-6);
});

test("a free student stays under 0,20 $ a month with a cheap scoring model", () => {
  const c = userCosts(cheap, {});
  assert.ok(c.freeMax < 0.2, `freeMax ${c.freeMax}`);
  assert.ok(c.freeAverage < c.freeMax);
  assert.ok(c.pro > c.freeMax && c.pro < 2, `pro ${c.pro}`);
  // The expensive scoring model costs much more per student.
  const expensive = userCosts({ ...cheap, analysis: "gemini-3.6-flash" }, {});
  assert.ok(expensive.freeMax > c.freeMax * 5);
});

test("Pro at 7,99 € leaves about 7,56 € after Stripe; break-even grows with the level", () => {
  assert.ok(Math.abs(proNet(7.99) - 7.564) < 0.01);
  const env = { PRO_PRICE_EUR: "7.99", EUR_USD: "1.15" };
  const small = forecast({ users: 100, pro: 0, newOffersPerDay: 200, hosting: LEVELS[0].hosting }, cheap, env);
  const mid = forecast({ users: 1000, pro: 40, newOffersPerDay: 400, hosting: LEVELS[1].hosting }, cheap, env);
  assert.ok(small.totalUsd < 30, `level 1 ${small.totalUsd}`);
  assert.ok(mid.totalUsd > small.totalUsd);
  assert.ok(mid.breakEvenPro > small.breakEvenPro && mid.breakEvenPro < 60, `break-even ${mid.breakEvenPro}`);
  assert.equal(mid.revenueEur, 40 * 7.99);
});

test("levels: automatic steps follow the numbers, manual ones follow the ticks", () => {
  const facts = { ...demoGrowthRaw, analysisPriceIn: 0.1, aiUsdMonth: 5, monthMarginEur: -10 };
  const p = progress(facts, new Map([["deploy-sprint6", "2026-10-06T18:00:00Z"]]));
  const l1 = p.levels[0];
  assert.equal(l1.steps.find((s) => s.id === "deploy-sprint6")?.done, true);
  assert.equal(l1.steps.find((s) => s.id === "cheap-analysis")?.done, true);
  assert.equal(l1.steps.find((s) => s.id === "students-10")?.done, true);
  assert.equal(l1.steps.find((s) => s.id === "students-100")?.done, false);
  assert.equal(p.current, 1);
  assert.equal(p.levels[1].status, "locked");
  assert.ok(p.xp >= 50 + 40 + 50);
  assert.ok(!MANUAL_STEP_IDS.has("students-100") && MANUAL_STEP_IDS.has("stripe"));
});

test("growth page from raw numbers: prices each model and plans with the cheap scorer", () => {
  const g = growthFrom(demoGrowthRaw, [{ id: "vercel-pro", done: true, done_at: "2026-10-10T10:00:00Z" }], {}, new Date("2026-10-16T10:00:00Z"));
  assert.equal(g.stats.users, 64);
  assert.equal(g.money.hostingUsd, 22);
  assert.ok(g.ai.byModel[0].usd >= g.ai.byModel[1].usd);
  assert.ok(g.money.aiUsdMonthProjected > g.money.aiUsdMonth);
  assert.equal(g.ai.recommended.analysis, "gemini-2.5-flash-lite");
  assert.equal(g.levels.length, 3);
});
