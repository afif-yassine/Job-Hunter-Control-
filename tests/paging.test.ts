import assert from "node:assert/strict";
import { test } from "node:test";
import { cappedText, MAX_ROWS, PAGE_SIZE, readPages, type PageResult } from "../components/paging";

/** A fake table of `total` rows, answering ranges like the data API (at most `limit` rows per request). */
const table = (total: number, limit = PAGE_SIZE) => {
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number): Promise<PageResult<number>> => {
    calls.push([from, to]);
    const end = Math.min(to, from + limit - 1, total - 1);
    return { data: from > end ? [] : Array.from({ length: end - from + 1 }, (_, i) => from + i), error: null };
  };
  return { fetchPage, calls };
};

test("a small table is read in one request", async () => {
  const { fetchPage, calls } = table(40);
  const out = await readPages(fetchPage);
  assert.equal(out.rows.length, 40);
  assert.equal(out.capped, false);
  assert.deepEqual(calls, [[0, 999]]);
});

test("a table of 2 300 rows is read in three pages, in order, with no row lost or doubled", async () => {
  const { fetchPage, calls } = table(2300);
  const out = await readPages(fetchPage);
  assert.equal(out.rows.length, 2300);
  assert.deepEqual(out.rows, Array.from({ length: 2300 }, (_, i) => i));
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.equal(out.capped, false);
});

test("exactly one full page is followed by an empty one, not a guess", async () => {
  const { fetchPage, calls } = table(1000);
  const out = await readPages(fetchPage);
  assert.equal(out.rows.length, 1000);
  assert.equal(out.capped, false);
  assert.equal(calls.length, 2);
});

test("the ceiling stops the reading and says so", async () => {
  const { fetchPage } = table(12000);
  const out = await readPages(fetchPage);
  assert.equal(out.rows.length, MAX_ROWS);
  assert.equal(out.capped, true);
  assert.match(cappedText(out.rows.length, "offres", out.capped) ?? "", /^Les 5\s000 offres les plus récentes sont affichées\.$/);
  assert.equal(cappedText(40, "offres", false), null);
});

test("a table that has exactly the ceiling is not reported as cut when the next page is empty", async () => {
  const { fetchPage } = table(MAX_ROWS);
  const out = await readPages(fetchPage);
  // The ceiling is reached on a full page: we cannot know, so it is honestly reported as possibly cut.
  assert.equal(out.rows.length, MAX_ROWS);
  assert.equal(out.capped, true);
});

test("the first page can be shown while the rest arrives", async () => {
  const { fetchPage } = table(2300);
  const seen: number[] = [];
  await readPages(fetchPage, { onPartial: (rows) => seen.push(rows.length) });
  assert.deepEqual(seen, [1000, 2000]);
});

test("an error keeps what was read and is reported", async () => {
  let n = 0;
  const out = await readPages<number>(async (from) => {
    n += 1;
    return n === 2 ? { data: null, error: { message: "boom" } } : { data: Array.from({ length: 1000 }, (_, i) => from + i), error: null };
  });
  assert.equal(out.rows.length, 1000);
  assert.equal(out.error?.message, "boom");
  assert.equal(out.capped, false);
});

test("a smaller page size and ceiling work the same way", async () => {
  const { fetchPage } = table(25, 10);
  const out = await readPages(fetchPage, { pageSize: 10, cap: 100 });
  assert.equal(out.rows.length, 25);
});
