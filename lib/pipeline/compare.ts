import type { SupabaseClient } from "@supabase/supabase-js";
import { fitScore } from "../fit";
import { PROFILE_REQUIRED, PROFILE_REQUIRED_MESSAGE } from "../profile-store";
import { normalizeSkills, profileSkills } from "../skills";
import { detectSuspicion } from "../scan/suspicion";
import type { StepResult } from "./analyze";

export const SKILLS_SCORE_MODEL = "skills-v1";

/** The standard journey never buys a personal LLM analysis to calculate a score. */
export async function compareJob(ctx: { supabase: SupabaseClient; userId: string; jobId: string }): Promise<StepResult> {
  const [{ data: job, error: jobError }, { data: profile, error: profileError }] = await Promise.all([
    ctx.supabase.from("jobs").select("*,offers(summary)").eq("id", ctx.jobId).eq("user_id", ctx.userId).maybeSingle(),
    ctx.supabase.from("candidate_profiles").select("profile").eq("user_id", ctx.userId).maybeSingle(),
  ]);
  if (jobError || profileError) return { status: 503, body: { error: "Comparaison indisponible. Réessaie dans quelques instants." } };
  if (!job) return { status: 404, body: { error: "Offre introuvable." } };
  if (job.gone_reason) return { status: 410, body: { error: "Cette offre n’est plus disponible.", code: "GONE" } };
  if (job.review_flag) return { status: 409, body: { error: "Confirme d’abord cette offre dans « À vérifier ».", code: "TO_REVIEW" } };
  if (!profile?.profile) return { status: 409, body: { error: PROFILE_REQUIRED_MESSAGE, code: PROFILE_REQUIRED } };
  const suspicion = detectSuspicion(job);
  if (suspicion.level === "high") {
    const { error } = await ctx.supabase.from("jobs").update({ review_flag: "SUSPECTED", review_reason: suspicion.reasons.join(" · "), last_checked_at: new Date().toISOString() }).eq("id", ctx.jobId).eq("user_id", ctx.userId);
    if (error) return { status: 503, body: { error: "La mise à vérifier de l’offre n’a pas pu être sauvegardée." } };
    return { status: 200, body: { suspected: true, reasons: suspicion.reasons } };
  }
  const asked = normalizeSkills(job.offers?.summary?.skills);
  const proven = new Set(profileSkills(profile.profile));
  const matched = asked.filter(skill => proven.has(skill));
  const missing = asked.filter(skill => !proven.has(skill));
  // No semantic numeric grade until calibration. Unknown requirements remain unknown.
  const fit = fitScore(null, matched, missing, SKILLS_SCORE_MODEL);
  const comparison = { total: fit?.score ?? null, verified_strengths: matched, gaps: missing, questions: [], cv_summary: "", method: SKILLS_SCORE_MODEL, note: "Comparaison des compétences mentionnées ; le contrat, le niveau et les conditions restent à vérifier." };
  const { error } = await ctx.supabase.from("jobs").update({ match_score: fit?.score ?? null, score_breakdown: comparison, score_model: SKILLS_SCORE_MODEL, ...(job.status === "DISCOVERED" ? { status: "ANALYZED" } : {}), last_checked_at: new Date().toISOString() }).eq("id", ctx.jobId).eq("user_id", ctx.userId);
  if (error) return { status: 503, body: { error: "La comparaison n’a pas pu être sauvegardée." } };
  return { status: 200, body: { ...comparison, suspected: false, reasons: suspicion.reasons } };
}
