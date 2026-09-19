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

type Generated = z.infer<typeof generated>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}

function asTextList(value: unknown): string[] {
  if (Array.isArray(value))
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        const record = asRecord(item);
        return asText(
          record.name ??
            record.title ??
            record.label ??
            record.text ??
            record.description,
        );
      })
      .filter(Boolean);
  const text = asText(value);
  return text ? [text] : [];
}

function asSections(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") {
      const heading = item.trim();
      return heading ? [{ heading, bullets: [] as string[] }] : [];
    }
    const record = asRecord(item);
    const heading = asText(
      record.heading ?? record.title ?? record.role ?? record.name,
    );
    const bullets = asTextList(
      record.bullets ?? record.items ?? record.highlights ?? record.description,
    );
    return heading || bullets.length ? [{ heading, bullets }] : [];
  });
}

function parseJson(text: string): unknown {
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normaliseGenerated(value: unknown): Generated | null {
  const root = asRecord(value);
  const source = asRecord(root.cv ?? root.CV ?? root.resume ?? root);
  const cv = {
    title: asText(source.title ?? source.name) || "CV ciblé",
    summary: asText(source.summary ?? source.profile ?? source.about),
    experience: asSections(
      source.experience ?? source.experiences ?? source.work_experience,
    ),
    projects: asSections(source.projects ?? source.project),
    skills: asTextList(source.skills ?? source.competencies),
    education: asTextList(source.education ?? source.education_history),
    languages: Array.isArray(source.languages)
      ? asTextList(source.languages).join(" | ")
      : asText(source.languages ?? source.language),
  };
  const coverValue =
    root.cover_letter ?? root.coverLetter ?? root.letter ?? root.coverLetterText;
  const coverRecord = asRecord(coverValue);
  const cover_letter =
    coverValue == null
      ? null
      : asText(coverRecord.text ?? coverRecord.content ?? coverValue) || null;
  const unresolved = root.unresolved_questions ?? root.unresolvedQuestions ?? [];
  const unresolved_questions = Array.isArray(unresolved)
    ? unresolved.flatMap((item) => {
        if (typeof item === "string") {
          const question = item.trim();
          return question
            ? [{ question, category: "UNSPECIFIED" }]
            : [];
        }
        const record = asRecord(item);
        const question = asText(record.question ?? record.text ?? record.prompt);
        const category = asText(record.category ?? record.type) || "UNSPECIFIED";
        return question ? [{ question, category }] : [];
      })
    : [];
  const result = generated.safeParse({ cv, cover_letter, unresolved_questions });
  if (!result.success) return null;
  const hasCvContent = Boolean(
    result.data.cv.summary ||
      result.data.cv.experience.length ||
      result.data.cv.projects.length ||
      result.data.cv.skills.length ||
      result.data.cv.education.length,
  );
  return hasCvContent ? result.data : null;
}
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
  if (application && parsed.unresolved_questions.length)
    await auth.supabase
      .from("application_questions")
      .insert(
        parsed.unresolved_questions.map((q) => ({
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
    questions: parsed.unresolved_questions,
  });
}
