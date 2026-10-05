/**
 * What LeBonTaf costs and earns: model prices, cost of one student per month,
 * the Pro price, Stripe fees, and the launch levels (100 → 1 000 → 8 000).
 * Used by the admin space; every number here is an estimate the admin can
 * compare with the real month (ai_usage).
 */

type Env = Record<string, string | undefined>;

/** Dollars per million tokens (provider list prices, October 2026). */
export const MODEL_PRICES: { match: RegExp; label: string; input: number; output: number }[] = [
  { match: /gemini-2\.5-flash-lite|gemini-3\.\d-flash-lite/i, label: "Gemini Flash-Lite", input: 0.1, output: 0.4 },
  { match: /gemini-2\.5-flash/i, label: "Gemini 2.5 Flash", input: 0.3, output: 2.5 },
  { match: /gemini-3\.\d-flash/i, label: "Gemini 3.6 Flash", input: 1.5, output: 7.5 },
  { match: /gemini-embedding-001/i, label: "Gemini Embedding 001", input: 0.15, output: 0 },
  { match: /gemini-embedding-2/i, label: "Gemini Embedding 2", input: 0.2, output: 0 },
  { match: /text-embedding-3-small/i, label: "OpenAI embedding small", input: 0.02, output: 0 },
  { match: /gpt-5\.6-luna|gpt-6-luna/i, label: "GPT Luna", input: 0.2, output: 1.2 },
  { match: /gpt-5-nano/i, label: "GPT-5 Nano", input: 0.05, output: 0.4 },
  { match: /claude-haiku-4[.-]5/i, label: "Claude Haiku 4.5", input: 1, output: 5 },
  { match: /qwen3\.5-flash/i, label: "Qwen 3.5 Flash", input: 0.1, output: 0.4 },
  { match: /qwen3\.7-flash/i, label: "Qwen 3.7 Flash", input: 0.03, output: 0.13 },
];

export type Tokens = { input: number; output: number };

/** Price of a model, or null when it is not in the list. */
export function priceFor(model: string): { input: number; output: number; label: string } | null {
  const hit = MODEL_PRICES.find((p) => p.match.test(model));
  return hit ? { input: hit.input, output: hit.output, label: hit.label } : null;
}

/** Cost in dollars of one call. Unknown models use AI_PRICE_*_PER_M (default: Gemini 2.5 Flash). */
export function callCost(model: string, tokens: Tokens, env: Env = process.env): number {
  const p = priceFor(model) ?? {
    input: num(env.AI_PRICE_INPUT_PER_M, 0.3),
    output: num(env.AI_PRICE_OUTPUT_PER_M, 2.5),
  };
  return (tokens.input * p.input + tokens.output * p.output) / 1_000_000;
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return v !== undefined && v.trim() !== "" && Number.isFinite(n) ? n : d;
}

/** Tokens of one task, measured or estimated (thinking tokens count as output). */
export const TASK_TOKENS = {
  /** CV + letter for one offer. */
  kit: { input: 3000, output: 5000 },
  /** Detailed score and "why" for one offer and one student. */
  score: { input: 2000, output: 600 },
  /** Reading one offer once for everybody (summary, skills, salary…). */
  readOffer: { input: 1200, output: 300 },
  /** Reading the student's CV once. */
  cvImport: { input: 6000, output: 2500 },
  /** Embedding one offer card. */
  embedOffer: { input: 300, output: 0 },
} as const;

export type Models = { analysis: string; writing: string; reading: string; embedding: string };

export function configuredModels(env: Env = process.env): Models {
  const base = env.AI_MODEL?.trim();
  return {
    analysis: env.AI_MODEL_ANALYSIS?.trim() || base || "gemini-2.5-flash-lite",
    writing: env.AI_MODEL_WRITING?.trim() || base || "gemini-3.6-flash",
    reading: env.AI_MODEL_READING?.trim() || "gemini-2.5-flash-lite",
    embedding: env.EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
  };
}

/** Free plan: 10 detailed offers the first day, then 5 a day; 2 kits a month. */
export const FREE_PLAN = { firstDay: 10, perDay: 5, kitsPerMonth: 2 } as const;
/** Pro "fair use" used for the estimate (not a limit shown to students). */
export const PRO_USAGE = { scoresPerMonth: 600, kitsPerMonth: 30 } as const;
/** Share of the free maximum an average signed-up student really uses. */
export const AVERAGE_USE = 0.35;

export type UserCosts = { freeMax: number; freeAverage: number; pro: number; cvImport: number; perOffer: number };

/** AI dollars per student per month with these models. */
export function userCosts(models: Models, env: Env = process.env): UserCosts {
  const score = callCost(models.analysis, TASK_TOKENS.score, env);
  const kit = callCost(models.writing, TASK_TOKENS.kit, env);
  const cvImport = callCost(models.writing, TASK_TOKENS.cvImport, env);
  const scores = FREE_PLAN.firstDay + FREE_PLAN.perDay * 29;
  const freeMax = scores * score + FREE_PLAN.kitsPerMonth * kit;
  return {
    freeMax,
    freeAverage: freeMax * AVERAGE_USE + cvImport * AVERAGE_USE,
    pro: PRO_USAGE.scoresPerMonth * score + PRO_USAGE.kitsPerMonth * kit,
    cvImport,
    perOffer: callCost(models.reading, TASK_TOKENS.readOffer, env) + callCost(models.embedding, TASK_TOKENS.embedOffer, env),
  };
}

/** Pro plan price in euros (PRO_PRICE_EUR overrides 7,99). */
export function proPrice(env: Env = process.env): number {
  return num(env.PRO_PRICE_EUR, 7.99);
}

/** What one Pro payment leaves after Stripe (EEA card 1,5 % + 0,25 €, Billing ≈ 0,7 %). */
export function proNet(price: number): number {
  return Math.max(0, price - (price * 0.015 + 0.25) - price * 0.007);
}

/** Dollars for one euro (EUR_USD, approximate). */
export function eurUsd(env: Env = process.env): number {
  return num(env.EUR_USD, 1.15);
}

export type Hosting = { vercel: number; supabase: number; other: number };
export const hostingTotal = (h: Hosting) => h.vercel + h.supabase + h.other;

export type Scenario = {
  users: number;
  pro: number;
  newOffersPerDay: number;
  hosting: Hosting;
};

export type Forecast = {
  aiUsd: number;
  catalogueUsd: number;
  hostingUsd: number;
  totalUsd: number;
  revenueEur: number;
  netEur: number;
  marginEur: number;
  /** Pro accounts needed so that revenue pays everything. */
  breakEvenPro: number;
};

/** Monthly costs and revenue for a number of students. */
export function forecast(s: Scenario, models: Models, env: Env = process.env): Forecast {
  const c = userCosts(models, env);
  const free = Math.max(0, s.users - s.pro);
  const catalogueUsd = s.newOffersPerDay * 30 * c.perOffer;
  const aiUsd = free * c.freeAverage + s.pro * c.pro + catalogueUsd;
  const hostingUsd = hostingTotal(s.hosting);
  const totalUsd = aiUsd + hostingUsd;
  const rate = eurUsd(env);
  const price = proPrice(env);
  const net = proNet(price);
  const revenueEur = s.pro * price;
  const netEur = s.pro * net;
  // Each Pro also replaces a free student: what it adds is net − (pro − free) AI cost.
  const perProEur = net - (c.pro - c.freeAverage) / rate;
  const fixedEur = (hostingUsd + catalogueUsd + s.users * c.freeAverage) / rate;
  const breakEvenPro = perProEur > 0 ? Math.ceil(fixedEur / perProEur) : Infinity;
  return { aiUsd, catalogueUsd, hostingUsd, totalUsd, revenueEur, netEur, marginEur: netEur - totalUsd / rate, breakEvenPro };
}

/** Renting a GPU all month long, for comparison (October 2026 on-demand prices). */
export const SELF_HOSTING = {
  gpuUsdPerMonth: { low: 175, high: 240 },
  note: "Carte graphique louée 24 h/24 (RunPod RTX 4000 Ada ≈ 0,24 $/h, L4 ≈ 0,33 $/h) + ton temps pour la maintenir.",
} as const;

/** Is renting a GPU cheaper than the API for reading offers and scoring? */
export function selfHostingWorthIt(monthlyApiUsdForReadingAndScoring: number): boolean {
  return monthlyApiUsdForReadingAndScoring > SELF_HOSTING.gpuUsdPerMonth.high * 2;
}
