import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_LEDGER, normalizeImported, type ImportedProfile } from "@/lib/profile-import";

/** Stable code the app uses to send a student without a confirmed profile to the CV import. */
export const PROFILE_REQUIRED = "PROFILE_REQUIRED";
export const PROFILE_REQUIRED_MESSAGE = "Importe ton CV dans Réglages avant de créer un dossier.";

export type ProfileSummary = {
  full_name: string | null;
  updated_at: string | null;
  experience: number;
  education: number;
  projects: number;
  skills: number;
  languages: number;
  source: string | null;
};

/** What the account's verified profile holds today (null = none yet). */
export async function profileSummary(supabase: SupabaseClient, userId: string): Promise<ProfileSummary | null> {
  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("full_name,updated_at,profile,source_files")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const p = (data.profile ?? {}) as Record<string, unknown>;
  const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  const skills = Object.values((p.skills ?? {}) as Record<string, unknown>).reduce<number>((n, v) => n + len(v), 0);
  const files = Array.isArray(data.source_files) ? (data.source_files as { name?: string }[]) : [];
  return {
    full_name: data.full_name ?? null,
    updated_at: data.updated_at ?? null,
    experience: len(p.experience),
    education: len(p.education),
    projects: len(p.projects),
    skills,
    languages: len(p.languages),
    source: files.at(-1)?.name ?? null,
  };
}

/**
 * Saves a checked CV import as the verified profile. The search target and
 * the truth rules already set stay as they are; the CV replaces the facts.
 */
export async function saveImportedProfile(
  supabase: SupabaseClient,
  userId: string,
  draft: unknown,
  filename: string | null,
): Promise<{ error?: string }> {
  const clean: ImportedProfile = normalizeImported({ ...(draft as object), ...((draft as ImportedProfile)?.profile ?? {}) });
  if (!clean.identity.full_name) return { error: "Le nom est obligatoire." };
  const { data: existing } = await supabase
    .from("candidate_profiles")
    .select("profile,truth_ledger,source_files")
    .eq("user_id", userId)
    .maybeSingle();
  const before = (existing?.profile ?? {}) as Record<string, unknown>;
  const files = Array.isArray(existing?.source_files) ? (existing!.source_files as unknown[]) : [];
  const row = {
    user_id: userId,
    ...clean.identity,
    profile: { ...clean.profile, ...(before.target ? { target: before.target } : {}) },
    truth_ledger: existing?.truth_ledger ?? DEFAULT_LEDGER,
    source_files: [...files, { name: (filename ?? "CV.pdf").slice(0, 120), kind: "cv_pdf", imported_at: new Date().toISOString() }].slice(-10),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("candidate_profiles").upsert(row, { onConflict: "user_id" });
  return error ? { error: error.message } : {};
}
