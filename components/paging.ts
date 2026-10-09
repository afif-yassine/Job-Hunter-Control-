/**
 * The data API answers at most 1 000 rows per request (the database's default). A table read without a limit is
 * silently cut at 1 000, so the lists are read page by page, with an explicit ceiling, and the screen says when the
 * ceiling is reached instead of cutting without a word.
 */
export const PAGE_SIZE = 1000;
export const MAX_ROWS = 5000;

export type PageError = { message?: string; code?: string };
export type PageResult<T> = { data: T[] | null; error: PageError | null };

export type PagedRead<T> = {
  rows: T[];
  /** The first error met: the rows read so far are still returned. */
  error: PageError | null;
  /** The ceiling was reached while more rows exist: only the most recent `rows.length` are kept. */
  capped: boolean;
};

/**
 * Reads a table by pages of `pageSize` (the fetcher must sort in a STABLE order: date, then id), up to `cap` rows.
 * `onPartial` is called with the rows read so far after each page that is followed by another one, so the first page
 * can be shown at once while the rest arrives.
 */
export async function readPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  options: { pageSize?: number; cap?: number; onPartial?: (rows: T[]) => void } = {},
): Promise<PagedRead<T>> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const cap = options.cap ?? MAX_ROWS;
  const rows: T[] = [];
  for (;;) {
    const room = Math.min(pageSize, cap - rows.length);
    const { data, error } = await fetchPage(rows.length, rows.length + room - 1);
    if (error) return { rows, error, capped: false };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < room) return { rows, error: null, capped: false };
    if (rows.length >= cap) {
      // The ceiling is reached with a full last page: there may be more. Say it rather than cut in silence.
      return { rows, error: null, capped: true };
    }
    options.onPartial?.([...rows]);
  }
}

/** "Les 5 000 offres les plus récentes sont affichées." (null when nothing was cut). */
export function cappedText(count: number, noun: string, capped: boolean): string | null {
  if (!capped) return null;
  return `Les ${count.toLocaleString("fr-FR")} ${noun} les plus récentes sont affichées.`;
}
