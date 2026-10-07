import { authenticatedClient } from "@/lib/api";
import { loadSearches, savedSearchList, saveSearches } from "@/lib/saved-searches";

export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  try { return Response.json({ searches: (await loadSearches(auth.supabase, auth.userId)).searches }); }
  catch { return Response.json({ error: "Recherches enregistrées indisponibles." }, { status: 503 }); }
}

export async function PUT(req: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const raw = await req.text();
  if (raw.length > 10_000) return Response.json({ error: "Requête trop longue." }, { status: 413 });
  let input;
  try { input = JSON.parse(raw); } catch { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  const parsed = savedSearchList.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Dix recherches maximum, avec un nom unique et des filtres valides." }, { status: 400 });
  try { return Response.json({ searches: await saveSearches(auth.supabase, auth.userId, parsed.data) }); }
  catch { return Response.json({ error: "Sauvegarde des recherches impossible. Réessaie." }, { status: 503 }); }
}
