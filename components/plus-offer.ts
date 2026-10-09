/**
 * When may LeBonTaf Plus be proposed? Pure decision, no text: the moments and the words come from the incentive plan.
 * Rules, whatever the moment: never when the pricing page is off, never twice in the same browser session,
 * never again before the moment's own minimum gap, counted from the last time it was shown OR closed.
 */

export type PlusRules = {
  /** Minimum time between two appearances of this moment, in milliseconds. */
  minGapMs: number;
};

export type PlusHistory = {
  /** moment id → when it was last shown or closed (ms since epoch). */
  last: Record<string, number>;
  /** A proposal was already shown in this browser session. */
  shownThisSession: boolean;
};

export const EMPTY_PLUS_HISTORY: PlusHistory = { last: {}, shownThisSession: false };

export function canShowPlus(input: { pricing: boolean; moment: string; rules: PlusRules; history: PlusHistory; now: number }): boolean {
  if (!input.pricing) return false;
  if (input.history.shownThisSession) return false;
  const last = input.history.last[input.moment];
  if (typeof last === "number" && Number.isFinite(last) && input.now - last < input.rules.minGapMs) return false;
  return true;
}

/** The history after a proposal was shown (or closed) at `now`. */
export function afterPlusShown(history: PlusHistory, moment: string, now: number): PlusHistory {
  return { last: { ...history.last, [moment]: now }, shownThisSession: true };
}

/** A stored history, read defensively: anything unreadable is an empty history (and so may show, once). */
export function parsePlusHistory(raw: string | null): Pick<PlusHistory, "last"> {
  if (!raw) return { last: {} };
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { last: {} };
    const last: Record<string, number> = {};
    for (const [k, v] of Object.entries(value)) if (typeof v === "number" && Number.isFinite(v)) last[k] = v;
    return { last };
  } catch {
    return { last: {} };
  }
}
