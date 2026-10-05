import { authenticatedClient } from "@/lib/api";
import { buildGrowth } from "@/lib/admin/growth";
import { MANUAL_STEP_IDS } from "@/lib/admin/levels";

export const dynamic = "force-dynamic";

async function admin() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth;
  const { data: isAdmin } = await auth.supabase.rpc("is_admin");
  if (isAdmin !== true) return { error: Response.json({ error: "Réservé à l’administrateur." }, { status: 403 }) };
  return auth;
}

/** Growth page: statistics, money, launch levels (admins only). */
export async function GET() {
  const auth = await admin();
  if ("error" in auth) return auth.error;
  try {
    return Response.json(await buildGrowth(auth.supabase));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Statistiques indisponibles" }, { status: 500 });
  }
}

/** Ticks or unticks a manual step: { id, done }. */
export async function POST(request: Request) {
  const auth = await admin();
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; done?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!MANUAL_STEP_IDS.has(id)) return Response.json({ error: "Étape inconnue" }, { status: 400 });
  const result =
    body.done === false
      ? await auth.supabase.from("admin_quests").delete().eq("id", id)
      : await auth.supabase.from("admin_quests").upsert({ id, done: true, done_at: new Date().toISOString(), done_by: auth.userId });
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
