import type { SupabaseClient } from "@supabase/supabase-js";
import { aiCost, aiPrices } from "@/lib/ai";

type Env = Record<string, string | undefined>;

export type AccountCost = { userId: string; email: string | null; calls: number; input: number; output: number; usd: number };
export type AiCosts = {
  days: number;
  prices: { input: number; output: number };
  total: { calls: number; input: number; output: number; usd: number };
  accounts: AccountCost[];
};

/** Tokens and estimated cost of the AI per account over the last `days` days (service client). */
export async function aiCostsByAccount(service: SupabaseClient, days = 30, env: Env = process.env, now = new Date()): Promise<AiCosts> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data, error } = await service
    .from("ai_usage")
    .select("user_id,input_tokens,output_tokens")
    .gte("created_at", since)
    .limit(100_000);
  if (error) throw new Error(error.message);
  const by = new Map<string, AccountCost>();
  for (const r of (data ?? []) as { user_id: string; input_tokens: number; output_tokens: number }[]) {
    const a = by.get(r.user_id) ?? { userId: r.user_id, email: null, calls: 0, input: 0, output: 0, usd: 0 };
    a.calls += 1;
    a.input += r.input_tokens;
    a.output += r.output_tokens;
    by.set(r.user_id, a);
  }
  const accounts = [...by.values()];
  for (const a of accounts) a.usd = aiCost(a, env);
  accounts.sort((x, y) => y.usd - x.usd);
  // Emails, so the admin knows who is who (best effort).
  try {
    const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
    const email = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? null]));
    for (const a of accounts) a.email = email.get(a.userId) ?? null;
  } catch {
    // keep the ids
  }
  const total = accounts.reduce(
    (t, a) => ({ calls: t.calls + a.calls, input: t.input + a.input, output: t.output + a.output, usd: t.usd + a.usd }),
    { calls: 0, input: 0, output: 0, usd: 0 },
  );
  return { days, prices: aiPrices(env), total, accounts: accounts.slice(0, 25) };
}
