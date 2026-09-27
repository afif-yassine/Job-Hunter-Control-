/* Minimal in-memory stand-in for the parts of supabase-js the app uses. */
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Options = {
  /** Tables that "do not exist" (migration not applied). */
  missingTables?: string[];
  /** Columns that "do not exist" (migration not applied). */
  missingColumns?: string[];
  /** Answers for supabase.rpc(name, args). */
  rpc?: Record<string, (args: Record<string, unknown>) => unknown>;
};

export function fakeSupabase(tables: Record<string, Row[]>, options: Options = {}) {
  let counter = 0;
  const from = (name: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    let payload: Row | Row[] = [];
    let conflict: string[] = [];
    let single = false;
    const exec = () => {
      if (options.missingTables?.includes(name))
        return { data: null, error: { code: "42P01", message: `relation "${name}" does not exist` } };
      const sent = Array.isArray(payload) ? payload : [payload];
      if (op !== "select" && options.missingColumns?.some((c) => sent.some((r) => c in r)))
        return { data: null, error: { code: "PGRST204", message: "Could not find the column in the schema cache" } };
      const table = (tables[name] ??= []);
      if (op === "insert") {
        const made = sent.map((r) => ({ id: `${name}-${++counter}`, ...r }));
        table.push(...made);
        return { data: single ? made[0] : made, error: null };
      }
      if (op === "upsert") {
        for (const r of sent) {
          const hit = table.find((t) => conflict.every((k) => t[k] === r[k]));
          if (hit) Object.assign(hit, r);
          else table.push({ id: `${name}-${++counter}`, ...r });
        }
        return { data: null, error: null };
      }
      const matched = table.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        matched.forEach((r) => Object.assign(r, payload));
        return { data: null, error: null };
      }
      if (op === "delete") {
        tables[name] = table.filter((r) => !matched.includes(r));
        return { data: null, error: null };
      }
      return { data: single ? (matched[0] ?? null) : matched, error: null };
    };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
      not: (k: string, _op: string, v: unknown) => (filters.push((r) => (r[k] ?? null) !== v), q),
      gte: (k: string, v: string | number) =>
        (filters.push((r) => (typeof v === "number" ? Number(r[k] ?? -Infinity) >= v : String(r[k] ?? "") >= v)), q),
      lt: (k: string, v: string | number) =>
        (filters.push((r) => (typeof v === "number" ? Number(r[k] ?? Infinity) < v : String(r[k] ?? "") < v)), q),
      delete: () => ((op = "delete"), q),
      order: () => q,
      limit: () => q,
      single: () => ((single = true), q),
      maybeSingle: () => ((single = true), q),
      insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), q),
      update: (p: Row) => ((op = "update"), (payload = p), q),
      upsert: (p: Row | Row[], o?: { onConflict?: string }) => (
        (op = "upsert"), (payload = p), (conflict = (o?.onConflict ?? "id").split(",")), q
      ),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(exec()).then(resolve, reject),
    };
    return q;
  };
  const rpc = async (fn: string, args: Record<string, unknown>) =>
    options.rpc?.[fn]
      ? { data: options.rpc[fn](args), error: null }
      : { data: null, error: { code: "PGRST202", message: `function ${fn} not found` } };
  return { db: { from, rpc } as unknown as SupabaseClient, tables };
}
