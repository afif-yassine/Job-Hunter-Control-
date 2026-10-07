/**
 * The free score: a comparison, not an AI call. Each offer was read and
 * turned into a vector once for everybody; the CV too. Comparing them costs
 * nothing, so every offer of every student gets a score.
 *
 * - meaning: how close the offer's vector is to the CV's (cosine similarity)
 * - skills: share of the skills the offer asks that the CV proves
 */

import { isGenericQuality } from "./skills";

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

export function fitScore(similarity: number | null | undefined, matchedIn: string[] = [], missingIn: string[] = [], model?: string): Fit | null {
  const sim = typeof similarity === "number" && Number.isFinite(similarity) ? similarity : null;
  // Personal qualities say nothing about what the CV proves: they neither count nor show as gaps.
  const matched = matchedIn.filter(skill => !isGenericQuality(skill));
  const missing = missingIn.filter(skill => !isGenericQuality(skill));
  const asked = matched.length + missing.length;
  // The new space ranks by cosine, but gets no numeric semantic grade until calibrated on real CVs.
  const calibrated = !model || model === "gemini-embedding-001";
  const meaning = sim === null || !calibrated ? null : clamp01((sim - SIMILARITY_FLOOR) / (SIMILARITY_CEIL - SIMILARITY_FLOOR));
  // Calibrated space: a long wish list should not sink a good match, so 6 proven skills is a full mark.
  // Otherwise coverage stays exact (proven ÷ asked, qualities already removed): a cap would only hide a real gap.
  // This is a comparison of skills, never a probability of being hired.
  const skills = asked ? clamp01(matched.length / (calibrated ? Math.min(asked, 6) : asked)) : null;
  if (meaning === null && skills === null) return null;
  const raw = meaning !== null && skills !== null ? 0.55 * meaning + 0.45 * skills : (meaning ?? skills ?? 0);
  return { score: calibrated ? Math.max(1, Math.min(99, Math.round(raw * 100))) : Math.round(raw * 100), matched, missing, similarity: sim };
}

type Scored = { match_score: number | null; fit?: Fit | null; score_model?: string | null };

/** The score shown: the AI's detailed one when the offer was analysed, else the free comparison. */
export function displayScore(job: Scored): { score: number; detailed: boolean } | null {
  if (job.score_model === "skills-v1" && job.fit) return { score: job.fit.score, detailed: false };
  if (job.match_score !== null && job.match_score !== undefined) return { score: job.match_score, detailed: job.score_model !== "skills-v1" };
  if (job.fit) return { score: job.fit.score, detailed: false };
  return null;
}

export const scoreOf = (job: Scored): number => displayScore(job)?.score ?? -1;

/** Within one vector space, semantic proximity orders results without inventing a percentage. */
export function compareFits(a: Scored & { similarity?: number | null }, b: Scored & { similarity?: number | null }): number {
  const sa = typeof a.similarity === "number" && Number.isFinite(a.similarity) ? a.similarity : null;
  const sb = typeof b.similarity === "number" && Number.isFinite(b.similarity) ? b.similarity : null;
  if (sa !== null || sb !== null) return (sb ?? -1) - (sa ?? -1) || scoreOf(b) - scoreOf(a);
  return scoreOf(b) - scoreOf(a);
}
