import type { SupabaseClient } from "@supabase/supabase-js";
import { monthStartParis } from "@/lib/plan";
import { usageRowCostUsd, type UsageRow } from "./ai-costs";
import type { CostOrigin } from "./origin";

type Env = Record<string, string | undefined>;

export type AccountRow = {
  userId: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  /** null when the lookup failed: unknown, not "no". */
  hasCv: boolean | null;
  plan: "free" | "pro" | null;
  isAdmin: boolean | null;
  kitsThisMonth: number | null;
  aiCalls30d: number | null;
  aiCostUsd30d: number | null;
};

export type AccountsPage = {
  at: string;
  page: number;
  perPage: number;
  /** Accounts on the platform, when the auth service says it. */
  total: number | null;
  hasMore: boolean;
  accounts: AccountRow[];
  aiCostOrigin: CostOrigin;
};

export const MAX_PER_PAGE = 100;

/** Page parameters from a query string: 1-based page, 1..100 per page; anything else falls back to the defaults. */
export function pageParams(search: URLSearchParams): { page: number; perPage: number } {
  const int = (v: string | null, fallback: number) => (v && /^\d{1,6}$/.test(v) && Number(v) >= 1 ? Number(v) : fallback);
  return { page: int(search.get("page"), 1), perPage: Math.min(int(search.get("perPage"), 25), MAX_PER_PAGE) };
}

const orNull = async <T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> => {
  try {
    const { data, error } = await query;
    return error ? null : data;
  } catch {
    return null;
  }
};

/**
 * Read-only list of the accounts, one page at a time (service client; the route has already checked is_admin).
 * Nothing about a profile, a CV or a document is returned: dates, counters and a cost only.
 */
export async function listAccounts(service: SupabaseClient, opts: { page: number; perPage: number }, env: Env = process.env, now = new Date()): Promise<AccountsPage> {
  const { page, perPage } = opts;
  const { data, error } = await service.auth.admin.listUsers({ page, perPage });
  if (error) throw new Error("Liste des comptes indisponible.");
  const users = data?.users ?? [];
  const ids = users.map((u) => u.id);
  const since30d = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const empty = ids.length === 0;

  const [profiles, admins, settings, docs, usage] = await Promise.all([
    empty ? [] : orNull(service.from("candidate_profiles").select("user_id").in("user_id", ids)),
    empty ? [] : orNull(service.from("app_admins").select("user_id").in("user_id", ids)),
    empty ? [] : orNull(service.from("user_settings").select("user_id,plan").in("user_id", ids)),
    empty ? [] : orNull(service.from("documents").select("user_id,job_id").eq("kind", "TAILORED_CV").gte("created_at", monthStartParis(now)).in("user_id", ids).limit(5000)),
    // Grouped by account and model inside Postgres; this page's accounts are kept here.
    empty ? [] : orNull(service.rpc("admin_ai_usage_by_model", { p_since: since30d })),
  ]);

  const set = (rows: { user_id: string }[] | null) => (rows ? new Set(rows.map((r) => r.user_id)) : null);
  const hasCv = set(profiles as { user_id: string }[] | null);
  const adminSet = set(admins as { user_id: string }[] | null);
  const plans = settings ? new Map((settings as { user_id: string; plan: string | null }[]).map((s) => [s.user_id, s.plan])) : null;
  const kits = docs
    ? (docs as { user_id: string; job_id: string | null }[]).reduce((m, d) => {
        if (d.job_id) m.set(d.user_id, (m.get(d.user_id) ?? new Set<string>()).add(d.job_id));
        return m;
      }, new Map<string, Set<string>>())
    : null;
  const ai = new Map<string, { calls: number; usd: number }>();
  const aiKnown = Array.isArray(usage);
  if (aiKnown)
    for (const r of usage as UsageRow[]) {
      if (!r.user_id) continue;
      const a = ai.get(r.user_id) ?? { calls: 0, usd: 0 };
      a.calls += Number(r.calls ?? 1);
      a.usd += usageRowCostUsd(r, env);
      ai.set(r.user_id, a);
    }

  const accounts: AccountRow[] = users.map((u) => ({
    userId: u.id,
    email: u.email ?? null,
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
    hasCv: hasCv ? hasCv.has(u.id) : null,
    plan: plans ? (plans.get(u.id) === "pro" ? "pro" : "free") : null,
    isAdmin: adminSet ? adminSet.has(u.id) : null,
    kitsThisMonth: kits ? (kits.get(u.id)?.size ?? 0) : null,
    aiCalls30d: aiKnown ? (ai.get(u.id)?.calls ?? 0) : null,
    aiCostUsd30d: aiKnown ? Math.round((ai.get(u.id)?.usd ?? 0) * 1e6) / 1e6 : null,
  }));
  const total = typeof (data as { total?: unknown } | null)?.total === "number" ? (data as { total: number }).total : null;
  const hasMore = total !== null ? page * perPage < total : users.length === perPage;
  return { at: now.toISOString(), page, perPage, total, hasMore, accounts, aiCostOrigin: "measured_or_estimated" };
}
