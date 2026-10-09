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

/** Whether the signed-in account is the administrator (same `is_admin` check). An unreadable answer is "no". */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

/**
 * Whether this account id is the administrator, read from `app_admins` with the given client
 * (the account's own client sees its own row; the service client sees all). Unlike `isAdmin`
 * it does not depend on who is signed in, so it also works for the server-side pipeline.
 * An unreadable answer is "no".
 */
export async function isAdminId(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db.from("app_admins").select("user_id").eq("user_id", userId).limit(1);
  return !error && (data ?? []).length > 0;
}
