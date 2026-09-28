import type { SupabaseClient } from "@supabase/supabase-js";
import { loadIntegrationEnv } from "@/lib/integrations";
import { loadUserSettings, saveUserSettings } from "@/lib/settings";
import { configFromPrefs, isRelevant } from "./config";
import { ingestOffers } from "./ingest";
import { scanAdzuna } from "./sources/adzuna";
import { discoveredTargets, loadDiscovered, mergeDiscovered, saveDiscovered } from "./discover";
import { scanAts, targetKey } from "./sources/ats";
import { scanFranceTravail } from "./sources/francetravail";
import { scanGmailAlerts } from "./sources/gmail";
import { scanJooble } from "./sources/jooble";
import { scanJSearch } from "./sources/jsearch";
import { serviceClient } from "@/lib/supabase/admin";
import {
  BudgetReached,
  budgetedFetch,
  budgetFor,
  cacheHours,
  cacheKey,
  classifyError,
  readCache,
  recordSourceRun,
  writeCache,
  type SourceId,
} from "./health";
import type { ScanSummary, ScannedOffer, SourceReport } from "./types";

export const SETUP_HINT =
  "Aucune source d’offres n’est connectée. Va dans Réglages > Sources et ajoute une clé gratuite (JSearch couvre LinkedIn, Indeed, Welcome to the Jungle… en 3 minutes).";

async function callWebhook(userId: string): Promise<ScannedOffer[]> {
  const response = await fetch(process.env.SCAN_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.SCAN_WEBHOOK_SECRET || ""}`,
    },
    body: JSON.stringify({ user_id: userId, mode: "PREPARE_ONLY" }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!response.ok)
    throw new Error(`Le scanner externe a répondu HTTP ${response.status}`);
  const body = (await response.json().catch(() => ({}))) as {
    offers?: ScannedOffer[];
  };
  return Array.isArray(body.offers) ? body.offers : [];
}

type SourceDef = {
  id: SourceId;
  name: string;
  enabled: boolean;
  missing: string;
  /** Environment variables holding its key (to know whose key is used). */
  keys: string[];
  /** Same results for every account with the same search → shared cache. */
  cacheable: boolean;
  run: (fetchImpl: typeof fetch) => Promise<ScannedOffer[]>;
};

export async function runScan(ctx: {
  supabase: SupabaseClient;
  userId: string;
  /** Overrides the environment (tests). */
  env?: Record<string, string | undefined>;
  /** Write an OFFER_SCAN line in the journal (default true). */
  log?: boolean;
  /** Service client for the shared cache (defaults to SUPABASE_SERVICE_ROLE_KEY). */
  cacheDb?: SupabaseClient | null;
}): Promise<ScanSummary> {
  // Keys typed in the dashboard win over Vercel variables.
  const env = ctx.env ?? {
    ...process.env,
    ...(await loadIntegrationEnv(ctx.supabase, ctx.userId)),
  };
  const has = (name: string) => Boolean(env[name]?.trim());
  // A platform key (Vercel) is shared by every account: its free budget and
  // cache are shared too. A key typed by one account stays its own.
  const platformKey = (keys: string[]) => keys.every((k) => process.env[k] && env[k] === process.env[k]);
  const settings = await loadUserSettings(ctx.supabase, ctx.userId);
  const config = configFromPrefs(settings.prefs);
  // Companies the app found by itself on a recruitment platform (see discover.ts)
  // are read like the ones typed in Réglages. null = column not migrated yet.
  const discovered = await loadDiscovered(ctx.supabase, ctx.userId);
  const manualKeys = new Set(config.targets.map(targetKey));
  if (discovered)
    for (const t of discoveredTargets(discovered)) if (!manualKeys.has(targetKey(t))) config.targets.push(t);
  const reports: SourceReport[] = [];
  const collected: ScannedOffer[] = [];
  const cacheDb = ctx.cacheDb !== undefined ? ctx.cacheDb : serviceClient();
  const ttl = cacheHours(env);
  const searchKey = { q: config.queries, city: config.city, dep: config.departments, days: config.maxAgeDays };

  const sources: SourceDef[] = [
    {
      id: "francetravail",
      name: "France Travail",
      enabled: has("FRANCE_TRAVAIL_CLIENT_ID") && has("FRANCE_TRAVAIL_CLIENT_SECRET"),
      missing: "FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET",
      keys: ["FRANCE_TRAVAIL_CLIENT_ID", "FRANCE_TRAVAIL_CLIENT_SECRET"],
      cacheable: true,
      run: (f) => scanFranceTravail(config, env, f),
    },
    {
      id: "jsearch",
      name: "JSearch (LinkedIn, Indeed, WTTJ…)",
      enabled: has("JSEARCH_API_KEY"),
      missing: "JSEARCH_API_KEY",
      keys: ["JSEARCH_API_KEY"],
      cacheable: true,
      run: (f) => scanJSearch(config, env, f),
    },
    {
      id: "adzuna",
      name: "Adzuna",
      enabled: has("ADZUNA_APP_ID") && has("ADZUNA_APP_KEY"),
      missing: "ADZUNA_APP_ID / ADZUNA_APP_KEY",
      keys: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
      cacheable: true,
      run: (f) => scanAdzuna(config, env, f),
    },
    {
      id: "jooble",
      name: "Jooble",
      enabled: has("JOOBLE_API_KEY"),
      missing: "JOOBLE_API_KEY",
      keys: ["JOOBLE_API_KEY"],
      cacheable: true,
      run: (f) => scanJooble(config, env, f),
    },
    {
      id: "gmail",
      name: "Alertes e-mail (Gmail)",
      enabled: has("GMAIL_CLIENT_ID") && has("GMAIL_CLIENT_SECRET") && has("GMAIL_REFRESH_TOKEN"),
      missing: "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN",
      keys: ["GMAIL_REFRESH_TOKEN"],
      cacheable: false,
      run: () => scanGmailAlerts(env, Math.min(config.maxAgeDays, 14)),
    },
    {
      id: "webhook",
      name: "Scanner externe (SCAN_WEBHOOK_URL)",
      enabled: has("SCAN_WEBHOOK_URL"),
      missing: "SCAN_WEBHOOK_URL",
      keys: ["SCAN_WEBHOOK_URL"],
      cacheable: false,
      run: () => callWebhook(ctx.userId),
    },
  ];

  const runSource = async (source: SourceDef) => {
    if (!source.enabled) {
      reports.push({ source: source.name, status: "skipped", found: 0, message: `Non configuré (${source.missing})` });
      return;
    }
    const shared = platformKey(source.keys);
    const key = cacheKey({ source: source.id, ...searchKey });
    const cached = source.cacheable && shared ? await readCache(cacheDb, source.id, key, ttl) : null;
    if (cached) {
      collected.push(...cached);
      reports.push({ source: source.name, status: "ok", found: cached.length, message: "Résultat récent réutilisé (cache)" });
      await recordSourceRun(ctx.supabase, source.id, "ok", cached.length, null, true);
      return;
    }
    const budget = shared ? budgetFor(source.id, env) : null;
    const fetchImpl = budget ? budgetedFetch(ctx.supabase, source.id, budget) : fetch;
    try {
      const offers = await source.run(fetchImpl);
      collected.push(...offers);
      reports.push({ source: source.name, status: "ok", found: offers.length });
      await recordSourceRun(ctx.supabase, source.id, "ok", offers.length);
      if (source.cacheable && shared) await writeCache(cacheDb, source.id, key, offers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      if (error instanceof BudgetReached) {
        // Not the user's problem: the other sources keep going, the admin is told.
        reports.push({ source: source.name, status: "skipped", found: 0, message });
        await recordSourceRun(ctx.supabase, source.id, "budget", 0, message);
        return;
      }
      reports.push({ source: source.name, status: "error", found: 0, message });
      await recordSourceRun(ctx.supabase, source.id, classifyError(message), 0, message);
    }
  };

  // Company careers pages: read per company, each one cached for everybody.
  const runCareers = async () => {
    const name = "Pages carrière (Greenhouse, Lever, Ashby…)";
    if (!config.targets.length) {
      reports.push({ source: name, status: "skipped", found: 0, message: "Non configuré (aucune entreprise ajoutée dans Réglages > Recherche)" });
      return;
    }
    const perAts = new Map<SourceId, { found: number; errors: string[] }>();
    const tally = (ats: string) => {
      const id = `ats:${ats}` as SourceId;
      if (!perAts.has(id)) perAts.set(id, { found: 0, errors: [] });
      return perAts.get(id)!;
    };
    const errors: string[] = [];
    let found = 0;
    let next = 0;
    const lane = async () => {
      while (next < config.targets.length) {
        const target = config.targets[next++];
        const id = `ats:${target.ats}` as SourceId;
        const key = cacheKey({ source: id, slug: target.slug, days: Math.max(config.maxAgeDays, 30), city: config.city });
        const cached = await readCache(cacheDb, id, key, ttl);
        if (cached) {
          collected.push(...cached);
          found += cached.length;
          tally(target.ats).found += cached.length;
          continue;
        }
        const result = await scanAts([target], config);
        collected.push(...result.offers);
        found += result.offers.length;
        tally(target.ats).found += result.offers.length;
        if (result.errors.length) {
          errors.push(...result.errors);
          tally(target.ats).errors.push(...result.errors);
        } else await writeCache(cacheDb, id, key, result.offers);
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, config.targets.length) }, lane));
    for (const [id, t] of perAts) {
      const allFailed = t.errors.length > 0 && t.found === 0;
      await recordSourceRun(ctx.supabase, id, allFailed ? classifyError(t.errors.join(" ")) : "ok", t.found, t.errors.slice(0, 3).join(" ; ") || null);
    }
    if (errors.length && !found && errors.length >= config.targets.length)
      reports.push({ source: name, status: "error", found: 0, message: errors.slice(0, 3).join(" ; ") });
    else
      reports.push({ source: name, status: "ok", found, message: errors.length ? errors.slice(0, 3).join(" ; ") : undefined });
  };

  await Promise.all([...sources.map(runSource), runCareers()]);

  // Learn new companies from the links of what was just found.
  let discoveredCount = 0;
  if (discovered) {
    const { next, added } = mergeDiscovered(discovered, collected, manualKeys);
    discoveredCount = added.length;
    if (JSON.stringify(next) !== JSON.stringify(discovered)) await saveDiscovered(ctx.supabase, ctx.userId, next);
  }

  // Company careers pages alone do not need any key.
  const configured = sources.some((s) => s.enabled) || config.targets.length > 0;
  const relevant = collected.filter(isRelevant);
  const ingest = await ingestOffers(ctx.supabase, ctx.userId, relevant);
  if (ingest.error)
    reports.push({
      source: "Base de données",
      status: "error",
      found: 0,
      message: ingest.error,
    });

  const summary: ScanSummary = {
    reports,
    found: collected.length,
    relevant: relevant.length,
    inserted: ingest.inserted,
    duplicates: ingest.duplicates,
    alreadyApplied: ingest.alreadyApplied,
    toReview: ingest.toReview,
    suspected: ingest.suspected,
    needsDescription: ingest.needsDescription,
    configured,
    discovered: discoveredCount,
  };

  if (configured) {
    await saveUserSettings(ctx.supabase, ctx.userId, {
      lastScanAt: new Date().toISOString(),
    });
    if (ctx.log !== false)
      await ctx.supabase.from("agent_runs").insert({
        user_id: ctx.userId,
        run_type: "OFFER_SCAN",
        status: reports.some((r) => r.status === "error")
          ? "FAILED"
          : "COMPLETED",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        counters: {
          found: summary.found,
          relevant: summary.relevant,
          inserted: summary.inserted,
          duplicates: summary.duplicates,
          alreadyApplied: summary.alreadyApplied,
          toReview: summary.toReview,
          suspected: summary.suspected,
        },
        error_message:
          reports
            .filter((r) => r.status === "error")
            .map((r) => `${r.source}: ${r.message}`)
            .join(" | ") || null,
      });
    if (summary.inserted && ctx.log !== false)
      await ctx.supabase.from("notifications").insert({
        user_id: ctx.userId,
        notification_type: "NEW_OFFERS",
        title: `${summary.inserted} nouvelle(s) offre(s)`,
        message: `${summary.duplicates} doublon(s) regroupé(s)${summary.alreadyApplied ? ` (dont ${summary.alreadyApplied} déjà postulée(s) ailleurs)` : ""}${summary.toReview + summary.suspected ? ` · ${summary.toReview + summary.suspected} à vérifier` : ""}${summary.needsDescription ? ` · ${summary.needsDescription} offre(s) à compléter avec la description` : ""}.`,
        delivery_channels: ["dashboard"],
      });
  }
  return summary;
}

export function scanMessage(s: ScanSummary): string {
  if (!s.configured) return SETUP_HINT;
  const errors = s.reports.filter((r) => r.status === "error");
  const head = `Scan terminé : ${s.found} offre(s) trouvée(s), ${s.relevant} pertinente(s), ${s.inserted} nouvelle(s), ${s.duplicates} doublon(s) regroupé(s)${s.alreadyApplied ? ` dont ${s.alreadyApplied} déjà postulée(s) ailleurs` : ""}.${s.toReview + s.suspected ? ` ${s.toReview + s.suspected} offre(s) à vérifier.` : ""}`;
  const learned = s.discovered
    ? ` ${s.discovered} entreprise(s) repérée(s) sur une plateforme de recrutement : leurs offres seront lues directement à la prochaine recherche.`
    : "";
  const extra = s.needsDescription
    ? ` ${s.needsDescription} offre(s) sans description : colle-la pour activer l’analyse.`
    : "";
  const problems = errors.length
    ? ` Erreur : ${errors.map((e) => `${e.source} — ${e.message}`).join(" ; ")}`
    : "";
  return head + learned + extra + problems;
}
