import { adminRefusal } from "@/lib/admin";
import { gatewayCredits } from "@/lib/admin/gateway-credits";
import { authenticatedClient } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Real AI Gateway balance (read from Vercel, free) next to what the application recorded. Admins only, read only. */
export async function GET() {
  const auth = await authenticatedClient("probe");
  if ("error" in auth) return auth.error;
  const refusal = await adminRefusal(auth.supabase);
  if (refusal) return refusal;
  const service = serviceClient();
  if (!service) return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante dans Vercel." }, { status: 503 });
  return Response.json(await gatewayCredits(service));
}
