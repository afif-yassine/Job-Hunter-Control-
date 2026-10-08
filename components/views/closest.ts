import { scoreOf } from "@/lib/fit";
import type { Job } from "@/lib/types";

export const CLOSEST_COUNT = 25;

const similarityOf = (job: Job): number => (typeof job.similarity === "number" && Number.isFinite(job.similarity) ? job.similarity : -1);

/**
 * The order of the "Mieux notées pour mon CV" tab and of the "Les mieux notées" sort: the SCORE the
 * student reads, highest first, so the order and the number tell the same story. Closeness in
 * meaning only breaks a tie. An offer without a score comes last.
 */
export function compareShown(a: Job, b: Job): number {
  const byScore = scoreOf(b) - scoreOf(a);
  return byScore || similarityOf(b) - similarityOf(a);
}

/**
 * The members of the "Mieux notées pour mon CV" tab: the 25 best SCORED offers, by the score shown
 * on the card (no threshold). An offer without a score is not in it.
 */
export function closestJobIds(jobs: Job[]): Set<string> {
  return new Set(
    [...jobs]
      .filter((j) => scoreOf(j) >= 0)
      .sort(compareShown)
      .slice(0, CLOSEST_COUNT)
      .map((j) => j.id),
  );
}
