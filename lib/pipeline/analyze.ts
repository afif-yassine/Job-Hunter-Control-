import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AI_NOT_CONFIGURED, aiConfigured, defaultAi, type AiCall } from "@/lib/ai";
import { fetchMarketInsight, marketApiReady } from "@/lib/france-travail/market";
import { consumeQuota, quotaRefusal } from "@/lib/quota";
import { fetchJobText } from "@/lib/scan/enrich";
import { recordSourceRun } from "@/lib/scan/health";
import { detectSuspicion } from "@/lib/scan/suspicion";

const output = z.object({
  score_breakdown: z.record(z.string(), z.number()),
  total: z.number().min(0).max(100),
  verified_strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  questions: z.array(z.string()),
  cv_summary: z.string(),
  suspicion: z
    .object({
      level: z.enum(["none", "low", "high"]).catch("none"),
      reasons: z.array(z.string()).catch([]),
    })
    .optional()
    .catch(undefined),
});

export type StepResult = { status: number; body: Record<string, unknown> };

/** Below this, a description is certainly an extract, whatever its source. */
export const FULL_TEXT = 1500;

/**
 * Sources whose API already returns the whole ad (France Travail, companies'
 * careers pages): reading the page again adds nothing and costs time in the
 * scheduled run's 45 s budget. Every other source (JSearch, Adzuna, Jooble,
 * e-mail alerts, manual links…) may have cut the text, even a long one.
 */
export function hasFullTextNatively(source: string | null | undefined): boolean {
  return source === "francetravail" || Boolean(source?.startsWith("ats:"));
}

/**
 * Should the ad page's text replace the stored one? Any gain for a short
 * extract; for a text that already looks complete, only a clear gain (+20 %),
 * since menus and footers alone can make a page slightly longer.
 */
export function pageIsBetter(current: string | null | undefined, page: string | null): page is string {
  if (!page) return false;
  const length = current?.length ?? 0;
  return length < FULL_TEXT ? page.length > length : page.length >= length * 1.2;
}

type Ctx = {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  env?: Record<string, string | undefined>;
  ai?: AiCall;
  fetchPage?: (url: string) => Promise<string | null>;
};

async function updateJob(ctx: Ctx, patch: Record<string, unknown>) {
  const run = (p: Record<string, unknown>) =>
    ctx.supabase.from("jobs").update(p).eq("id", ctx.jobId).eq("user_id", ctx.userId);
  const { error } = await run(patch);
  if (error && /column|schema cache|42703|PGRST204/i.test(`${error.code} ${error.message}`)) {
    // Database not migrated yet: save what the old schema knows.
    const rest = { ...patch };
    for (const c of [
      "score_model",
      "review_flag",
      "review_reason",
      "duplicate_of",
      "market_tension_label",
      "market_note",
      "training_suggestions",
    ])
      delete rest[c];
    await run(rest);
  }
}

/** "75 - PARIS 08" → "75". Only France Travail's own offers carry this shape. */
function departmentOf(location: string | null | undefined): string | null {
  const m = location?.match(/^(\d{2,3})\s*-/);
  return m ? m[1] : null;
}

/**
 * Best-effort context from France Travail's "Marché du travail" API: only
 * for offers that came from France Travail itself (only they carry a ROME
 * code), never blocks or fails the analysis.
 *
 * Open Formation was dropped from here (confirmed Sept 2026): its 3
 * endpoints only look up RDV/candidature windows for an already-known
 * formation (by numeroSession/numeroAction/numeroFormation) — it has no
 * search-by-métier endpoint, so it can't power a "suggest a training"
 * feature. See lib/france-travail/formation.ts for the full note.
 */
async function enrichWithFranceTravail(
  ctx: Ctx,
  job: { rome_code?: string | null; location?: string | null },
): Promise<void> {
  const env = ctx.env ?? process.env;
  const romeCode = job.rome_code?.trim();
  if (!romeCode) return;
  const department = departmentOf(job.location);
  const patch: Record<string, unknown> = {};

  if (marketApiReady(env)) {
    try {
      const market = await fetchMarketInsight({ romeCode, department }, env);
      await recordSourceRun(ctx.supabase, "ft:marche", "ok", market ? 1 : 0);
      if (market?.jobseekerCount != null)
        patch.market_note = `${market.jobseekerCount} demandeur(s) d’emploi inscrit(s) sur ce métier dans le département${department ? ` ${department}` : ""}${market.period ? ` (${market.period})` : ""}`;
    } catch (e) {
      await recordSourceRun(ctx.supabase, "ft:marche", "error", 0, e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  if (Object.keys(patch).length) await updateJob(ctx, patch);
}

/**
 * Scores one offer against the verified profile. Used by the dashboard button,
 * the browser pipeline and the scheduled server run.
 */
export async function analyzeJob(ctx: Ctx): Promise<StepResult> {
  const env = ctx.env ?? process.env;
  if (!ctx.ai && !aiConfigured(env)) return { status: 503, body: { error: AI_NOT_CONFIGURED } };
  const [{ data: job, error }, { data: profile }] = await Promise.all([
    ctx.supabase.from("jobs").select("*").eq("id", ctx.jobId).eq("user_id", ctx.userId).single(),
    ctx.supabase.from("candidate_profiles").select("profile,truth_ledger").eq("user_id", ctx.userId).maybeSingle(),
  ]);
  if (error || !job) return { status: 404, body: { error: "Offer not found" } };
  if (job.gone_reason)
    return {
      status: 410,
      body: { error: "Cette offre n’est plus disponible : rien n’a été dépensé dessus.", code: "GONE" },
    };
  if (job.review_flag)
    return {
      status: 409,
      body: { error: "Cette offre est dans « À vérifier » : confirme-la d’abord.", code: "TO_REVIEW" },
    };

  // Always score the full ad: read the page unless the source is known to give
  // the whole text already (best effort; never gets around a protection).
  if ((job.description?.length ?? 0) < FULL_TEXT || !hasFullTextNatively(job.source_platform)) {
    const page = await (ctx.fetchPage ?? fetchJobText)(job.official_url || job.source_url || "");
    if (pageIsBetter(job.description, page)) {
      job.description = page;
      await updateJob(ctx, { description: page });
    }
  }
  if (!job.description || job.description.length < 80) {
    // Remember the attempt so the pipeline does not retry this offer every run.
    await updateJob(ctx, { last_checked_at: new Date().toISOString() });
    return {
      status: 400,
      body: {
        error:
          "Impossible de lire l’annonce automatiquement : ouvre l’offre et colle sa description (bouton « Coller la description »).",
      },
    };
  }

  // Obvious scams never reach the AI.
  const signals = detectSuspicion(job);
  if (signals.level === "high") {
    const reason = signals.reasons.join(" · ");
    await updateJob(ctx, { review_flag: "SUSPECTED", review_reason: reason, last_checked_at: new Date().toISOString() });
    return { status: 200, body: { suspected: true, reasons: signals.reasons } };
  }

  if (!profile) return { status: 409, body: { error: "Le profil vérifié n’est pas encore synchronisé." } };

  const quota = await consumeQuota(ctx.supabase, ctx.userId, "analysis", env);
  if (!quota.ok) return quotaRefusal("analysis", quota.limit);

  const hints = signals.reasons.length ? `\nSIGNAUX_A_VERIFIER=${JSON.stringify(signals.reasons)}` : "";
  const prompt = `Analyse cette offre uniquement avec le profil et le registre de vérité. N'invente jamais une compétence, une expérience, une date, un statut légal ou un diplôme. Réponds en JSON: score_breakdown avec contract/20, mission/20, technical/25, education/15, experience/10, location/10; total sur 100; verified_strengths; gaps; questions; cv_summary; suspicion {level: "none"|"low"|"high", reasons: string[]} — "high" seulement pour une offre qui ressemble à une arnaque (paiement demandé au candidat, entreprise invérifiable, contact uniquement par messagerie ou e-mail personnel, promesse de gains, mission sans rapport avec l'intitulé), jamais pour une simple offre peu adaptée au profil.\nPROFIL=${JSON.stringify(profile.profile)}\nREGISTRE=${JSON.stringify(profile.truth_ledger)}\nOFFRE=${JSON.stringify({
    company: job.company,
    title: job.title,
    contract_type: job.contract_type,
    location: job.location,
    description: job.description,
  })}${hints}`;
  try {
    const result = await (ctx.ai ?? defaultAi)(prompt, "analysis");
    const parsed = output.safeParse(JSON.parse(result.text || "{}"));
    if (!parsed.success) return { status: 502, body: { error: "Réponse Gemini invalide ou vide" } };
    const { suspicion, ...analysis } = parsed.data;
    const suspected = suspicion?.level === "high";
    await updateJob(ctx, {
      match_score: Math.round(analysis.total),
      score_breakdown: analysis,
      status: "ANALYZED",
      score_model: result.model,
      last_checked_at: new Date().toISOString(),
      ...(suspected
        ? { review_flag: "SUSPECTED", review_reason: suspicion.reasons.join(" · ") || "Signalée par l’analyse IA" }
        : {}),
    });
    await ctx.supabase.from("audit_events").insert({
      user_id: ctx.userId,
      entity_type: "job",
      entity_id: ctx.jobId,
      action: "ANALYZED",
      details: { score: analysis.total, model: result.model, suspected },
    });
    if (!suspected) await enrichWithFranceTravail(ctx, job).catch(() => {});
    return { status: 200, body: { ...analysis, suspected, reasons: suspected ? suspicion.reasons : [] } };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erreur inconnue Gemini";
    return { status: 502, body: { error: `Analyse Gemini impossible : ${detail}` } };
  }
}
