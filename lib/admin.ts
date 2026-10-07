import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The refusal to send back unless the signed-in account is the administrator
 * (same `is_admin` check as app/api/admin/*). Closed by default: an unreadable
 * answer is a refusal too.
 */
export async function adminRefusal(supabase: SupabaseClient): Promise<Response | null> {
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return isAdmin === true ? null : Response.json({ error: "Réservé à l’administrateur." }, { status: 403 });
}
