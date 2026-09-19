import { GoogleGenAI } from "@google/genai";
import { authenticatedClient, safeFilename } from "@/lib/api";
import { queueQuestions, type QueueResult } from "@/lib/question-store";
import { normaliseGenerated, parseJson, type Generated } from "@/lib/generated";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  if (!process.env.GEMINI_API_KEY)
    return Response.json(
      { error: "GEMINI_API_KEY is not configured" },
      { status: 503 },
    );
  const { id } = await params;
  const [{ data: job }, { data: profile }] = await Promise.all([
    auth.supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .single(),
    auth.supabase
      .from("candidate_profiles")
      .select("*")
      .eq("user_id", auth.userId)
      .maybeSingle(),
  ]);
  if (!job || !profile)
    return Response.json(
      { error: "Offre ou profil vérifié introuvable" },
      { status: 404 },
    );
  if (job.status !== "ANALYZED")
    return Response.json(
      { error: "Analysez l’offre avant de générer les documents." },
      { status: 409 },
    );
  let parsed: Generated | null = null;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Génère le contenu d'un CV ATS français d'une page et, si utile, une lettre courte. Utilise exclusivement les faits du PROFIL et du REGISTRE. Sélectionne et reformule, sans inventer. Toute donnée légale, immigration, salaire numérique, handicap, casier, certification incertaine ou information absente devient unresolved_questions. Retourne uniquement un objet JSON avec cv {title,summary,experience[{heading,bullets}],projects[{heading,bullets}],skills[],education[],languages}, cover_letter string|null, unresolved_questions[{question,category}]. Les tableaux peuvent être vides si aucune information vérifiée n'existe.\nPROFIL=${JSON.stringify(profile.profile)}\nREGISTRE=${JSON.stringify(profile.truth_ledger)}\nOFFRE=${JSON.stringify(job)}`;
    const result = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    parsed = normaliseGenerated(parseJson(result.text || ""));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erreur inconnue Gemini";
    console.error("Document generation failed", detail);
    return Response.json(
      { error: `Génération Gemini impossible : ${detail}` },
      { status: 502 },
    );
  }
  if (!parsed)
    return Response.json(
      { error: "Documents Gemini invalides : le modèle n’a pas retourné un CV exploitable." },
      { status: 502 },
    );
  const base = safeFilename(`Yassine_AFIF_${job.company}_${job.title}`);
  const docs = [
    {
      user_id: auth.userId,
      job_id: id,
      kind: "TAILORED_CV",
      filename: `CV_${base}.pdf`,
      mime_type: "application/pdf",
      content_text: JSON.stringify(parsed.cv),
      generation_prompt: "verified-profile-v1",
      approved: false,
    },
  ];
  if (parsed.cover_letter)
    docs.push({
      user_id: auth.userId,
      job_id: id,
      kind: "COVER_LETTER",
      filename: `Lettre_${base}.pdf`,
      mime_type: "application/pdf",
      content_text: JSON.stringify({ letter: parsed.cover_letter }),
      generation_prompt: "verified-profile-v1",
      approved: false,
    });
  const { data: created, error } = await auth.supabase
    .from("documents")
    .insert(docs)
    .select();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  let { data: application } = await auth.supabase
    .from("applications")
    .select("id")
    .eq("job_id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!application) {
    const made = await auth.supabase
      .from("applications")
      .insert({
        user_id: auth.userId,
        job_id: id,
        status: "WAITING_APPROVAL",
        platform: job.source_platform,
      })
      .select("id")
      .single();
    application = made.data;
  }
  // Questions already answered before (nationality, address...) are answered
  // automatically; only genuinely new ones block the application.
  let queued: QueueResult = {
    asked: 0,
    autoAnswered: 0,
    duplicates: 0,
    pending: [],
  };
  if (application && parsed.unresolved_questions.length) {
    try {
      queued = await queueQuestions(
        auth.supabase,
        auth.userId,
        application.id,
        parsed.unresolved_questions,
      );
    } catch (error) {
      console.error("Could not store questions", error);
    }
  }
  await auth.supabase
    .from("jobs")
    .update({ status: "WAITING_APPROVAL" })
    .eq("id", id)
    .eq("user_id", auth.userId);
  return Response.json({
    documents: created,
    applicationId: application?.id,
    // Only the questions the user still has to answer.
    questions: queued.pending,
    questionStats: {
      asked: queued.asked,
      autoAnswered: queued.autoAnswered,
      duplicates: queued.duplicates,
    },
  });
}
