import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { loadDiscovered, saveDiscovered } from "@/lib/scan/discover";
import { parseAtsTarget, targetKey } from "@/lib/scan/sources/ats";

const body = z.object({ key: z.string().min(3).max(120) });

/**
 * "Ne plus suivre" a company found automatically: it leaves the list and is
 * remembered as ignored, so the next scans never add it back.
 */
export async function DELETE(req: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  const target = parsed.success ? parseAtsTarget(parsed.data.key) : null;
  if (!target) return Response.json({ error: "Entreprise inconnue." }, { status: 400 });
  const key = targetKey(target);
  const current = await loadDiscovered(auth.supabase, auth.userId);
  if (!current)
    return Response.json(
      { error: "Applique d’abord la migration Supabase 20260930090000 (entreprises découvertes)." },
      { status: 400 },
    );
  const next = {
    items: current.items.filter((i) => i.key !== key),
    ignored: [...new Set([...current.ignored, key])],
  };
  const { error } = await saveDiscovered(auth.supabase, auth.userId, next);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ discovered: next.items });
}
