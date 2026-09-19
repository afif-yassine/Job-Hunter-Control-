import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { parseContent, versionedFilename } from "@/lib/documents";
import { normaliseGenerated, parseJson, asRecord, asText } from "@/lib/generated";
import { queueQuestions } from "@/lib/question-store";

const input = z.object({ instruction: z.string().trim().min(3).max(2000) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  if (!process.env.GEMINI_API_KEY)
    return Response.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 });
  const parsedInput = input.safeParse(await req.json().catch(() => null));
  if (!parsedInput.success)
    return Response.json(
      { error: "Explique en une phrase ce que tu veux changer." },
      { status: 400 },
    );
  const { id } = await params;
  const { supabase, userId } = auth;

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (!doc) return Response.json({ error: "Document introuvable" }, { status: 404 });

  const [{ data: job }, { data: profile }] = await Promise.all([
    doc.job_id
      ? supabase.from("jobs").select("*").eq("id", doc.job_id).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("candidate_profiles")
      .select("profile,truth_ledger")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (!profile)
    return Response.json({ error: "Le profil vérifié n’est pas encore synchronisé." }, { status: 409 });

  const isLetter = doc.kind === "COVER_LETTER";
  const current = parseContent(doc.content_text);
  const shape = isLetter
    ? `{"cover_letter": string, "unresolved_questions": [{"question": string, "category": string}], "change_summary": string}`
    : `{"cv": {"title","summary","experience":[{"heading","bullets":[]}],"projects":[{"heading","bullets":[]}],"skills":[],"education":[],"languages"}, "unresolved_questions": [{"question": string, "category": string}], "change_summary": string}`;
  const prompt = `Tu révises un ${isLetter ? "lettre de motivation" : "CV ATS d'une page"} déjà généré, selon la demande de Yassine.
RÈGLES STRICTES :
- Applique uniquement la demande. Tout le reste doit rester identique.
- Utilise exclusivement les faits du PROFIL, du REGISTRE et du contenu actuel. N'invente aucune compétence, expérience, date, diplôme, statut légal ou chiffre.
- Si la demande exige une information absente du profil, ne l'ajoute pas : pose la question dans unresolved_questions et explique-le dans change_summary.
- Garde la langue et le ton du document actuel, sauf demande contraire.
- change_summary : 1 à 3 phrases en français qui disent ce qui a changé.
Retourne uniquement du JSON de la forme ${shape}.
DEMANDE=${JSON.stringify(parsedInput.data.instruction)}
CONTENU_ACTUEL=${JSON.stringify(current)}
PROFIL=${JSON.stringify(profile.profile)}
REGISTRE=${JSON.stringify(profile.truth_ledger)}
OFFRE=${JSON.stringify(job)}`;

  let root: Record<string, unknown>;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    root = asRecord(parseJson(result.text || ""));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erreur inconnue Gemini";
    return Response.json({ error: `Révision Gemini impossible : ${detail}` }, { status: 502 });
  }

  let content: unknown;
  if (isLetter) {
    const coverRecord = asRecord(root.cover_letter);
    const letter =
      asText(root.cover_letter) || asText(coverRecord.text ?? coverRecord.content) || asText(root.letter);
    if (letter.length < 20)
      return Response.json({ error: "Révision invalide : lettre vide." }, { status: 502 });
    content = { letter };
  } else {
    const normalised = normaliseGenerated({ ...root, cover_letter: null });
    if (!normalised)
      return Response.json({ error: "Révision invalide : CV inexploitable." }, { status: 502 });
    content = normalised.cv;
  }

  const version = (Number(doc.version) || 1) + 1;
  const { data: created, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      job_id: doc.job_id,
      kind: doc.kind,
      filename: versionedFilename(doc.filename, version),
      mime_type: doc.mime_type || "application/pdf",
      content_text: JSON.stringify(content),
      generation_prompt: `revision: ${parsedInput.data.instruction.slice(0, 200)}`,
      approved: false,
      version,
      based_on_document_id: doc.id,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Anything the model could not fill from the verified profile becomes a question.
  const rawQuestions = Array.isArray(root.unresolved_questions) ? root.unresolved_questions : [];
  const questions = rawQuestions.flatMap((q) => {
    const r = asRecord(q);
    const text = typeof q === "string" ? q : asText(r.question ?? r.text);
    return text ? [{ question: text, category: asText(r.category) || "UNSPECIFIED" }] : [];
  });
  let asked = 0;
  if (questions.length && doc.job_id) {
    const { data: application } = await supabase
      .from("applications")
      .select("id")
      .eq("job_id", doc.job_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (application) {
      try {
        asked = (await queueQuestions(supabase, userId, application.id, questions)).asked;
      } catch (e) {
        console.error("Could not store questions", e);
      }
    }
  }

  await supabase.from("audit_events").insert({
    user_id: userId,
    entity_type: "document",
    entity_id: created.id,
    action: "REVISED",
    details: { from: doc.id, version, instruction: parsedInput.data.instruction.slice(0, 500) },
  });

  return Response.json({
    document: created,
    summary: asText(root.change_summary) || "Document révisé.",
    questions: asked,
  });
}
