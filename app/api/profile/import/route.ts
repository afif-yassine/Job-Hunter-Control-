import { generateJsonFromPdf } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { authenticatedClient } from "@/lib/api";
import { parseJson } from "@/lib/generated";
import { importProblems, IMPORT_PROMPT, normalizeImported, suggestCategories } from "@/lib/profile-import";
import { consumeQuota, quotaRefusal } from "@/lib/quota";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Reads a CV (PDF) with the AI and returns a draft profile to check. Nothing
 * is saved here, and the PDF itself is never stored.
 */
export async function POST(req: Request) {
  const auth = await authenticatedClient("ai");
  if ("error" in auth) return auth.error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Ajoute ton CV en PDF." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "PDF trop lourd (5 Mo maximum)." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") return Response.json({ error: "Ce fichier n’est pas un PDF." }, { status: 415 });

  const quota = await consumeQuota(auth.supabase, auth.userId, "generation");
  if (!quota.ok) {
    const refusal = quotaRefusal("generation", quota.limit);
    return Response.json(refusal.body, { status: refusal.status });
  }
  try {
    const result = await generateJsonFromPdf(IMPORT_PROMPT, bytes, "writing");
    await recordAiUsage(auth.supabase, auth.userId, "writing", result);
    const draft = normalizeImported(parseJson(result.text || ""));
    return Response.json({ draft, problems: importProblems(draft), suggestions: suggestCategories(draft), filename: file.name });
  } catch (error) {
    return Response.json({ error: `Lecture du CV impossible : ${error instanceof Error ? error.message : "erreur"}` }, { status: 502 });
  }
}
