import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureProfileEmbedding, geminiEmbedder } from "./embeddings";
import { hasChosenSearch } from "./scan/config";
import { ensureSemanticProfile, semanticEnabled } from "./semantic-embeddings";
import { loadUserSettings } from "./settings";

type Env = Record<string, string | undefined>;

export type VectorState = "ready" | "pending" | "unavailable";

export type OnboardingStatus = {
  /** A profile was confirmed by the student (the row only exists after the confirmation). */
  profileConfirmed: boolean;
  /** At least one métier, keyword or company was chosen. */
  searchChosen: boolean;
  /** The CV's vector: ready, being computed (retried by the next search), or not applicable in this setup. */
  vector: VectorState;
  /** Profile confirmed AND search chosen: the student can enter the application. A pending vector does not block. */
  ready: boolean;
};

/** One read-only answer for the sign-up screens. Never throws a partial answer: a failed read is an error for the caller. */
export async function onboardingStatus(db: SupabaseClient, userId: string, env: Env = process.env): Promise<OnboardingStatus> {
  const [profile, settings] = await Promise.all([
    db.from("candidate_profiles").select("profile,semantic_hash").eq("user_id", userId).maybeSingle(),
    loadUserSettings(db, userId),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  const row = profile.data as { profile?: unknown; semantic_hash?: string | null } | null;
  const profileConfirmed = Boolean(row?.profile);
  const searchChosen = hasChosenSearch(settings.prefs);
  const vector: VectorState = !semanticEnabled(env) ? "unavailable" : row?.semantic_hash ? "ready" : "pending";
  return { profileConfirmed, searchChosen, vector, ready: profileConfirmed && searchChosen };
}

/**
 * The new profile's vector, so the closest offers can be found. Best effort: the confirmed CV stays saved
 * whatever happens. `pending` tells the caller the vector is not there yet (the next search retries it)
 * instead of swallowing the failure.
 */
export async function vectorizeProfile(db: SupabaseClient, userId: string, env: Env = process.env, log: (message: string) => void = console.error): Promise<{ pending: boolean }> {
  if (!semanticEnabled(env)) {
    try { await ensureProfileEmbedding(db, userId, geminiEmbedder(env)); } catch { /* legacy path: never blocked the save */ }
    return { pending: false };
  }
  try {
    const done = await ensureSemanticProfile(db, userId, env);
    return { pending: !done };
  } catch (error) {
    log(`Profile vector not computed: ${error instanceof Error ? error.message : "unknown error"}`);
    return { pending: true };
  }
}
