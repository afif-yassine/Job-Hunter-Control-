import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PREFS, normalizePrefs, type ScanPrefs } from "@/lib/scan/config";

export type UserSettings = {
  prefs: ScanPrefs;
  autoScan: boolean;
  lastScanAt: string | null;
};

const DEFAULTS: UserSettings = { prefs: DEFAULT_PREFS, autoScan: true, lastScanAt: null };

/** Settings row of the user; defaults when nothing is saved or the table is missing. */
export async function loadUserSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("scan_config,auto_scan,last_scan_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return DEFAULTS;
  return {
    prefs: normalizePrefs(data.scan_config),
    autoScan: data.auto_scan !== false,
    lastScanAt: data.last_scan_at ?? null,
  };
}

export async function saveUserSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: { prefs?: ScanPrefs; autoScan?: boolean; lastScanAt?: string },
) {
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.prefs) row.scan_config = patch.prefs;
  if (patch.autoScan !== undefined) row.auto_scan = patch.autoScan;
  if (patch.lastScanAt) row.last_scan_at = patch.lastScanAt;
  return supabase.from("user_settings").upsert(row, { onConflict: "user_id" });
}
