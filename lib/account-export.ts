import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPORT_TABLES } from "./account";
import { readAll } from "./paged";

/** Safety ceiling per table (a full export of a normal account is far below it). */
export const EXPORT_MAX_ROWS = 50_000;

/**
 * Every row the account owns, table by table, read page by page (the data API stops at 1 000 rows per request).
 * Never silent: a table that could not be read in full, or that hit the ceiling, is named in `incomplete`.
 */
export async function exportTables(db: SupabaseClient, userId: string, max = EXPORT_MAX_ROWS) {
  const tables: Record<string, unknown[]> = {};
  const notes: Record<string, string> = {};
  const incomplete: Record<string, string> = {};
  for (const { table, columns, note, orderBy } of EXPORT_TABLES) {
    const pages = (order: boolean) =>
      readAll<Record<string, unknown>>((from, to) => {
        const query = db.from(table).select(columns).eq("user_id", userId);
        return (order ? query.order(orderBy ?? "id") : query).range(from, to);
      }, { max });
    let read = await pages(true);
    // A table without that column: read it unordered rather than lose it.
    if (read.error && /column|order/i.test(read.error)) read = await pages(false);
    tables[table] = read.rows;
    if (read.error) incomplete[table] = `lecture interrompue après ${read.rows.length} lignes : ${read.error}`;
    else if (read.truncated) incomplete[table] = `plafond de sécurité de ${max} lignes atteint : écris-nous pour recevoir le reste`;
    if (note) notes[table] = note;
  }
  return { tables, notes, incomplete };
}
