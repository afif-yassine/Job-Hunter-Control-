import { adminRefusal } from "@/lib/admin";
import { listAccounts, pageParams } from "@/lib/admin/users";
import { authenticatedClient } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** The accounts, one page at a time: dates, CV imported or not, kits of the month, AI calls and cost. Admins only, read only. */
export async function GET(req: Request) {
  const auth = await authenticatedClient("probe");
  if ("error" in auth) return auth.error;
  const refusal = await adminRefusal(auth.supabase);
  if (refusal) return refusal;
  const service = serviceClient();
  if (!service) return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante dans Vercel." }, { status: 503 });
  try {
    return Response.json(await listAccounts(service, pageParams(new URL(req.url).searchParams)));
  } catch {
    return Response.json({ error: "Liste des comptes indisponible." }, { status: 500 });
  }
}
