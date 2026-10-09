import assert from "node:assert/strict";
import { test } from "node:test";
import { afterPlusShown, canShowPlus, EMPTY_PLUS_HISTORY, parsePlusHistory } from "../components/plus-offer";

const DAY = 24 * 3600 * 1000;
const rules = { minGapMs: 3 * DAY };
const ask = (over: Partial<Parameters<typeof canShowPlus>[0]> = {}) =>
  canShowPlus({ pricing: true, moment: "kits-used", rules, history: EMPTY_PLUS_HISTORY, now: 10 * DAY, ...over });

test("a proposal may show when nothing was shown before", () => {
  assert.equal(ask(), true);
});

test("never when the pricing page is off", () => {
  assert.equal(ask({ pricing: false }), false);
});

test("never twice in the same session, whatever the moment", () => {
  const shown = afterPlusShown(EMPTY_PLUS_HISTORY, "kits-used", 10 * DAY);
  assert.equal(ask({ history: shown, moment: "home", now: 10 * DAY + 1000 }), false);
});

test("a moment waits for its own gap, counted from the last time it was shown or closed", () => {
  const before = { last: { "kits-used": 10 * DAY - 2 * DAY }, shownThisSession: false };
  assert.equal(ask({ history: before }), false);
  assert.equal(ask({ history: { ...before, last: { "kits-used": 10 * DAY - 3 * DAY } } }), true);
  // Another moment is not held back by this one's gap.
  assert.equal(ask({ history: before, moment: "home" }), true);
});

test("a stored history that cannot be read is empty, never an error", () => {
  assert.deepEqual(parsePlusHistory(null), { last: {} });
  assert.deepEqual(parsePlusHistory("not json"), { last: {} });
  assert.deepEqual(parsePlusHistory("[1,2]"), { last: {} });
  assert.deepEqual(parsePlusHistory('{"a":5,"b":"x"}'), { last: { a: 5 } });
});
