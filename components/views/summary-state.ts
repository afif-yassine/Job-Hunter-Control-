/** The shared reader only summarises an announcement of at least this many characters (lib/offer-reader.ts, migration 20261007111753). */
export const READER_MIN_CHARS = 120;

export type SummaryState = "ready" | "loading" | "failed" | "missing-text" | "short-text" | "waiting";

/**
 * What the "En bref" block of an offer says. A summary that was written quietly on
 * opening is either there, being written, or could not be written: never silent.
 */
export function summaryState(input: {
  hasSummary: boolean;
  status: string | null | undefined;
  description: string | null | undefined;
  summarising: boolean;
  failed: boolean;
}): SummaryState {
  if (input.hasSummary) return "ready";
  if (input.summarising) return "loading";
  if (input.status === "DISCOVERED" && !input.description) return "missing-text";
  const text = input.description?.trim() ?? "";
  if (text && text.length < READER_MIN_CHARS) return "short-text";
  if (input.failed) return "failed";
  return "waiting";
}
