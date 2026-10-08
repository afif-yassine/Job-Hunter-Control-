import type { SupabaseClient } from "@supabase/supabase-js";
import { getFranceTravailToken } from "@/lib/france-travail/client";
import { FT_OFFERS_SCOPE } from "@/lib/scan/sources/francetravail";
import { isPublicHttpsUrl } from "@/lib/scan/enrich";

/**
 * Is the offer still online? Checked just before writing a CV and a letter
 * (the expensive step). Only a clear "gone" counts: a site refusing robots
 * (403), a timeout or a network error never removes an offer.
 */

type Env = Record<string, string | undefined>;
export type OnlineCheck = { online: boolean | null; reason?: string };
export type OnlineJob = { offer_id?: string | null; source_platform?: string | null; source_url?: string | null; official_url?: string | null };

const FT_DETAIL = /francetravail\.fr\/offres\/recherche\/detail\/([A-Za-z0-9]+)/;
const FT_API = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/";

export async function stillOnline(job: OnlineJob, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<OnlineCheck> {
  try {
    // France Travail: ask its API for the offer itself (its public page stays up).
    const ft = FT_DETAIL.exec(job.source_url ?? "");
    if (ft && env.FRANCE_TRAVAIL_CLIENT_ID && env.FRANCE_TRAVAIL_CLIENT_SECRET) {
      const token = await getFranceTravailToken(FT_OFFERS_SCOPE, env, fetchImpl);
      const r = await fetchImpl(`${FT_API}${ft[1]}`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (r.status === 204 || r.status === 404 || r.status === 410)
        return { online: false, reason: "France Travail ne publie plus cette offre." };
      return { online: r.ok ? true : null };
    }
    const url = job.official_url || job.source_url;
    if (!url || !isPublicHttpsUrl(url)) return { online: null };
    const r = await fetchImpl(url, {
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; JobHunterControl/1.0; personal job assistant)", accept: "text/html" },
      signal: AbortSignal.timeout(8_000),
    });
    if (r.status === 404 || r.status === 410) return { online: false, reason: `La page de l’offre n’existe plus (HTTP ${r.status}).` };
    return { online: r.ok ? true : null };
  } catch {
    return { online: null };
  }
}

/** Shared HTTP/API checks, never a LLM call. Uncertain results have a short TTL. */
export async function stillOnlineCached(job: OnlineJob, service: SupabaseClient | null, env: Env = process.env, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<OnlineCheck> {
  if (!service || !job.offer_id) return stillOnline(job, env, fetchImpl);
  const { data, error } = await service.from("offers").select("availability_check").eq("id", job.offer_id).maybeSingle();
  const cached = data?.availability_check;
  if (!error && cached && [true, false, null].includes(cached.online) && cached.source_url === (job.source_url ?? null) && cached.official_url === (job.official_url ?? null)) {
    const age = now - Date.parse(cached.checked_at);
    if (age >= 0 && age < (cached.online === null ? 300_000 : 3_600_000)) return { online: cached.online, reason: cached.reason };
  }
  const result = await stillOnline(job, env, fetchImpl);
  // Cache storage is best effort: a database outage never means that an offer is gone.
  await service.from("offers").update({ availability_check: { ...result, checked_at: new Date(now).toISOString(), source_url: job.source_url ?? null, official_url: job.official_url ?? null } }).eq("id", job.offer_id);
  return result;
}

/** The account's copy leaves its lists; the shared offer is closed for everybody (service client). */
/**
 * The shared catalogue's own word. An offer closed or expired there is gone for
 * everybody, whatever the student's own row says (a student can edit it). An
 * unreadable or missing catalogue row decides nothing: the other checks still apply.
 */
export async function closedInCatalogue(supabase: SupabaseClient, job: { offer_id?: string | null }): Promise<boolean> {
  if (!job.offer_id) return false;
  const { data, error } = await supabase.from("offers").select("status").eq("id", job.offer_id).maybeSingle();
  if (error || !data) return false;
  return data.status === "closed" || data.status === "expired";
}

/**
 * Records on THIS student's own row that the catalogue closed the offer, so their lists stop showing it.
 * Not a report and not a closure for anybody else: nothing is written to the shared catalogue.
 * Idempotent (the first date is kept) and never fatal: the refusal stands even if the write fails.
 */
export async function markGoneForStudent(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  reason = "Offre fermée sur le catalogue commun.",
): Promise<void> {
  try {
    await supabase.from("jobs").update({ gone_reason: reason, gone_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId).is("gone_at", null);
  } catch {
    /* the 410 is still returned */
  }
}

export async function markGone(
  supabase: SupabaseClient,
  service: SupabaseClient | null,
  job: { id: string; offer_id?: string | null },
  userId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("jobs")
    .update({ gone_reason: `${reason} Vérifié juste avant de créer le CV.`, gone_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("user_id", userId);
  if (service && job.offer_id) await service.rpc("close_offer", { p_offer: job.offer_id, p_reason: reason });
}
