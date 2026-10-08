import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_NOT_CONFIGURED, aiConfigured, generateJson, modelFor, type AiCall } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { generated, parseJson, type Generated } from "@/lib/generated";
import { selectWritingProofs, unsupportedWritingSkills, writingVersion, WRITING_RULES } from "@/lib/writing-context";
import { queueQuestions, type QueueResult } from "@/lib/question-store";
import { checkPlan } from "@/lib/plan";
import { PROFILE_REQUIRED, PROFILE_REQUIRED_MESSAGE } from "@/lib/profile-store";
import { consumeQuota, quotaRefusal } from "@/lib/quota";
import type { StepResult } from "./analyze";
import { closedInCatalogue, markGone, markGoneForStudent, type OnlineCheck, type OnlineJob } from "./availability";

type Ctx = {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  env?: Record<string, string | undefined>;
  ai?: AiCall;
  /** Checks the offer is still online before spending anything (none = no check). */
  checkOnline?: (job: OnlineJob) => Promise<OnlineCheck>;
  /** Service client, to close the shared offer when it is gone. */
  service?: SupabaseClient | null;
  /** Started by the automatic pipeline, not by the student's click. */
  automatic?: boolean;
};

/** Same rule as lib/api safeFilename (kept here: no server-only import). */
function safeFilename(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80);
}

/** "Yassine AFIF" → "Yassine_AFIF" (falls back to "Candidat"). */
export function namePart(fullName: string | null | undefined): string {
  return safeFilename(fullName || "") || "Candidat";
}

/**
 * Writes the tailored CV (+ a letter when useful) of one analysed offer, and
 * creates its application in WAITING_APPROVAL. Never submits anything.
 */
export async function generateForJob(ctx: Ctx): Promise<StepResult> {
  const env = ctx.env ?? process.env;
  if (env.AI_GENERATION_LEASES !== "1") return generateKit(ctx);
  const leaseDb = ctx.service ?? ctx.supabase;
  const lease = await leaseDb.rpc("claim_document_generation", { p_job_id: ctx.jobId, p_user_id: ctx.userId });
  if (lease.error) return { status: 503, body: { error: "La réservation de génération est indisponible : aucun appel IA lancé." } };
  if (!lease.data) return { status: 409, body: { error: "Un dossier est déjà en cours de préparation sur ton compte. Attends sa fin avant d’en créer un autre.", code: "GENERATION_IN_PROGRESS" } };
  try {
    return await generateKit(ctx);
  } finally {
    await leaseDb.rpc("release_document_generation", { p_job_id: ctx.jobId, p_user_id: ctx.userId, p_token: lease.data });
  }
}

async function generateKit(ctx: Ctx): Promise<StepResult> {
  const env = ctx.env ?? process.env;
  const { supabase, userId, jobId: id } = ctx;
  const [{ data: job }, { data: profile }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).eq("user_id", userId).single(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (!job) return { status: 404, body: { error: "Offre introuvable." } };
  if (!profile) return { status: 409, body: { error: PROFILE_REQUIRED_MESSAGE, code: PROFILE_REQUIRED } };
  if (!["ANALYZED", "WAITING_APPROVAL"].includes(job.status))
    return { status: 409, body: { error: "Analysez l’offre avant de générer les documents." } };
  const goneBody = { error: "Cette offre n’est plus disponible : pas de CV ni de lettre à créer.", code: "GONE" };
  if (job.gone_reason) return { status: 410, body: goneBody };
  // The marker on the student's own row can be cleared by the student: the catalogue has the last word.
  if (await closedInCatalogue(supabase, job)) {
    await markGoneForStudent(supabase, job.id, userId);
    return { status: 410, body: goneBody };
  }
  if (job.review_flag)
    return {
      status: 409,
      body: { error: "Cette offre est dans « À vérifier » : confirme-la d’abord.", code: "TO_REVIEW" },
    };

  // An offer taken down since it was found: nothing is written, nothing is spent.
  if (ctx.checkOnline) {
    const check = await ctx.checkOnline(job);
    if (check.online === false) {
      await markGone(supabase, ctx.service ?? null, job, userId, check.reason ?? "Offre retirée.");
      return {
        status: 410,
        body: { error: `Cette offre n’est plus en ligne (${check.reason ?? "retirée"}) : rien n’a été dépensé.`, code: "GONE" },
      };
    }
  }

  const offer = { company: job.company, title: job.title, contract_type: job.contract_type, location: job.location, description: job.description };
  const version = writingVersion(userId, profile.profile, profile.truth_ledger, offer, modelFor("writing", env));
  const { data: existing } = await supabase.from("documents").select("*").eq("user_id", userId).eq("job_id", id).eq("generation_prompt", version);
  if (existing?.some(d => d.kind === "TAILORED_CV")) {
    let { data: application } = await supabase.from("applications").select("id").eq("job_id", id).eq("user_id", userId).maybeSingle();
    if (!application) {
      const repair = await supabase.from("applications").insert({ user_id: userId, job_id: id, status: "WAITING_APPROVAL", platform: job.source_platform }).select("id").single();
      if (repair.error) return { status: 503, body: { error: "Les documents sont sauvegardés, mais le suivi n’a pas pu être créé. Réessaie : aucune nouvelle génération IA n’est nécessaire." } };
      application = repair.data;
    }
    return { status: 200, body: { documents: existing, applicationId: application?.id, cached: true } };
  }
  if (!ctx.ai && !aiConfigured(env)) return { status: 503, body: { error: AI_NOT_CONFIGURED } };
  let proofs;
  try {
    proofs = selectWritingProofs(profile.profile, profile.truth_ledger, `${job.title}\n${job.description ?? ""}`);
  } catch (error) {
    return { status: 400, body: { error: error instanceof Error ? error.message : "Profil invalide." } };
  }
  if (!proofs.length) return { status: 409, body: { error: "Confirme au moins une réalisation, formation ou compétence dans ton profil avant de générer.", code: "PROFILE_EVIDENCE_REQUIRED" } };

  // Free plan: a set number of new kits per month (rewriting this offer's kit is free).
  const plan = await checkPlan(supabase, userId, id, env, new Date(), ctx.automatic === true);
  if (!plan.ok) return { status: plan.status, body: plan.body };

  const quota = await consumeQuota(supabase, userId, "generation", env);
  if (!quota.ok) return quotaRefusal("generation", quota.limit, quota.unavailable);

  let parsed: Generated | null = null;
  let model = "";
  try {
    const prompt = `${WRITING_RULES}\nDans cv.skills, reprends uniquement les intitulés exacts des compétences et technologies des preuves, un intitulé par élément, sans niveau de maîtrise ajouté.\nPREUVES=${JSON.stringify(proofs)}\nOFFRE=${JSON.stringify(offer)}`;
    const result = await (ctx.ai ?? ((p, task) => generateJson(p, task, env, { strictKit: true })))(prompt, "writing");
    await recordAiUsage(supabase, userId, "writing", result);
    model = result.model;
    const output = generated.safeParse(parseJson(result.text || ""));
    parsed = output.success ? output.data : null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erreur inconnue Gemini";
    console.error("Document generation failed", detail);
    return { status: 502, body: { error: `Génération IA impossible : ${detail}` } };
  }
  if (!parsed)
    return {
      status: 502,
      body: { error: "Documents IA invalides : le modèle n’a pas retourné un CV exploitable." },
    };
  if (unsupportedWritingSkills(parsed.cv, proofs).length)
    return { status: 502, body: { error: "Le CV contient une compétence non justifiée par les preuves : aucun document enregistré. Révise ton profil avant de réessayer.", code: "UNSUPPORTED_SKILL" } };

  const base = safeFilename(`${namePart(profile.full_name)}_${job.company}_${job.title}`);
  const docs: Record<string, unknown>[] = [
    {
      user_id: userId,
      job_id: id,
      kind: "TAILORED_CV",
      filename: `CV_${base}.pdf`,
      mime_type: "application/pdf",
      content_text: JSON.stringify({ ...parsed.cv, provenance: { version, proofs } }),
      generation_prompt: version,
      model,
      approved: false,
    },
  ];
  if (parsed.cover_letter)
    docs.push({
      user_id: userId,
      job_id: id,
      kind: "COVER_LETTER",
      filename: `Lettre_${base}.pdf`,
      mime_type: "application/pdf",
      content_text: JSON.stringify({ letter: parsed.cover_letter, provenance: { version, proofs } }),
      generation_prompt: version,
      model,
      approved: false,
    });
  let { data: created, error } = await supabase.from("documents").insert(docs).select();
  if (error && /column|schema cache|42703|PGRST204/i.test(`${error.code} ${error.message}`))
    ({ data: created, error } = await supabase
      .from("documents")
      .insert(docs.map(({ model: _m, ...rest }) => (void _m, rest)))
      .select());
  if (error) return { status: 400, body: { error: error.message } };

  let { data: application } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!application) {
    const made = await supabase
      .from("applications")
      .insert({ user_id: userId, job_id: id, status: "WAITING_APPROVAL", platform: job.source_platform })
      .select("id")
      .single();
    application = made.data;
  }
  // Questions already answered before (nationality, address...) are answered
  // automatically; only genuinely new ones block the application.
  let queued: QueueResult = { asked: 0, autoAnswered: 0, duplicates: 0, pending: [] };
  if (application && parsed.unresolved_questions.length) {
    try {
      queued = await queueQuestions(supabase, userId, application.id, parsed.unresolved_questions);
    } catch (e) {
      console.error("Could not store questions", e);
    }
  }
  await supabase.from("jobs").update({ status: "WAITING_APPROVAL" }).eq("id", id).eq("user_id", userId);
  return {
    status: 200,
    body: {
      documents: created,
      applicationId: application?.id,
      // Only the questions the user still has to answer.
      questions: queued.pending,
      questionStats: { asked: queued.asked, autoAnswered: queued.autoAnswered, duplicates: queued.duplicates },
    },
  };
}
