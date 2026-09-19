import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { authenticatedClient } from "@/lib/api";

const output = z.object({
  score_breakdown: z.record(z.string(), z.number()),
  total: z.number().min(0).max(100),
  verified_strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  questions: z.array(z.string()),
  cv_summary: z.string(),
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
  const [{ data: job, error }, { data: profile }] = await Promise.all([
    auth.supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .single(),
    auth.supabase
      .from("candidate_profiles")
      .select("profile,truth_ledger")
      .eq("user_id", auth.userId)
      .maybeSingle(),
  ]);
  if (error || !job)
    return Response.json({ error: "Offer not found" }, { status: 404 });
  if (!job.description)
    return Response.json(
      { error: "Ajoutez la description complète de l’offre avant l’analyse." },
      { status: 400 },
    );
  if (!profile)
    return Response.json(
      { error: "Le profil vérifié n’est pas encore synchronisé." },
      { status: 409 },
    );
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Analyse cette offre uniquement avec le profil et le registre de vérité. N'invente jamais une compétence, une expérience, une date, un statut légal ou un diplôme. Réponds en JSON: score_breakdown avec contract/20, mission/20, technical/25, education/15, experience/10, location/10; total sur 100; verified_strengths; gaps; questions; cv_summary.\nPROFIL=${JSON.stringify(profile.profile)}\nREGISTRE=${JSON.stringify(profile.truth_ledger)}\nOFFRE=${JSON.stringify(job)}`;
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    const parsed = output.safeParse(JSON.parse(result.text || "{}"));
    if (!parsed.success)
      return Response.json({ error: "Réponse Gemini invalide ou vide" }, { status: 502 });
    await auth.supabase
      .from("jobs")
      .update({
        match_score: Math.round(parsed.data.total),
        score_breakdown: parsed.data,
        status: "ANALYZED",
        last_checked_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", auth.userId);
    await auth.supabase
      .from("audit_events")
      .insert({
        user_id: auth.userId,
        entity_type: "job",
        entity_id: id,
        action: "ANALYZED",
        details: { score: parsed.data.total },
      });
    return Response.json(parsed.data);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erreur inconnue Gemini";
    return Response.json({ error: `Analyse Gemini impossible : ${detail}` }, { status: 502 });
  }
}
