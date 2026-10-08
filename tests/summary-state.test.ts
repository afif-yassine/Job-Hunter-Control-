import assert from "node:assert/strict";
import { test } from "node:test";
import { READER_MIN_CHARS, summaryState } from "../components/views/summary-state";

const base = { hasSummary: false, status: "DISCOVERED", description: "x".repeat(READER_MIN_CHARS), summarising: false, failed: false };

test("an offer with a summary just shows it, whatever else is going on", () => {
  assert.equal(summaryState({ ...base, hasSummary: true, summarising: true, failed: true }), "ready");
});

test("the summary being written quietly shows a loading state, not an error", () => {
  assert.equal(summaryState({ ...base, summarising: true }), "loading");
});

test("a failed quiet summary leaves a readable state instead of a red toast", () => {
  assert.equal(summaryState({ ...base, failed: true }), "failed");
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
