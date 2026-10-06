/**
 * The free score: a comparison, not an AI call. Each offer was read and
 * turned into a vector once for everybody; the CV too. Comparing them costs
 * nothing, so every offer of every student gets a score.
 *
 * - meaning: how close the offer's vector is to the CV's (cosine similarity)
 * - skills: share of the skills the offer asks that the CV proves
 */

export type Fit = {
  score: number;
  matched: string[];
  missing: string[];
  similarity: number | null;
};

/** Cosine similarities of gemini-embedding-001 (query ↔ document) rarely leave this band. */
export const SIMILARITY_FLOOR = 0.5;
export const SIMILARITY_CEIL = 0.8;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function fitScore(similarity: number | null | undefined, matched: string[] = [], missing: string[] = [], model?: string): Fit | null {
  const sim = typeof similarity === "number" && Number.isFinite(similarity) ? similarity : null;
  const asked = matched.length + missing.length;
  // The new space ranks by cosine, but gets no numeric semantic grade until calibrated on real CVs.
  const calibrated = !model || model === "gemini-embedding-001";
  const meaning = sim === null || !calibrated ? null : clamp01((sim - SIMILARITY_FLOOR) / (SIMILARITY_CEIL - SIMILARITY_FLOOR));
  // A long wish list should not sink a good match: 6 proven skills is a full mark.
  const skills = asked ? clamp01(matched.length / Math.min(asked, 6)) : null;
  if (meaning === null && skills === null) return null;
  const raw = meaning !== null && skills !== null ? 0.55 * meaning + 0.45 * skills : (meaning ?? skills ?? 0);
  return { score: Math.max(1, Math.min(99, Math.round(raw * 100))), matched, missing, similarity: sim };
}

type Scored = { match_score: number | null; fit?: Fit | null };

/** The score shown: the AI's detailed one when the offer was analysed, else the free comparison. */
export function displayScore(job: Scored): { score: number; detailed: boolean } | null {
  if (job.match_score !== null && job.match_score !== undefined) return { score: job.match_score, detailed: true };
  if (job.fit) return { score: job.fit.score, detailed: false };
  return null;
}

export const scoreOf = (job: Scored): number => displayScore(job)?.score ?? -1;
