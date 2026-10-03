import { authenticatedClient } from "@/lib/api";
import { categoryCounts } from "@/lib/scan/catalogue";
import { normalizePrefs } from "@/lib/scan/config";

export const dynamic = "force-dynamic";

/** Open offers per job category around the place being edited in Réglages (no job site called). */
export async function GET(req: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const q = new URL(req.url).searchParams;
  const prefs = normalizePrefs({
    city: q.get("city") ?? undefined,
    departments: (q.get("departments") ?? "").split(","),
    contracts: (q.get("contracts") ?? "").split(","),
    maxAgeDays: Number(q.get("days")) || undefined,
  });
  const counts = await categoryCounts(auth.supabase, prefs);
  if (counts.error) return Response.json({ error: counts.error }, { status: 400 });
  return Response.json(counts);
}
