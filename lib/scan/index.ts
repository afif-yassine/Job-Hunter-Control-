import type { SupabaseClient } from "@supabase/supabase-js";
import { isRelevant, loadScanConfig } from "./config";
import { ingestOffers } from "./ingest";
import { scanFranceTravail } from "./sources/francetravail";
import { scanGmailAlerts } from "./sources/gmail";
import type { ScanSummary, ScannedOffer, SourceReport } from "./types";

const has = (name: string) => Boolean(process.env[name]?.trim());

export const SETUP_HINT =
  "Aucune source de scan n'est configurée. Ajoute dans Vercel : FRANCE_TRAVAIL_CLIENT_ID + FRANCE_TRAVAIL_CLIENT_SECRET (offres officielles) et/ou GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN (alertes LinkedIn / Indeed / Hellowork / APEC / Welcome to the Jungle). Voir docs/SCANNER.md.";

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
  if (!response.ok) throw new Error(`Le scanner externe a répondu HTTP ${response.status}`);
  const body = (await response.json().catch(() => ({}))) as { offers?: ScannedOffer[] };
  return Array.isArray(body.offers) ? body.offers : [];
}

export async function runScan(ctx: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<ScanSummary> {
  const config = loadScanConfig();
  const reports: SourceReport[] = [];
  const collected: ScannedOffer[] = [];

  const sources: {
    name: string;
    enabled: boolean;
    missing: string;
    run: () => Promise<ScannedOffer[]>;
  }[] = [
    {
      name: "France Travail",
      enabled: has("FRANCE_TRAVAIL_CLIENT_ID") && has("FRANCE_TRAVAIL_CLIENT_SECRET"),
      missing: "FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET",
      run: () => scanFranceTravail(config),
    },
    {
      name: "Alertes e-mail (Gmail)",
      enabled: has("GMAIL_CLIENT_ID") && has("GMAIL_CLIENT_SECRET") && has("GMAIL_REFRESH_TOKEN"),
      missing: "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN",
      run: () => scanGmailAlerts(process.env, Math.min(config.maxAgeDays, 14)),
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
        reports.push({ source: source.name, status: "skipped", found: 0, message: `Non configuré (${source.missing})` });
        return;
      }
      try {
        const offers = await source.run();
        collected.push(...offers);
        reports.push({ source: source.name, status: "ok", found: offers.length });
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

  const configured = sources.some((s) => s.enabled);
  const relevant = collected.filter(isRelevant);
  const ingest = await ingestOffers(ctx.supabase, ctx.userId, relevant);
  if (ingest.error)
    reports.push({ source: "Base de données", status: "error", found: 0, message: ingest.error });

  const summary: ScanSummary = {
    reports,
    found: collected.length,
    relevant: relevant.length,
    inserted: ingest.inserted,
    duplicates: ingest.duplicates,
    needsDescription: ingest.needsDescription,
    configured,
  };

  if (configured) {
    await ctx.supabase.from("agent_runs").insert({
      user_id: ctx.userId,
      run_type: "OFFER_SCAN",
      status: reports.some((r) => r.status === "error") ? "FAILED" : "COMPLETED",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      counters: {
        found: summary.found,
        relevant: summary.relevant,
        inserted: summary.inserted,
        duplicates: summary.duplicates,
      },
      error_message:
        reports
          .filter((r) => r.status === "error")
          .map((r) => `${r.source}: ${r.message}`)
          .join(" | ") || null,
    });
    if (summary.inserted)
      await ctx.supabase.from("notifications").insert({
        user_id: ctx.userId,
        notification_type: "NEW_OFFERS",
        title: `${summary.inserted} nouvelle(s) offre(s)`,
        message: `${summary.duplicates} doublon(s) ignoré(s)${summary.needsDescription ? ` · ${summary.needsDescription} offre(s) à compléter avec la description` : ""}.`,
        delivery_channels: ["dashboard"],
      });
  }
  return summary;
}

export function scanMessage(s: ScanSummary): string {
  if (!s.configured) return SETUP_HINT;
  const errors = s.reports.filter((r) => r.status === "error");
  const head = `Scan terminé : ${s.found} offre(s) trouvée(s), ${s.relevant} pertinente(s), ${s.inserted} nouvelle(s), ${s.duplicates} doublon(s) ignoré(s).`;
  const extra = s.needsDescription
    ? ` ${s.needsDescription} offre(s) sans description : colle-la pour activer l’analyse.`
    : "";
  const problems = errors.length
    ? ` Erreur : ${errors.map((e) => `${e.source} — ${e.message}`).join(" ; ")}`
    : "";
  return head + extra + problems;
}
