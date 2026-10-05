import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_NOT_CONFIGURED, aiConfigured, defaultAi, type AiCall } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { normaliseGenerated, parseJson, type Generated } from "@/lib/generated";
import { queueQuestions, type QueueResult } from "@/lib/question-store";
import { checkPlan } from "@/lib/plan";
import { consumeQuota, quotaRefusal } from "@/lib/quota";
import type { StepResult } from "./analyze";
import { markGone, type OnlineCheck, type OnlineJob } from "./availability";

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
  const { supabase, userId, jobId: id } = ctx;
  if (!ctx.ai && !aiConfigured(env)) return { status: 503, body: { error: AI_NOT_CONFIGURED } };
  const [{ data: job }, { data: profile }] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).eq("user_id", userId).single(),
    supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (!job || !profile) return { status: 404, body: { error: "Offre ou profil vérifié introuvable" } };
  if (job.status !== "ANALYZED")
    return { status: 409, body: { error: "Analysez l’offre avant de générer les documents." } };
  if (job.gone_reason)
    return {
      status: 410,
      body: { error: "Cette offre n’est plus disponible : pas de CV ni de lettre à créer.", code: "GONE" },
    };
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

  // Free plan: a set number of new kits per month (rewriting this offer's kit is free).
  const plan = await checkPlan(supabase, userId, id, env, new Date(), ctx.automatic === true);
  if (!plan.ok) return { status: plan.status, body: plan.body };

  const quota = await consumeQuota(supabase, userId, "generation", env);
  if (!quota.ok) return quotaRefusal("generation", quota.limit);

  let parsed: Generated | null = null;
  let model = "";
  try {
    const prompt = `Génère le contenu d'un CV ATS français d'une page et, si utile, une lettre de motivation. Format de cover_letter : texte français prêt à envoyer, paragraphes séparés par UNE LIGNE VIDE, dans cet ordre : 1) « Objet : Candidature au poste de … » ; 2) « Madame, Monsieur, » ; 3) trois paragraphes courts (pourquoi cette entreprise et ce poste ; ce que j'apporte, avec deux faits vérifiés du PROFIL ; disponibilité) ; 4) une formule de politesse. Ni coordonnées, ni date, ni signature (ajoutées automatiquement). 170 à 240 mots. Utilise exclusivement les faits du PROFIL et du REGISTRE. Sélectionne et reformule, sans inventer. Toute donnée légale, immigration, salaire numérique, handicap, casier, certification incertaine ou information absente devient unresolved_questions. Retourne uniquement un objet JSON avec cv {title,summary,experience[{heading,bullets}],projects[{heading,bullets}],skills[],education[],languages}, cover_letter string|null, unresolved_questions[{question,category}]. Les tableaux peuvent être vides si aucune information vérifiée n'existe.\nPROFIL=${JSON.stringify(profile.profile)}\nREGISTRE=${JSON.stringify(profile.truth_ledger)}\nOFFRE=${JSON.stringify({
      company: job.company,
      title: job.title,
      contract_type: job.contract_type,
      location: job.location,
      description: job.description,
      analysis: job.score_breakdown,
    })}`;
    const result = await (ctx.ai ?? defaultAi)(prompt, "writing");
    await recordAiUsage(supabase, userId, "writing", result);
    model = result.model;
    parsed = normaliseGenerated(parseJson(result.text || ""));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erreur inconnue Gemini";
    console.error("Document generation failed", detail);
    return { status: 502, body: { error: `Génération Gemini impossible : ${detail}` } };
  }
  if (!parsed)
    return {
      status: 502,
      body: { error: "Documents Gemini invalides : le modèle n’a pas retourné un CV exploitable." },
    };

  const base = safeFilename(`${namePart(profile.full_name)}_${job.company}_${job.title}`);
  const docs: Record<string, unknown>[] = [
    {
      user_id: userId,
      job_id: id,
      kind: "TAILORED_CV",
      filename: `CV_${base}.pdf`,
      mime_type: "application/pdf",
      content_text: JSON.stringify(parsed.cv),
      generation_prompt: "verified-profile-v1",
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
      content_text: JSON.stringify({ letter: parsed.cover_letter }),
      generation_prompt: "verified-profile-v1",
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
