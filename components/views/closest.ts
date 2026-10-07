import { compareFits, scoreOf } from "@/lib/fit";
import type { Job } from "@/lib/types";

export const CLOSEST_COUNT = 25;

/**
 * The offers whose meaning is nearest to the CV, as a rank among this
 * account's offers. It is not a grade: an offer can be in the list and still
 * share few of its asked skills with the CV.
 */
export function closestJobIds(jobs: Job[]): Set<string> {
  return new Set(
    [...jobs]
      .filter((j) => scoreOf(j) >= 0 || typeof j.similarity === "number")
      .sort(compareFits)
      .slice(0, CLOSEST_COUNT)
      .map((j) => j.id),
  );
}
