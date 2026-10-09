import { isGenericQuality, normalizeSkills } from "./skills";

/**
 * The daily selection: which offers of the catalogue an account unlocks today.
 * Pure (no database, no AI): the same input always gives the same lot, so it can
 * be simulated on an export before it runs on real accounts.
 *
 * "Up to 8", never "always 8": an offer needs a contract that matches the search and
 * at least MIN_COMMON_SKILLS skills in common with the CV. Better a short lot than a bad one.
 */

export const DAILY_LIMIT = 8;
export const MIN_COMMON_SKILLS = 2;

export type UnlockCandidate = {
  id: string;
  /** Cosine similarity with the CV in the account's vector space; null when one of the vectors is missing. */
  similarity: number | null;
  /** Skills the shared reader found in the offer (empty = not read yet). */
  skills: string[];
  /** alternance, stage, cdd… (the offer's contract kind). */
  kind: string | null;
  publishedAt?: string | null;
};

export type UnlockReason =
  /** No offer reached us from the catalogue for this search. */
  | "NO_CANDIDATES"
  /** Offers exist but none passes the quality threshold today. */
  | "NONE_ABOVE_THRESHOLD";

export type Pick = UnlockCandidate & { common: string[]; rank: number };

export type Selection = {
  chosen: Pick[];
  considered: number;
  /** Candidates offered by the catalogue for this search, before any filter. */
  pool: number;
  /** Of the pool, offers the account already unlocked. */
  alreadyUnlocked: number;
  /** Candidates that passed every filter (the lot is the first `limit` of them). */
  passing: number;
  /** Candidates rejected because their contract does not match the search. */
  wrongContract: number;
  /** Candidates whose skills the reader has not listed yet: not evaluable, not unlocked. */
  unread: number;
  /** Read candidates with fewer than MIN_COMMON_SKILLS in common. */
  fewCommonSkills: number;
  reason?: UnlockReason;
};

const num = (v: number | null) => (typeof v === "number" && Number.isFinite(v) ? v : -Infinity);

/** Skills both sides have; personal qualities ("rigueur") never count. */
export function commonSkills(offerSkills: string[], profileSkills: string[]): string[] {
  const mine = new Set(normalizeSkills(profileSkills, 200));
  return normalizeSkills(offerSkills, 60).filter((skill) => !isGenericQuality(skill) && mine.has(skill));
}

export function selectDaily(input: {
  candidates: UnlockCandidate[];
  profileSkills: string[];
  /** Contracts of the search; empty = any. */
  contracts: string[];
  /** Offers already unlocked: never picked twice. */
  unlocked: ReadonlySet<string>;
  limit?: number;
  minCommon?: number;
}): Selection {
  const limit = Math.min(Math.max(0, Math.floor(input.limit ?? DAILY_LIMIT)), DAILY_LIMIT);
  const minCommon = input.minCommon ?? MIN_COMMON_SKILLS;
  const fresh = input.candidates.filter((c) => !input.unlocked.has(c.id));
  let wrongContract = 0;
  let unread = 0;
  let fewCommonSkills = 0;
  const passing: Omit<Pick, "rank">[] = [];
  for (const candidate of fresh) {
    if (input.contracts.length && !(candidate.kind && input.contracts.includes(candidate.kind))) {
      wrongContract += 1;
      continue;
    }
    if (!normalizeSkills(candidate.skills, 60).some((skill) => !isGenericQuality(skill))) {
      unread += 1;
      continue;
    }
    const common = commonSkills(candidate.skills, input.profileSkills);
    if (common.length < minCommon) {
      fewCommonSkills += 1;
      continue;
    }
    passing.push({ ...candidate, common });
  }
  // Closest meaning first, then the most skills in common, then the freshest, then the id (stable).
  passing.sort(
    (a, b) =>
      num(b.similarity) - num(a.similarity) ||
      b.common.length - a.common.length ||
      Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "") ||
      a.id.localeCompare(b.id),
  );
  const chosen = passing.slice(0, limit).map((p, i) => ({ ...p, rank: i + 1 }));
  const result: Selection = {
    chosen, considered: fresh.length, pool: input.candidates.length, alreadyUnlocked: input.candidates.length - fresh.length,
    passing: passing.length, wrongContract, unread, fewCommonSkills,
  };
  if (!chosen.length && limit > 0) result.reason = fresh.length ? "NONE_ABOVE_THRESHOLD" : "NO_CANDIDATES";
  return result;
}
