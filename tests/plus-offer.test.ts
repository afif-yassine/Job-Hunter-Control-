import assert from "node:assert/strict";
import { test } from "node:test";
import {
  afterBannerClosed,
  afterLastKitShown,
  afterWindowShown,
  canShowBanner,
  canShowLastKit,
  canShowWindow,
  EMPTY_PLUS_STORE,
  kitsUsedUp,
  lastKitLeft,
  parsePlusStore,
  plusEligible,
  winningMoment,
} from "../components/plus-offer";
import type { UnlockState } from "../components/unlock";

const locking: UnlockState = { kind: "locking", unlocked: new Map(), newToday: null, degraded: false };
const free = { plan: "free" as const, used: 2, limit: 2, resetsOn: "1er novembre" };
const base = { pricing: true, demo: false, onboarding: false, isAdmin: false, plan: free, unlock: locking };

test("only a free account in a settled selection may be proposed Plus; every doubt is no", () => {
  assert.equal(plusEligible(base), true);
  assert.equal(plusEligible({ ...base, pricing: false }), false);
  assert.equal(plusEligible({ ...base, demo: true }), false);
  assert.equal(plusEligible({ ...base, onboarding: true }), false);
  assert.equal(plusEligible({ ...base, isAdmin: true }), false);
  assert.equal(plusEligible({ ...base, plan: { ...free, plan: "pro" } }), false);
  assert.equal(plusEligible({ ...base, plan: { ...free, plan: "admin" } }), false);
  assert.equal(plusEligible({ ...base, plan: null }), false);
  assert.equal(plusEligible({ ...base, plan: undefined }), false);
  assert.equal(plusEligible({ ...base, unlock: { kind: "open", why: "failed" } }), false);
  assert.equal(plusEligible({ ...base, unlock: { ...locking, computing: true } }), false);
  assert.equal(plusEligible({ ...base, unlock: { ...locking, degraded: true } }), false);
});

test("the kit counter: used up, or exactly one left; unknown is neither", () => {
  assert.equal(kitsUsedUp(free), true);
  assert.equal(kitsUsedUp({ ...free, used: 1 }), false);
  assert.equal(kitsUsedUp({ ...free, plan: "pro", limit: 30, used: 30 }), false);
  assert.equal(kitsUsedUp(undefined), false);
  assert.equal(lastKitLeft({ ...free, used: 1 }), true);
  assert.equal(lastKitLeft(free), false);
  assert.equal(lastKitLeft({ ...free, limit: null }), false);
});

test("the window comes once a day", () => {
  assert.equal(canShowWindow(EMPTY_PLUS_STORE, "2026-10-10"), true);
  const shown = afterWindowShown(EMPTY_PLUS_STORE, "2026-10-10");
  assert.equal(canShowWindow(shown, "2026-10-10"), false);
  assert.equal(canShowWindow(shown, "2026-10-11"), true);
});

test("the last-kit block comes once a month", () => {
  const shown = afterLastKitShown(EMPTY_PLUS_STORE, "2026-10-10");
  assert.equal(canShowLastKit(shown, "2026-10-31"), false);
  assert.equal(canShowLastKit(shown, "2026-11-01"), true);
});

test("the banner: closed, it waits for the next day; closed three days in a row, not again this month", () => {
  let store = EMPTY_PLUS_STORE;
  assert.equal(canShowBanner(store, "2026-10-10"), true);
  store = afterBannerClosed(store, "2026-10-10");
  assert.equal(canShowBanner(store, "2026-10-10"), false);
  assert.equal(canShowBanner(store, "2026-10-11"), true);
  store = afterBannerClosed(store, "2026-10-11");
  assert.equal(canShowBanner(store, "2026-10-12"), true);
  store = afterBannerClosed(store, "2026-10-12");
  assert.equal(canShowBanner(store, "2026-10-13"), false);
  assert.equal(canShowBanner(store, "2026-10-31"), false);
  assert.equal(canShowBanner(store, "2026-11-01"), true);
});

test("two closings that are not in a row do not mute the month", () => {
  let store = afterBannerClosed(EMPTY_PLUS_STORE, "2026-10-10");
  store = afterBannerClosed(store, "2026-10-12");
  store = afterBannerClosed(store, "2026-10-14");
  assert.equal(canShowBanner(store, "2026-10-15"), true);
});

test("the smallest moment number wins the screen", () => {
  assert.equal(winningMoment(["bandeau", "cartes"]), "cartes");
  assert.equal(winningMoment(["bandeau", "fin"]), "fin");
  assert.equal(winningMoment(["bandeau"]), "bandeau");
  assert.equal(winningMoment([]), null);
});

test("a stored store that cannot be read is an empty one, never an error", () => {
  assert.deepEqual(parsePlusStore(null), EMPTY_PLUS_STORE);
  assert.deepEqual(parsePlusStore("not json"), EMPTY_PLUS_STORE);
  assert.deepEqual(parsePlusStore("[1]"), EMPTY_PLUS_STORE);
  assert.deepEqual(parsePlusStore('{"windowDay":"yesterday","kitMonth":3,"banner":{"closed":["2026-10-10","x"],"mutedMonth":"2026-10"}}'), {
    windowDay: null,
    kitMonth: null,
    banner: { closed: ["2026-10-10"], mutedMonth: "2026-10" },
  });
});
