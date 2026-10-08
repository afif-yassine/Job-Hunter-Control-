import assert from "node:assert/strict";
import { test } from "node:test";
import { READER_MIN_CHARS, summaryState } from "../components/views/summary-state";

const base = { hasSummary: false, status: "DISCOVERED", description: "x".repeat(READER_MIN_CHARS), summarising: false, failed: false, knownGone: false };

test("an offer with a summary just shows it, whatever else is going on", () => {
  assert.equal(summaryState({ ...base, hasSummary: true, summarising: true, failed: true }), "ready");
});

test("the summary being written quietly shows a loading state, not an error", () => {
  assert.equal(summaryState({ ...base, summarising: true }), "loading");
});

test("a failed quiet summary leaves a readable state instead of a red toast", () => {
  assert.equal(summaryState({ ...base, failed: true }), "failed");
});

test("an offer the server refuses as closed for everybody is told as gone, not as a failure to retry", () => {
  assert.equal(summaryState({ ...base, knownGone: true }), "gone");
  // It is more important than a missing or short text, and than an earlier failure.
  assert.equal(summaryState({ ...base, knownGone: true, description: null }), "gone");
  assert.equal(summaryState({ ...base, knownGone: true, description: "court" }), "gone");
  assert.equal(summaryState({ ...base, knownGone: true, failed: true }), "gone");
  // A summary already there is still shown, and a call in progress still loads.
  assert.equal(summaryState({ ...base, knownGone: true, hasSummary: true }), "ready");
  assert.equal(summaryState({ ...base, knownGone: true, summarising: true }), "loading");
});

test("no text, then a text too short for the reader, are told apart and never promise a summary", () => {
  assert.equal(summaryState({ ...base, description: null }), "missing-text");
  assert.equal(summaryState({ ...base, description: "" }), "missing-text");
  assert.equal(summaryState({ ...base, description: "y".repeat(READER_MIN_CHARS - 1) }), "short-text");
  assert.equal(summaryState({ ...base, description: "  " + "y".repeat(READER_MIN_CHARS - 1) + "  " }), "short-text");
  assert.equal(summaryState({ ...base, status: "ANALYZED", description: "y".repeat(10) }), "short-text");
});

test("a long enough text that is not summarised yet simply waits for the reader", () => {
  assert.equal(summaryState({ ...base, status: "ANALYZED" }), "waiting");
});
