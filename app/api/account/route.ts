import { z } from "zod";
import { DELETE_CONFIRMATION, sameOrigin } from "@/lib/account";
import { authenticatedClient } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/admin";

/** The signed-in account: e-mail, how it signs in, since when. */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.auth.getUser();
  if (error || !data.user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const u = data.user;
  const providers = Array.from(new Set((u.identities ?? []).map((i) => i.provider)));
  return Response.json({ email: u.email ?? "", providers, createdAt: u.created_at, lastSignInAt: u.last_sign_in_at ?? null });
}

const body = z.object({ confirm: z.literal(DELETE_CONFIRMATION) });

/**
 * Deletes the account and, through the foreign keys (on delete cascade),
 * every row it owns. Immediate and final. The app keeps no files elsewhere.
 */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Requête refusée." }, { status: 403 });
  const auth = await authenticatedClient("probe");
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: `Écris ${DELETE_CONFIRMATION} pour confirmer.` }, { status: 400 });
  const admin = serviceClient();
  if (!admin) return Response.json({ error: "Suppression indisponible pour le moment : écris-nous, nous le ferons à la main." }, { status: 503 });
  const { error } = await admin.auth.admin.deleteUser(auth.userId);
  if (error) return Response.json({ error: "La suppression a échoué. Réessaie ou écris-nous." }, { status: 500 });
  // The session belongs to a user that no longer exists: clear its cookies.
  await auth.supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return Response.json({ deleted: true });
}
