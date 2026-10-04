import { authenticatedClient } from "@/lib/api";
import { ensureProfileEmbedding, geminiEmbedder } from "@/lib/embeddings";
import { profileSummary, saveImportedProfile } from "@/lib/profile-store";

export const dynamic = "force-dynamic";

/** The verified profile CVs and letters are written from (summary only). */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  try {
    return Response.json({ profile: await profileSummary(auth.supabase, auth.userId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Profil illisible" }, { status: 500 });
  }
}

/** Saves the CV import the person has checked. */
export async function PUT(req: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { draft?: unknown; filename?: string } | null;
  if (!body?.draft) return Response.json({ error: "Aucun profil à enregistrer." }, { status: 400 });
  const result = await saveImportedProfile(auth.supabase, auth.userId, body.draft, body.filename ?? null);
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  // New profile → new vector, so the offers closest to it are found (best effort).
  await ensureProfileEmbedding(auth.supabase, auth.userId, geminiEmbedder(), true);
  return Response.json({ profile: await profileSummary(auth.supabase, auth.userId) });
}
