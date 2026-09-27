import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { deleteIntegration, integrationStatus, saveIntegration } from "@/lib/integrations";

const save = z.object({
  provider: z.string().min(1).max(40),
  values: z.record(z.string(), z.string()),
});

/** Status of every source (never returns a key). */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  return Response.json({ providers: await integrationStatus(auth.supabase, auth.userId) });
}

/** Saves (encrypted) the keys typed in Réglages > Sources. */
export async function POST(req: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const body = save.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const result = await saveIntegration(auth.supabase, auth.userId, body.data.provider, body.data.values);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const provider = new URL(req.url).searchParams.get("provider") || "";
  const result = await deleteIntegration(auth.supabase, auth.userId, provider);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}
