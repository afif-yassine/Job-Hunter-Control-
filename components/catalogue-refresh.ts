/**
 * Opening the list from the shared catalogue (POST /api/catalogue/refresh). The route only copies
 * what the catalogue already holds: no job site is called and no AI is paid. The decisions are
 * kept here as small pure functions so they can be tested.
 */

/** Browser-session key; its value is the time of the last successful check. */
export const REFRESH_GUARD_KEY = "jh-catalogue-refresh";

export type RefreshDecision = "wait" | "skip" | "reuse" | "call";

/** Once per browser session, never before the dashboard is ready and a CV is saved. */
export function refreshDecision(input: { enabled: boolean; started: boolean; stored: string | null }): RefreshDecision {
  if (!input.enabled) return "wait";
  if (input.started) return "skip";
  if (input.stored) return "reuse";
  return "call";
}

/**
 * What the answer means for the screen. A failure is silent. `checked` is true only when a search was
 * really open (NO_SEARCH, "no job chosen", is explained by the Settings card instead). The list is
 * reloaded only when something was added.
 */
export function interpretRefresh(ok: boolean, body: unknown): { checked: boolean; reload: boolean } {
  if (!ok || typeof body !== "object" || body === null) return { checked: false, reload: false };
  const answer = body as { inserted?: unknown; searched?: unknown };
  return {
    checked: answer.searched === true,
    reload: typeof answer.inserted === "number" && answer.inserted > 0,
  };
}

/** The two honest facts of the home card, kept apart: the catalogue check and the student's own last search. */
export function freshnessText(input: { refreshedAt: string | null; lastSearchAt: string | null }, ago: (iso: string) => string): string {
  const parts: string[] = [];
  if (input.refreshedAt) parts.push(`Catalogue vérifié ${ago(input.refreshedAt)}.`);
  parts.push(input.lastSearchAt ? `Dernière recherche de tes offres : ${ago(input.lastSearchAt)}.` : "Pas encore de recherche.");
  return parts.join(" ");
}
