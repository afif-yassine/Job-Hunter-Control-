import { authenticatedClient } from "@/lib/api";
import { refreshFromCatalogue } from "@/lib/scan/refresh";

export const dynamic = "force-dynamic";

/** Opens the student's list from the shared catalogue (no job site called, no AI paid). */
export async function POST() {
  const auth = await authenticatedClient("scan");
  if ("error" in auth) return auth.error;
  const result = await refreshFromCatalogue(auth.supabase, auth.userId);
  return Response.json(result.body, { status: result.status });
}
