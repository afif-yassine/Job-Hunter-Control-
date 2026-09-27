import type { SupabaseClient } from "@supabase/supabase-js";
import { loadIntegrationEnv } from "@/lib/integrations";
import { loadUserSettings, saveUserSettings } from "@/lib/settings";
import { configFromPrefs, isRelevant } from "./config";
import { ingestOffers } from "./ingest";
import { scanAdzuna } from "./sources/adzuna";
import { scanAts } from "./sources/ats";
import { scanFranceTravail } from "./sources/francetravail";
import { scanGmailAlerts } from "./sources/gmail";
import { scanJooble } from "./sources/jooble";
import { scanJSearch } from "./sources/jsearch";
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

export async function runScan(ctx: {
  supabase: SupabaseClient;
  userId: string;
  /** Overrides the environment (tests). */
  env?: Record<string, string | undefined>;
  /** Write an OFFER_SCAN line in the journal (default true). */
  log?: boolean;
}): Promise<ScanSummary> {
  // Keys typed in the dashboard win over Vercel variables.
  const env = ctx.env ?? {
    ...process.env,
    ...(await loadIntegrationEnv(ctx.supabase, ctx.userId)),
  };
  const has = (name: string) => Boolean(env[name]?.trim());
  const settings = await loadUserSettings(ctx.supabase, ctx.userId);
  const config = configFromPrefs(settings.prefs);
  const reports: SourceReport[] = [];
  const collected: ScannedOffer[] = [];
  const warnings = new Map<string, string>();

  const sources: {
    name: string;
    enabled: boolean;
    missing: string;
    run: () => Promise<ScannedOffer[]>;
  }[] = [
    {
      name: "JSearch (LinkedIn, Indeed, WTTJ…)",
      enabled: has("JSEARCH_API_KEY"),
      missing: "JSEARCH_API_KEY",
      run: () => scanJSearch(config, env),
    },
    {
      name: "Adzuna",
      enabled: has("ADZUNA_APP_ID") && has("ADZUNA_APP_KEY"),
      missing: "ADZUNA_APP_ID / ADZUNA_APP_KEY",
      run: () => scanAdzuna(config, env),
    },
    {
      name: "France Travail",
      enabled:
        has("FRANCE_TRAVAIL_CLIENT_ID") && has("FRANCE_TRAVAIL_CLIENT_SECRET"),
      missing: "FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET",
      run: () => scanFranceTravail(config, env),
    },
    {
      name: "Jooble",
      enabled: has("JOOBLE_API_KEY"),
      missing: "JOOBLE_API_KEY",
      run: () => scanJooble(config, env),
    },
    {
      name: "Alertes e-mail (Gmail)",
      enabled:
        has("GMAIL_CLIENT_ID") &&
        has("GMAIL_CLIENT_SECRET") &&
        has("GMAIL_REFRESH_TOKEN"),
      missing: "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN",
      run: () => scanGmailAlerts(env, Math.min(config.maxAgeDays, 14)),
    },
    {
      name: "Pages carrière (Greenhouse, Lever, Ashby…)",
      enabled: config.targets.length > 0,
      missing: "aucune entreprise ajoutée dans Réglages > Recherche",
      run: async () => {
        const result = await scanAts(config.targets, config);
        if (result.errors.length) {
          if (!result.offers.length && result.errors.length === config.targets.length)
            throw new Error(result.errors.slice(0, 3).join(" ; "));
          warnings.set("Pages carrière (Greenhouse, Lever, Ashby…)", result.errors.slice(0, 3).join(" ; "));
        }
        return result.offers;
      },
    },
    {
      name: "Scanner externe (SCAN_WEBHOOK_URL)",
      enabled: has("SCAN_WEBHOOK_URL"),
      missing: "SCAN_WEBHOOK_URL",
      run: () => callWebhook(ctx.userId),
    },
  ];

  await Promise.all(
    sources.map(async (source) => {
      if (!source.enabled) {
        reports.push({
          source: source.name,
          status: "skipped",
          found: 0,
          message: `Non configuré (${source.missing})`,
        });
        return;
      }
      try {
        const offers = await source.run();
        collected.push(...offers);
        reports.push({
          source: source.name,
          status: "ok",
          found: offers.length,
          message: warnings.get(source.name),
        });
      } catch (error) {
        reports.push({
          source: source.name,
          status: "error",
          found: 0,
          message: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }),
  );

  // Company careers pages alone do not need any key.
  const configured = sources.some((s) => s.enabled);
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
  const extra = s.needsDescription
    ? ` ${s.needsDescription} offre(s) sans description : colle-la pour activer l’analyse.`
    : "";
  const problems = errors.length
    ? ` Erreur : ${errors.map((e) => `${e.source} — ${e.message}`).join(" ; ")}`
    : "";
  return head + extra + problems;
}
