/** The shared reader only summarises an announcement of at least this many characters (lib/offer-reader.ts, migration 20261007111753). */
export const READER_MIN_CHARS = 120;

export type SummaryState = "ready" | "loading" | "gone" | "failed" | "missing-text" | "short-text" | "waiting";

/**
 * What the "En bref" block of an offer says. A summary that was written quietly on
 * opening is either there, being written, refused because the offer is closed for
 * everybody, or could not be written: never silent.
 *
 * `knownGone` is true when the server just answered GONE while the student's own copy
 * is not marked yet. Once the copy is marked, the existing red box of the panel says it
 * and the caller passes false, so the message is never doubled.
 */
export function summaryState(input: {
  hasSummary: boolean;
  status: string | null | undefined;
  description: string | null | undefined;
  summarising: boolean;
  failed: boolean;
  knownGone: boolean;
}): SummaryState {
  if (input.hasSummary) return "ready";
  if (input.summarising) return "loading";
  if (input.knownGone) return "gone";
  if (input.status === "DISCOVERED" && !input.description) return "missing-text";
  const text = input.description?.trim() ?? "";
  if (text && text.length < READER_MIN_CHARS) return "short-text";
  if (input.failed) return "failed";
  return "waiting";
}
