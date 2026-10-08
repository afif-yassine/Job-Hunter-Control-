import assert from "node:assert/strict";
import { test } from "node:test";
import { CLOSEST_COUNT, closestJobIds, compareShown } from "../components/views/closest";
import type { Job } from "../lib/types";

/** A job as the dashboard builds it: the free score (or none) and the closeness in meaning. */
function job(id: string, score: number | null, similarity: number | null): Job {
  return {
    id,
    match_score: null,
    score_model: "skills-v1",
    similarity,
    fit: score === null ? null : { score, matched: [], missing: [], similarity },
  } as unknown as Job;
}

const order = (jobs: Job[]) => [...jobs].sort(compareShown).map((j) => j.id);

test("the offer with the higher score comes first, whatever its closeness in meaning", () => {
  // The case of the owner's screenshot: a 17 very close in meaning against a 42 less close.
  assert.deepEqual(order([job("seventeen", 17, 0.9), job("forty-two", 42, 0.2)]), ["forty-two", "seventeen"]);
  assert.deepEqual(order([job("forty-two", 42, 0.2), job("seventeen", 17, 0.9)]), ["forty-two", "seventeen"]);
});

test("at the same score, closeness in meaning breaks the tie", () => {
  assert.deepEqual(order([job("far", 30, 0.3), job("near", 30, 0.8)]), ["near", "far"]);
  // No similarity counts as the farthest.
  assert.deepEqual(order([job("none", 30, null), job("some", 30, 0.1)]), ["some", "none"]);
});

test("an offer without a score comes last, even when it is close in meaning", () => {
  assert.deepEqual(order([job("unscored", null, 0.99), job("low", 1, 0.1), job("zero", 0, 0.1)]), ["low", "zero", "unscored"]);
});

test("the tab holds the best scored offers only: no score, not in it; the tab follows the score, not the meaning", () => {
  const jobs = [job("unscored", null, 0.99), job("seventeen", 17, 0.9), job("forty-two", 42, 0.2)];
  const ids = closestJobIds(jobs);
  assert.equal(ids.has("unscored"), false);
  assert.equal(ids.has("seventeen") && ids.has("forty-two"), true);
});

test("the tab keeps the 25 best scores and drops the rest", () => {
  const jobs = Array.from({ length: CLOSEST_COUNT + 5 }, (_, i) => job(`j${i}`, i, 0.5));
  const ids = closestJobIds(jobs);
  assert.equal(ids.size, CLOSEST_COUNT);
  // The 5 lowest scores (0 to 4) are out, the best (29) is in.
  for (let i = 0; i < 5; i++) assert.equal(ids.has(`j${i}`), false);
  assert.equal(ids.has(`j${CLOSEST_COUNT + 4}`), true);
});
