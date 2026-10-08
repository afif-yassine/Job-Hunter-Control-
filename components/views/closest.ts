import type { Job } from "@/lib/types";

export const CLOSEST_COUNT = 25;

/**
 * The FREE score of a job, "compétences en commun": the current comparison, else the free score stored
 * with the job (an offer added by hand has no comparison row), else none. It is the only number the lists,
 * the sort and the tab use. The AI analysis never gets in (see `aiScore`).
 */
export function listScore(job: Job): number | null {
  if (job.fit) return job.fit.score;
  if (job.score_model === "skills-v1" && typeof job.match_score === "number") return job.match_score;
  return null;
}

/** The score of the AI analysis, shown only inside the offer panel, in its own named block. */
export function aiScore(job: Job): number | null {
  return job.score_model !== "skills-v1" && typeof job.match_score === "number" ? job.match_score : null;
}

const similarityOf = (job: Job): number => (typeof job.similarity === "number" && Number.isFinite(job.similarity) ? job.similarity : -1);

/**
 * The order of the "Mieux notées pour mon CV" tab and of the "Les mieux notées" sort: the free SCORE the
 * student reads on the card, highest first, so the order and the number tell the same story. Closeness in
 * meaning only breaks a tie. An offer without a free score comes last.
 */
export function compareShown(a: Job, b: Job): number {
  const byScore = (listScore(b) ?? -1) - (listScore(a) ?? -1);
  return byScore || similarityOf(b) - similarityOf(a);
}

/**
 * The members of the "Mieux notées pour mon CV" tab: the 25 best offers by free score (no threshold).
 * An offer without a free score is not in it.
 */
export function closestJobIds(jobs: Job[]): Set<string> {
  return new Set(
    [...jobs]
      .filter((j) => listScore(j) !== null)
      .sort(compareShown)
      .slice(0, CLOSEST_COUNT)
      .map((j) => j.id),
  );
}
