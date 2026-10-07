import type { SupabaseClient } from "@supabase/supabase-js";
import { aiCost, aiPrices } from "@/lib/ai";
import { callCost } from "@/lib/economics";

type Env = Record<string, string | undefined>;

export type AccountCost = { userId: string; email: string | null; calls: number; input: number; output: number; usd: number };
export type AiCosts = {
  days: number;
  prices: { input: number; output: number };
  total: { calls: number; input: number; output: number; usd: number };
  accounts: AccountCost[];
  alert: { thresholdUsd: number; level: "normal" | "warning" | "exceeded" };
};

/** Tokens and estimated cost of the AI per account over the last `days` days (service client). */
export async function aiCostsByAccount(service: SupabaseClient, days = 30, env: Env = process.env, now = new Date()): Promise<AiCosts> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data, error } = await service.rpc("admin_ai_usage_by_model", { p_since: since });
  if (error) throw new Error(error.message);
  const by = new Map<string, AccountCost>();
  for (const r of (data ?? []) as { user_id: string | null; input_tokens: number; output_tokens: number; model?: string; cost_usd?: number | string | null; calls?: number; unpriced_input?: number; unpriced_output?: number }[]) {
    const userId = r.user_id ?? "platform";
    const a = by.get(userId) ?? { userId, email: r.user_id === null ? "Catalogue partagé" : null, calls: 0, input: 0, output: 0, usd: 0 };
    a.calls += Number(r.calls ?? 1);
    a.input += Number(r.input_tokens);
    a.output += Number(r.output_tokens);
    const stored = r.cost_usd === null || r.cost_usd === undefined ? NaN : Number(r.cost_usd);
    const unpriced = { input: Number(r.unpriced_input ?? (Number.isFinite(stored) ? 0 : r.input_tokens)), output: Number(r.unpriced_output ?? (Number.isFinite(stored) ? 0 : r.output_tokens)) };
    a.usd += (Number.isFinite(stored) && stored >= 0 ? stored : 0) + (r.model ? callCost(r.model, unpriced, env) : aiCost(unpriced, env));
    by.set(userId, a);
  }
  const accounts = [...by.values()];
  accounts.sort((x, y) => y.usd - x.usd);
  // Emails, so the admin knows who is who (best effort).
  try {
    const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
    const email = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? null]));
    for (const a of accounts) if (a.userId !== "platform") a.email = email.get(a.userId) ?? null;
  } catch {
    // keep the ids
  }
  const total = accounts.reduce(
    (t, a) => ({ calls: t.calls + a.calls, input: t.input + a.input, output: t.output + a.output, usd: t.usd + a.usd }),
    { calls: 0, input: 0, output: 0, usd: 0 },
  );
  const configured = env.AI_SPEND_ALERT_USD?.trim();
  const thresholdUsd = configured && Number.isFinite(Number(configured)) && Number(configured) > 0 ? Number(configured) : 2;
  const level = total.usd >= thresholdUsd ? "exceeded" : total.usd >= thresholdUsd * 0.8 ? "warning" : "normal";
  return { days, prices: aiPrices(env), total, accounts: accounts.slice(0, 25), alert: { thresholdUsd, level } };
}
