import type { SupabaseClient } from "@supabase/supabase-js";
import { PROFILE_REQUIRED, PROFILE_REQUIRED_MESSAGE } from "@/lib/profile-store";
import { loadUserSettings } from "@/lib/settings";
import { seedFromCatalogue } from "./index";
import { hasChosenSearch, NO_SEARCH_MESSAGE } from "./config";

export const NO_SEARCH_CODE = "NO_SEARCH";

/**
 * Fills the signed-in account's list from the shared catalogue when the app
 * opens: no job site is called and no AI is paid (the profile's vector is
 * left as it is). Only for an account with a confirmed profile and a chosen
 * search; offers already in the list are not added again, so repeating it is harmless.
 */
export async function refreshFromCatalogue(supabase: SupabaseClient, userId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const unavailable = { status: 503, body: { error: "Mise à jour des offres indisponible. Réessaie dans quelques instants." } };
  const { data: profile, error } = await supabase.from("candidate_profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) return unavailable;
  if (!profile) return { status: 409, body: { error: PROFILE_REQUIRED_MESSAGE, code: PROFILE_REQUIRED } };
  const settings = await loadUserSettings(supabase, userId);
  if (!hasChosenSearch(settings.prefs)) return { status: 200, body: { inserted: 0, searched: false, code: NO_SEARCH_CODE, message: NO_SEARCH_MESSAGE } };
  try {
    return { status: 200, body: { inserted: await seedFromCatalogue(supabase, userId, { refreshVector: false }), searched: true } };
  } catch {
    return unavailable;
  }
}
