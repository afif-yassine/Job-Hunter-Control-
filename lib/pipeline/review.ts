import type { SupabaseClient } from "@supabase/supabase-js";
import type { StepResult } from "./analyze";

type Ctx = {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  action: "keep" | "merge" | "dismiss" | "applied_elsewhere";
  platform?: string;
  appliedAt?: string;
};

const CLEAR = { review_flag: null, review_reason: null };

/**
 * What the user decides about an offer in "À vérifier" (or any offer, for
 * "already applied elsewhere"). Nothing is deleted: dismissed offers are
 * SKIPPED and stay in the history.
 */
export async function reviewJob(ctx: Ctx): Promise<StepResult> {
  const { supabase, userId, jobId } = ctx;
  const { data: job } = await supabase
    .from("jobs")
    .select("id,status,review_flag,duplicate_of,source_platform")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!job) return { status: 404, body: { error: "Offre introuvable" } };
  const update = (patch: Record<string, unknown>) =>
    supabase.from("jobs").update(patch).eq("id", jobId).eq("user_id", userId);

  if (ctx.action === "keep") {
    const { error } = await update({ ...CLEAR, duplicate_of: null });
    if (error) return { status: 400, body: { error: error.message } };
    return { status: 200, body: { message: "Offre gardée : elle suit le parcours normal." } };
  }

  if (ctx.action === "merge") {
    if (!job.duplicate_of) return { status: 409, body: { error: "Aucune offre d’origine connue pour cette offre." } };
    // Its links now belong to the original offer; this copy leaves the lists.
    await supabase.from("job_sources").update({ job_id: job.duplicate_of }).eq("job_id", jobId).eq("user_id", userId);
    const { error } = await update({ ...CLEAR, status: "SKIPPED" });
    if (error) return { status: 400, body: { error: error.message } };
    return { status: 200, body: { message: "Doublon regroupé avec l’offre d’origine." } };
  }

  if (ctx.action === "dismiss") {
    const { error } = await update({ ...CLEAR, status: "SKIPPED" });
    if (error) return { status: 400, body: { error: error.message } };
    return { status: 200, body: { message: "Offre écartée." } };
  }

  // applied_elsewhere: remembered as an application, so the same offer seen
  // later on another platform is recognised and never proposed again.
  const when = ctx.appliedAt && !Number.isNaN(Date.parse(ctx.appliedAt)) ? new Date(ctx.appliedAt).toISOString() : new Date().toISOString();
  const { error: appError } = await supabase.from("applications").upsert(
    {
      user_id: userId,
      job_id: jobId,
      status: "SUBMITTED",
      platform: ctx.platform || job.source_platform || "ailleurs",
      submitted_at: when,
      notes: "Candidature faite en dehors de l’application.",
    },
    { onConflict: "user_id,job_id" },
  );
  if (appError) return { status: 400, body: { error: appError.message } };
  const { error } = await update({ ...CLEAR, status: "SUBMITTED" });
  if (error) return { status: 400, body: { error: error.message } };
  return { status: 200, body: { message: "Noté : cette offre ne te sera plus proposée, sur aucune plateforme." } };
}
