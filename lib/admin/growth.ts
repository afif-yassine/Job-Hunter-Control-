import type { SupabaseClient } from "@supabase/supabase-js";
import {
  callCost,
  configuredModels,
  eurUsd,
  forecast,
  hostingTotal,
  priceFor,
  proNet,
  proPrice,
  SELF_HOSTING,
  userCosts,
  type Forecast,
  type Models,
  type UserCosts,
} from "@/lib/economics";
import { monthStartParis } from "@/lib/plan";
import type { CostOrigin } from "./origin";
import { LEVELS, progress, type GrowthStats, type Progress } from "./levels";

type Env = Record<string, string | undefined>;

export type ModelLine = { model: string; label: string; calls: number; input: number; output: number; usd: number; priced: boolean; origin: CostOrigin };

/** Origin of every amount of the growth page; the front shows it next to the figure. */
export type GrowthOrigins = {
  money: Record<keyof Growth["money"], CostOrigin>;
  perUser: CostOrigin;
  levels: CostOrigin;
  selfHosting: CostOrigin;
};

export type Growth = {
  at: string;
  stats: GrowthStats;
  signups30d: { day: string; n: number }[];
  money: {
    proPrice: number;
    proNet: number;
    mrrEur: number;
    netEur: number;
    hostingUsd: number;
    aiUsdMonth: number;
    aiUsdMonthProjected: number;
    marginEur: number;
    eurUsd: number;
    breakEvenPro: number;
  };
  ai: {
    models: Models;
    recommended: Models;
    byModel: ModelLine[];
    /** Calls of the month with no stored cost: counted in calls and tokens, not in dollars. */
    unpricedCalls: number;
    perUser: UserCosts;
    perUserRecommended: UserCosts;
    analysisPriceIn: number;
  };
  /** Which column the "vectorised offers" figure counts, and the legacy column's figure for comparison. */
  embeddings: { counted: "semantic_embedding" | "legacy_embedding"; legacyCount: number };
  origins: GrowthOrigins;
  /** Each level's forecast at its goal. */
  levels: { n: number; name: string; users: number; pro: number; forecast: Forecast }[];
  selfHosting: typeof SELF_HOSTING;
  progress: Progress;
};

export type RawStats = GrowthStats & {
  ai_by_model: { model: string; calls: number; input: number; output: number; usd?: number | string | null }[];
  ai_month?: { unpriced?: number | string | null } | null;
  /** Open offers holding a Perplexity vector (counted by the application: the SQL function counts the legacy column). */
  offers_embedded_semantic?: number | null;
  signups_30d: { day: string; n: number }[];
};

const n = (v: unknown) => Number(v ?? 0) || 0;

/** The growth page: statistics, money, levels. Admin client (the RPC checks is_admin). */
export async function buildGrowth(supabase: SupabaseClient, env: Env = process.env, now = new Date()): Promise<Growth> {
  const monthStart = monthStartParis(now);
  const [statsRes, questsRes] = await Promise.all([
    supabase.rpc("admin_growth_stats", { p_month_start: monthStart }),
    supabase.from("admin_quests").select("id,done,done_at"),
  ]);
  if (statsRes.error) throw new Error(statsRes.error.message);
  const raw = statsRes.data as RawStats;
  // The SQL function (already applied) counts the legacy Gemini column: count the one actually used.
  try {
    const { count, error } = await supabase.from("offers").select("id", { count: "exact", head: true }).eq("status", "open").not("semantic_embedding", "is", null);
    if (!error && typeof count === "number") raw.offers_embedded_semantic = count;
  } catch {
    // keep the legacy figure, labelled as such
  }
  return growthFrom(raw, (questsRes.data ?? []) as Quest[], env, now);
}

export type Quest = { id: string; done: boolean; done_at: string };

/** Same page from raw numbers (tests and the demo use it directly). */
export function growthFrom(raw: RawStats, quests: Quest[], env: Env = process.env, now = new Date()): Growth {
  const monthStart = monthStartParis(now);
  const stats: GrowthStats = {
    users: n(raw.users),
    admins: n(raw.admins),
    new_today: n(raw.new_today),
    new_7d: n(raw.new_7d),
    new_30d: n(raw.new_30d),
    active_1d: n(raw.active_1d),
    active_7d: n(raw.active_7d),
    active_30d: n(raw.active_30d),
    pro: n(raw.pro),
    with_cv: n(raw.with_cv),
    kits_month: n(raw.kits_month),
    applied_month: n(raw.applied_month),
    interviews_month: n(raw.interviews_month),
    offers_open: n(raw.offers_open),
    offers_summarized: n(raw.offers_summarized),
    offers_embedded: typeof raw.offers_embedded_semantic === "number" ? raw.offers_embedded_semantic : n(raw.offers_embedded),
    offers_new_7d: n(raw.offers_new_7d),
  };

  // Real AI spend this month, priced model by model.
  // The stored cost of each call is used as is; tokens × coded prices only when the SQL gave no cost.
  const byModel: ModelLine[] = (raw.ai_by_model ?? []).map((m) => {
    const tokens = { input: n(m.input), output: n(m.output) };
    const price = priceFor(m.model);
    const recorded = m.usd !== undefined && m.usd !== null && Number.isFinite(Number(m.usd));
    return {
      model: m.model,
      label: price?.label ?? m.model,
      calls: n(m.calls),
      ...tokens,
      usd: recorded ? Number(m.usd) : callCost(m.model, tokens, env),
      priced: Boolean(price),
      origin: recorded ? "measured_or_estimated" : "estimated",
    };
  });
  byModel.sort((a, b) => b.usd - a.usd);
  const aiUsdMonth = byModel.reduce((t, m) => t + m.usd, 0);
  const elapsed = Math.max(1, (now.getTime() - Date.parse(monthStart)) / 86_400_000);
  const aiUsdMonthProjected = (aiUsdMonth / elapsed) * 30;

  const models = configuredModels(env);
  const perUser = userCosts(models, env);
  // Levels are planned with the cheap scoring model (the first step of level 1).
  const recommended: Models = { ...models, analysis: "gemini-2.5-flash-lite", reading: "gemini-2.5-flash-lite" };
  const perUserRecommended = userCosts(recommended, env);
  const rate = eurUsd(env);
  const price = proPrice(env);
  const net = proNet(price);

  // Hosting of the level being played (VERCEL/SUPABASE overrides when known).
  const manual = new Map(quests.filter((q) => q.done).map((q) => [q.id, q.done_at]));
  const hosting = {
    vercel: manual.has("vercel-pro") ? 20 : 0,
    supabase: manual.has("supabase-pro") ? 25 : 0,
    other: 2,
  };
  const hostingUsd = hostingTotal(hosting);
  const mrrEur = stats.pro * price;
  const netEur = stats.pro * net;
  const marginEur = netEur - (hostingUsd + aiUsdMonthProjected) / rate;
  const newOffersPerDay = Math.round(stats.offers_new_7d / 7) || 150;
  const now_ = forecast({ users: stats.users, pro: stats.pro, newOffersPerDay, hosting }, models, env);

  const analysisPriceIn = priceFor(models.analysis)?.input ?? 0.3;
  const facts = { ...stats, analysisPriceIn, aiUsdMonth: aiUsdMonthProjected, monthMarginEur: marginEur };

  return {
    at: now.toISOString(),
    stats,
    signups30d: (raw.signups_30d ?? []).map((d) => ({ day: String(d.day), n: n(d.n) })),
    money: {
      proPrice: price,
      proNet: net,
      mrrEur,
      netEur,
      hostingUsd,
      aiUsdMonth,
      aiUsdMonthProjected,
      marginEur,
      eurUsd: rate,
      breakEvenPro: now_.breakEvenPro,
    },
    ai: { models, recommended, byModel, unpricedCalls: n(raw.ai_month?.unpriced), perUser, perUserRecommended, analysisPriceIn },
    embeddings: { counted: typeof raw.offers_embedded_semantic === "number" ? "semantic_embedding" : "legacy_embedding", legacyCount: n(raw.offers_embedded) },
    origins: {
      money: {
        proPrice: "assumption",
        proNet: "assumption",
        mrrEur: "assumption",
        netEur: "assumption",
        hostingUsd: "assumption",
        aiUsdMonth: byModel.every((m) => m.origin === "estimated") && byModel.length > 0 ? "estimated" : "measured_or_estimated",
        aiUsdMonthProjected: "estimated",
        marginEur: "assumption",
        eurUsd: "assumption",
        breakEvenPro: "assumption",
      },
      perUser: "assumption",
      levels: "assumption",
      selfHosting: "assumption",
    },
    levels: LEVELS.map((l) => ({
      n: l.n,
      name: l.name,
      users: l.goalUsers,
      pro: l.goalPro,
      forecast: forecast({ users: l.goalUsers, pro: l.goalPro, newOffersPerDay: Math.max(newOffersPerDay, l.n * 200), hosting: l.hosting }, recommended, env),
    })),
    selfHosting: SELF_HOSTING,
    progress: progress(facts, manual),
  };
}
