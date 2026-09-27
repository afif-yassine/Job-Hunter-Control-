import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { normalizePrefs } from "@/lib/scan/config";
import { loadUserSettings, saveUserSettings } from "@/lib/settings";

const body = z.object({
  prefs: z.unknown().optional(),
  autoScan: z.boolean().optional(),
});

export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  return Response.json(await loadUserSettings(auth.supabase, auth.userId));
}

export async function PUT(req: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const { error } = await saveUserSettings(auth.supabase, auth.userId, {
    prefs: parsed.data.prefs === undefined ? undefined : normalizePrefs(parsed.data.prefs),
    autoScan: parsed.data.autoScan,
  });
  if (error)
    return Response.json(
      {
        error: /relation|does not exist|schema cache/i.test(error.message)
          ? "La table « user_settings » n’existe pas : applique la migration Supabase 20260921090000."
          : error.message,
      },
      { status: 400 },
    );
  return Response.json(await loadUserSettings(auth.supabase, auth.userId));
}
