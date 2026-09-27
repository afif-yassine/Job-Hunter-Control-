import { authenticatedClient } from "@/lib/api";
import { buildAdminOverview } from "@/lib/admin/overview";
import { serviceClient } from "@/lib/supabase/admin";
import { workerState } from "@/lib/worker-status";

export const dynamic = "force-dynamic";

/** Platform health for admins only: AI, sources, budgets, automation, actions to take. */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { data: isAdmin } = await auth.supabase.rpc("is_admin");
  if (isAdmin !== true) return Response.json({ error: "Réservé à l’administrateur." }, { status: 403 });
  const overview = await buildAdminOverview({
    supabase: auth.supabase,
    userId: auth.userId,
    service: serviceClient(),
    worker: await workerState(),
  });
  return Response.json(overview);
}
