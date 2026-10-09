/**
 * Reads every row of a query, a page at a time.
 *
 * The data API returns at most 1 000 rows per request whatever `.limit()` asks for, so a plain
 * `.limit(5000)` silently stops at 1 000. Here the caller builds ONE page (`.range(from, to)`, with a
 * stable `.order(...)` so pages never overlap or skip), and this helper walks the pages until one is short.
 *
 *   const { rows, error, truncated } = await readAll<Row>((from, to) =>
 *     db.from("jobs").select("id,title").eq("user_id", id).order("id").range(from, to));
 *
 * - `max` is an explicit safety ceiling: when it is reached `truncated` is true (never silent).
 * - On a database error it stops at once and returns the rows read so far with `error` set.
 */

export const PAGE_SIZE = 1000;

/** `data` is typed by the caller through `T` (the query builders' own row types do not line up with it). */
type Page = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type ReadAll<T> = { rows: T[]; error?: string; truncated: boolean };

export async function readAll<T>(page: (from: number, to: number) => Page, opts: { pageSize?: number; max?: number } = {}): Promise<ReadAll<T>> {
  const size = Math.max(1, Math.floor(opts.pageSize ?? PAGE_SIZE));
  const max = Math.max(size, Math.floor(opts.max ?? 50_000));
  const rows: T[] = [];
  for (let from = 0; from < max; from += size) {
    const to = Math.min(from + size, max) - 1;
    const { data, error } = await page(from, to);
    if (error) return { rows, error: error.message, truncated: false };
    const got = (Array.isArray(data) ? data : []) as T[];
    rows.push(...got);
    // A page shorter than asked is the last one (the ceiling's own last page may be smaller than `size`).
    if (got.length < to - from + 1) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
