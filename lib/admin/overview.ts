import type { SupabaseClient } from "@supabase/supabase-js";
import { aiConfigured, modelFor } from "@/lib/ai";
import { loadIntegrationEnv } from "@/lib/integrations";
import { loadUserSettings } from "@/lib/settings";
import { budgetFor, type SourceId } from "@/lib/scan/health";
import { studentCatalogueOnly } from "@/lib/scan/config";
import { AI_ADVICE, EMBEDDINGS_PLAN, ENRICHMENT_SOURCES, NOT_CONNECTED, SOURCES, type CatalogSource, type EnrichmentSource } from "./catalog";

type Env = Record<string, string | undefined>;

export type SourceState = "active" | "idle" | "optional" | "missing_key" | "quota" | "budget" | "auth" | "error";

export type AdminSource = CatalogSource & {
  n: number;
  state: SourceState;
  stateLabel: string;
  keyOrigin: "platform" | "account" | "none" | "not_needed";
  missingKeys: string[];
  lastRun: { status: string; at: string; found: number; message: string | null; cached: boolean } | null;
  runs7d: { ok: number; problems: number; cached: number };
  budget: { used: number; limit: number; period: string } | null;
  quality: { offers: number; links: number; analyzed: number; avgScore: number | null; strong: number; suspected: number; toReview: number; unreadable: number } | null;
  companies: number | null;
};

export type AdminAction = { level: "required" | "recommended" | "before_launch"; text: string };

export type AdminEnrichment = EnrichmentSource & {
  n: number;
  ready: boolean;
  missing: string[];
  lastRun: { status: string; at: string; message: string | null } | null;
};

export type AdminOverview = {
  ai: {
    provider: string;
    configured: boolean;
    analysisModel: string;
    writingModel: string;
    usageToday: { scan: number; analysis: number; generation: number };
    advice: typeof AI_ADVICE;
  };
  embeddings: typeof EMBEDDINGS_PLAN;
  sources: AdminSource[];
  enrichment: AdminEnrichment[];
  notConnected: typeof NOT_CONNECTED;
  automation: { cronConfigured: boolean; sharedCache: boolean; lastServerRun: string | null };
  /**
   * Daily selection of 8 offers (migration 20261009090000). `external_open` = the table is installed but
   * STUDENT_CATALOGUE_ONLY is not 1: students' updates still call the job sites (paid calls).
   */
  dailyUnlock: {
    status: "not_installed" | "active" | "external_open";
    catalogueOnly: boolean;
    message: string;
    /** The last computations of the daily lot, newest first (no account, no content): when, how long, how far, result. */
    recent: { at: string; ok: boolean; step: string; totalMs: number; newlyUnlocked: number; note: string | null }[];
  };
  worker: { configured: boolean; online: boolean; browserReady: boolean | null };
  drive: boolean;
  alerts: { title: string; message: string; at: string; read: boolean }[];
  actions: AdminAction[];
};

const LABEL: Record<SourceState, string> = {
  active: "Activé",
  idle: "Activé — aucune entreprise ajoutée",
  optional: "Facultatif — non configuré",
  missing_key: "Clé manquante",
  quota: "Quota épuisé",
  budget: "Budget gratuit atteint",
  auth: "Clé refusée",
  error: "En erreur",
};

type Run = { source: string; status: string; found: number; cached: boolean; message: string | null; created_at: string };
type Stat = { source: string; offers: number; links: number; analyzed: number; avg_score: number | string | null; strong: number; suspected: number; to_review: number; unreadable: number };

function parisMidnightIso(now = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  const offset =
    new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime() -
    new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(Date.parse(`${day}T00:00:00Z`) - offset).toISOString();
}

export async function buildAdminOverview(ctx: {
  supabase: SupabaseClient;
  userId: string;
  env?: Env;
  /** Service client, to see every account (optional). */
  service?: SupabaseClient | null;
  worker?: { online: boolean; browserReady: boolean | null };
  now?: Date;
}): Promise<AdminOverview> {
  const env = ctx.env ?? process.env;
  const now = ctx.now ?? new Date();
  const db = ctx.supabase;
  const all = ctx.service ?? null;
  const has = (k: string) => Boolean(env[k]?.trim());
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [own, settings, runsRes, budgetRes, statsRes, usageRes, alertsRes, serverRunRes, targetsRes] = await Promise.all([
    loadIntegrationEnv(db, ctx.userId).catch(() => ({}) as Record<string, string>),
    loadUserSettings(db, ctx.userId),
    db.from("source_runs").select("source,status,found,cached,message,created_at").gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(3000),
    db.from("source_budget").select("source,period,used"),
    db.rpc("admin_source_stats", { p_days: 30 }),
    db.from("usage_events").select("kind").gte("created_at", parisMidnightIso(now)).limit(20000),
    db.from("notifications").select("title,message,created_at,read_at").eq("notification_type", "SOURCE_ALERT").order("created_at", { ascending: false }).limit(10),
    (all ?? db).from("agent_runs").select("created_at,counters").filter("counters->>trigger", "eq", "server").order("created_at", { ascending: false }).limit(1),
    all ? all.from("user_settings").select("scan_config") : Promise.resolve({ data: null }),
  ]);

  const runs = (runsRes.data ?? []) as Run[];
  const budgets = (budgetRes.data ?? []) as { source: string; period: string; used: number }[];
  const stats = (statsRes.data ?? []) as Stat[];

  // Careers pages followed, per platform (all accounts when possible).
  const targetLists: string[][] = targetsRes.data
    ? (targetsRes.data as { scan_config: { targets?: string[] } | null }[]).map((r) => r.scan_config?.targets ?? [])
    : [settings.prefs.targets];
  const companies = new Map<string, Set<string>>();
  for (const list of targetLists)
    for (const t of list) {
      const [ats, slug] = t.split(":");
      if (!companies.has(ats)) companies.set(ats, new Set());
      companies.get(ats)!.add(slug);
    }

  const sources: AdminSource[] = SOURCES.map((s, i) => {
    const mine = runs.filter((r) => r.source === s.id);
    const last = mine.find((r) => !r.cached) ?? mine[0] ?? null;
    const platform = s.keys.length > 0 && s.keys.every((k) => has(k));
    const account = s.keys.length > 0 && s.keys.every((k) => Boolean((own as Record<string, string>)[k]));
    const keyOrigin: AdminSource["keyOrigin"] = s.keys.length === 0 ? "not_needed" : platform ? "platform" : account ? "account" : "none";
    const missingKeys = keyOrigin === "none" ? s.keys.filter((k) => !has(k)) : [];
    const ats = s.id.startsWith("ats:") ? s.id.slice(4) : null;
    const followed = ats ? (companies.get(ats)?.size ?? 0) : null;

    let state: SourceState = "active";
    if (keyOrigin === "none") state = s.optional ? "optional" : "missing_key";
    else if (last && ["quota", "budget", "auth", "error"].includes(last.status)) state = last.status as SourceState;
    else if (ats && !followed) state = "idle";

    const b = budgetFor(s.id as SourceId, env, now);
    const used = b ? (budgets.find((x) => x.source === s.id && x.period === b.period)?.used ?? 0) : 0;
    const stat = stats.find((x) => x.source === s.id);
    return {
      ...s,
      n: i + 1,
      state,
      stateLabel: LABEL[state],
      keyOrigin,
      missingKeys,
      lastRun: last ? { status: last.status, at: last.created_at, found: last.found, message: last.message, cached: last.cached } : null,
      runs7d: {
        ok: mine.filter((r) => r.status === "ok" && !r.cached).length,
        problems: mine.filter((r) => r.status !== "ok").length,
        cached: mine.filter((r) => r.cached).length,
      },
      budget: b && keyOrigin === "platform" ? { used, limit: b.limit, period: b.period } : null,
      quality: stat
        ? {
            offers: Number(stat.offers),
            links: Number(stat.links),
            analyzed: Number(stat.analyzed),
            avgScore: stat.avg_score === null ? null : Number(stat.avg_score),
            strong: Number(stat.strong),
            suspected: Number(stat.suspected),
            toReview: Number(stat.to_review),
            unreadable: Number(stat.unreadable),
          }
        : null,
      companies: followed,
    };
  });

  const hasCreds = has("FRANCE_TRAVAIL_CLIENT_ID") && has("FRANCE_TRAVAIL_CLIENT_SECRET");
  const enrichment: AdminEnrichment[] = ENRICHMENT_SOURCES.map((e, i) => {
    const missing: string[] = [];
    if (!e.unused) {
      if (!hasCreds) missing.push("FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET");
      if (!has(e.scopeVar)) missing.push(e.scopeVar);
      if (!has(e.urlVar)) missing.push(e.urlVar);
    }
    const mine = runs.filter((r) => r.source === e.id);
    const last = mine[0] ?? null;
    return {
      ...e,
      n: i + 1,
      ready: !e.unused && missing.length === 0,
      missing,
      lastRun: last ? { status: last.status, at: last.created_at, message: last.message } : null,
    };
  });

  const usage = ((usageRes.data ?? []) as { kind: string }[]).reduce(
    (acc, r) => ((acc[r.kind as keyof typeof acc] = (acc[r.kind as keyof typeof acc] ?? 0) + 1), acc),
    { scan: 0, analysis: 0, generation: 0 },
  );
  const unlockRunsRes = await (all ?? db).from("agent_runs").select("created_at,status,counters").eq("run_type", "DAILY_UNLOCK").order("created_at", { ascending: false }).limit(8);
  const recent = ((unlockRunsRes.data ?? []) as { created_at: string; status: string; counters: Record<string, unknown> | null }[]).map((r) => ({
    at: r.created_at,
    ok: r.status === "COMPLETED",
    step: String(r.counters?.step ?? ""),
    totalMs: Number(r.counters?.totalMs ?? 0) || 0,
    newlyUnlocked: Number(r.counters?.newlyUnlocked ?? 0) || 0,
    note: typeof r.counters?.note === "string" ? r.counters.note : null,
  }));
  const unlockProbe = await db.from("offer_unlocks").select("offer_id").limit(1);
  const catalogueOnly = studentCatalogueOnly(env);
  const dailyUnlock: AdminOverview["dailyUnlock"] = unlockProbe.error
    ? { status: "not_installed", catalogueOnly, recent: [], message: "Sélection quotidienne non installée : la migration 20261009090000 n’est pas appliquée, aucune offre n’est verrouillée." }
    : catalogueOnly
      ? { status: "active", catalogueOnly, recent, message: "Sélection quotidienne active, recherche des sites d’emploi fermée pour les étudiants." }
      : { status: "external_open", catalogueOnly, recent, message: "Sélection quotidienne active mais recherche externe encore ouverte : ajoute STUDENT_CATALOGUE_ONLY=1 dans Vercel." };
  const cronConfigured = has("CRON_SECRET") && has("SUPABASE_SERVICE_ROLE_KEY");
  const lastServerRun = ((serverRunRes.data ?? []) as { created_at: string }[])[0]?.created_at ?? null;

  // What the admin has to do by hand, most important first.
  const actions: AdminAction[] = [];
  if (dailyUnlock.status === "external_open") actions.push({ level: "required", text: dailyUnlock.message });
  const api = sources.filter((s) => s.kind === "api");
  if (!aiConfigured(env)) actions.push({ level: "required", text: "Configure le fournisseur IA dans Vercel pour lire les offres et rédiger les CV et lettres. La comparaison des compétences reste disponible sans appel IA." });
  if (!api.some((s) => s.keyOrigin !== "none") && !sources.some((s) => s.kind === "careers" && s.companies))
    actions.push({ level: "required", text: "Aucune source d’offres active : ajoute au moins France Travail (gratuit) dans Vercel." });
  for (const s of sources) {
    if (s.state === "auth") actions.push({ level: "required", text: `${s.name} : clé refusée. Remplace-la dans Vercel (ou Réglages).` });
    if (s.state === "quota") actions.push({ level: "recommended", text: `${s.name} : quota du fournisseur épuisé. Les autres sources continuent ; passe au plan supérieur si ça se répète.` });
    if (s.state === "budget") actions.push({ level: "recommended", text: `${s.name} : budget gratuit atteint pour la période. Rien à faire si c’est voulu ; sinon augmente la limite ou passe au plan payant.` });
    if (s.state === "error") actions.push({ level: "recommended", text: `${s.name} : en erreur (${s.lastRun?.message?.slice(0, 120) ?? "voir le détail"}).` });
    if (s.budget && s.budget.limit > 0 && s.budget.used / s.budget.limit >= 0.9 && s.state !== "budget")
      actions.push({ level: "recommended", text: `${s.name} : ${s.budget.used}/${s.budget.limit} appels utilisés sur la période.` });
  }
  for (const id of ["francetravail", "jsearch"]) {
    const s = sources.find((x) => x.id === id)!;
    if (s.keyOrigin !== "platform")
      actions.push({
        level: "recommended",
        text: `Ajoute ${s.keys.join(" et ")} dans Vercel pour activer ${s.name} pour tous les comptes${s.keyOrigin === "account" ? " (aujourd’hui la clé n’est que sur ton compte)" : ""}.`,
      });
  }
  if (!cronConfigured)
    actions.push({ level: "recommended", text: "Ajoute CRON_SECRET et SUPABASE_SERVICE_ROLE_KEY dans Vercel : recherche automatique même appli fermée + cache partagé entre comptes." });
  else if (!lastServerRun || now.getTime() - Date.parse(lastServerRun) > 26 * 3_600_000)
    actions.push({ level: "recommended", text: "La recherche automatique n’a pas tourné depuis plus d’un jour : programme l’appel toutes les 30 min dans Supabase (docs/SCANNER.md §5)." });
  if (!sources.some((s) => s.kind === "careers" && s.companies))
    actions.push({ level: "recommended", text: "Ajoute des pages carrière d’entreprises dans Réglages > Recherche (gratuit, sans clé)." });
  const toFinish = enrichment.filter((e) => !e.ready && !e.unused);
  if (hasCreds && toFinish.length)
    actions.push({
      level: "recommended",
      text: `Termine les API France Travail secondaires (${toFinish.map((e) => e.name).join(", ")}) : ajoute leur scope et leur URL dans Vercel (valeurs exactes dans la section « Enrichissement » ci-dessous).`,
    });
  if (has("WORKER_BASE_URL") && ctx.worker && !ctx.worker.online)
    actions.push({ level: "recommended", text: "Le worker Playwright (Railway) ne répond pas : les formulaires ne seront pas lus." });
  actions.push({ level: "before_launch", text: "Active la protection des mots de passe compromis dans Supabase (Authentication > Security)." });
  for (const s of sources) if (s.launchNote && s.keyOrigin !== "none") actions.push({ level: "before_launch", text: `${s.name} : ${s.launchNote}` });

  return {
    ai: {
      provider: (env.AI_PROVIDER || "gemini").toLowerCase() === "gemini" ? "Google Gemini" : String(env.AI_PROVIDER),
      configured: aiConfigured(env),
      analysisModel: modelFor("analysis", env),
      writingModel: modelFor("writing", env),
      usageToday: usage,
      advice: AI_ADVICE,
    },
    embeddings: env.EMBEDDING_PROVIDER === "gateway" ? {
      status: has("AI_GATEWAY_API_KEY") ? "Perplexity configuré" : "Clé Gateway manquante",
      what: "Classement par proximité sémantique et compétences. Les vecteurs du catalogue sont partagés ; le profil est recalculé seulement lorsque ses faits changent.",
      tools: "Supabase pgvector + perplexity/pplx-embed-v1-0.6b, 1 024 dimensions. Le contrôle du rattrapage reste visible dans les rapports du catalogue.",
    } : {
      ...EMBEDDINGS_PLAN,
      status: has("GEMINI_API_KEY") ? "Gemini historique configuré" : "Fournisseur non configuré",
    },
    sources,
    enrichment,
    notConnected: NOT_CONNECTED,
    automation: { cronConfigured, sharedCache: has("SUPABASE_SERVICE_ROLE_KEY"), lastServerRun },
    dailyUnlock,
    worker: {
      configured: has("WORKER_BASE_URL") && has("WORKER_SHARED_SECRET"),
      online: ctx.worker?.online ?? false,
      browserReady: ctx.worker?.browserReady ?? null,
    },
    drive: has("GOOGLE_SERVICE_ACCOUNT_JSON") && has("GOOGLE_DRIVE_CVS_FOLDER_ID") && has("GOOGLE_DRIVE_LETTERS_FOLDER_ID"),
    alerts: ((alertsRes.data ?? []) as { title: string; message: string; created_at: string; read_at: string | null }[]).map((a) => ({
      title: a.title,
      message: a.message,
      at: a.created_at,
      read: Boolean(a.read_at),
    })),
    actions,
  };
}
