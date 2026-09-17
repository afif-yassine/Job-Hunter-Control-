import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { authenticatedClient, safeFilename } from "@/lib/api";

const generated = z.object({
  cv: z.object({
    title: z.string(),
    summary: z.string(),
    experience: z.array(
      z.object({ heading: z.string(), bullets: z.array(z.string()) }),
    ),
    projects: z.array(
      z.object({ heading: z.string(), bullets: z.array(z.string()) }),
    ),
    skills: z.array(z.string()),
    education: z.array(z.string()),
    languages: z.string(),
  }),
  cover_letter: z.string().nullable(),
  unresolved_questions: z.array(
    z.object({ question: z.string(), category: z.string() }),
  ),
});
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
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Génère le contenu d'un CV ATS français d'une page et, si utile, une lettre courte. Utilise exclusivement les faits du PROFIL et du REGISTRE. Sélectionne et reformule, sans inventer. Toute donnée légale, immigration, salaire numérique, handicap, casier, certification incertaine ou information absente devient unresolved_questions. JSON strict: cv {title,summary,experience[{heading,bullets}],projects[{heading,bullets}],skills[],education[],languages}, cover_letter string|null, unresolved_questions[{question,category}].\nPROFIL=${JSON.stringify(profile.profile)}\nREGISTRE=${JSON.stringify(profile.truth_ledger)}\nOFFRE=${JSON.stringify(job)}`;
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  const parsed = generated.safeParse(JSON.parse(result.text || "{}"));
  if (!parsed.success)
    return Response.json(
      { error: "Documents Gemini invalides" },
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
      content_text: JSON.stringify(parsed.data.cv),
      generation_prompt: "verified-profile-v1",
      approved: false,
    },
  ];
  if (parsed.data.cover_letter)
    docs.push({
      user_id: auth.userId,
      job_id: id,
      kind: "COVER_LETTER",
      filename: `Lettre_${base}.pdf`,
      mime_type: "application/pdf",
      content_text: JSON.stringify({ letter: parsed.data.cover_letter }),
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
  if (application && parsed.data.unresolved_questions.length)
    await auth.supabase
      .from("application_questions")
      .insert(
        parsed.data.unresolved_questions.map((q) => ({
          user_id: auth.userId,
          application_id: application!.id,
          question: q.question,
          category: q.category,
          blocking: true,
          approved: false,
        })),
      );
  await auth.supabase
    .from("jobs")
    .update({ status: "WAITING_APPROVAL" })
    .eq("id", id)
    .eq("user_id", auth.userId);
  return Response.json({
    documents: created,
    applicationId: application?.id,
    questions: parsed.data.unresolved_questions,
  });
}
