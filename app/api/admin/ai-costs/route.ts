import { authenticatedClient } from "@/lib/api";
import { aiCostsByAccount } from "@/lib/admin/ai-costs";
import { serviceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** AI tokens and estimated cost per account, last 30 days (admins only). */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { data: isAdmin } = await auth.supabase.rpc("is_admin");
  if (isAdmin !== true) return Response.json({ error: "Réservé à l’administrateur." }, { status: 403 });
  const service = serviceClient();
  if (!service) return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante dans Vercel." }, { status: 503 });
  try {
    return Response.json(await aiCostsByAccount(service));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Coûts IA indisponibles" }, { status: 500 });
  }
}
