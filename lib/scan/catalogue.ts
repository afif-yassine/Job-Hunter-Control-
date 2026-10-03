import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeText } from "@/lib/questions";
import type { ScanConfig, SearchQuery } from "./config";
import { canonicalUrl, fingerprintOf } from "./ingest";
import type { ScannedOffer } from "./types";

/**
 * The shared offers catalogue (table public.offers, see the migration
 * 20261003090000_offers_catalogue.sql).
 *
 * - Every offer found by any account is stored once, by fingerprint.
 * - Searches are cached per single query ("alternance développeur" in Paris),
 *   not per account's whole search, so accounts with overlapping searches
 *   share the same API calls.
 * - An offer nobody sees for EXPIRE_DAYS, or that left its company's careers
 *   board, is marked gone; accounts that had not applied see it under
 *   "Plus disponibles" and nothing more is spent on it.
 *
 * Everything here needs the service client and never blocks a scan: without
 * it, the scan works exactly as before (offers only in the account's list).
 */

export const EXPIRE_DAYS = 21;

const UNKNOWN_COMPANY = /^(à compléter|entreprise non communiquée)$/i;

/** Same identity as in ingestOffers: an offer without company is known by its link. */
export function offerFingerprint(offer: Pick<ScannedOffer, "company" | "title" | "location" | "contract_type" | "url">): string {
  return UNKNOWN_COMPANY.test(offer.company.trim()) ? `url|${canonicalUrl(offer.url)}` : fingerprintOf(offer);
}

/** Smallest standard window covering the account's: accounts at 10 and 14 days share one call. */
export function dayBucket(days: number): number {
  return days <= 7 ? 7 : days <= 14 ? 14 : 31;
}

/** Words that do not change what a search finds. */
const QUERY_NOISE = new Set("de d du des la le les l en et a au aux pour h f x hf fh".split(" "));

/** Different words, same job: they share one cached search. */
const QUERY_SYNONYMS: Record<string, string> = {
  dev: "developpeur",
  developer: "developpeur",
  developpeuse: "developpeur",
  engineer: "ingenieur",
  ingenieure: "ingenieur",
  alternant: "alternance",
  alternante: "alternance",
  apprentissage: "alternance",
  apprenti: "alternance",
  apprentie: "alternance",
  apprenticeship: "alternance",
  stagiaire: "stage",
  internship: "stage",
  intern: "stage",
  ai: "ia",
  fullstack: "full stack",
  frontend: "front end",
  backend: "back end",
};

/**
 * Identity of a query for the shared cache: case, accents, punctuation, word
 * order, filler words and common synonyms do not matter —
 * "Alternance Développeur Web", "alternance developpeur web" and
 * "web developer alternant" are the same search.
 */
export function normalizeQuery(q: SearchQuery): string {
  const words = normalizeText(q.keywords)
    .split(" ")
    .flatMap((w) => (QUERY_SYNONYMS[w] ?? w).split(" "))
    .filter((w) => w && !QUERY_NOISE.has(w));
  return [...new Set(words)].sort().join(" ");
}

/** What makes two single-query searches identical for a source. */
export function queryCacheParts(source: string, query: SearchQuery, config: ScanConfig) {
  return {
    v: 2,
    source,
    q: normalizeQuery(query),
    city: config.city.toLowerCase().trim(),
    dep: [...config.departments].sort(),
    days: dayBucket(config.maxAgeDays),
  };
}

/** Results of a shared (bucketed) search, cut back to the account's own window. */
export function withinDays(offers: ScannedOffer[], days: number, now = Date.now()): ScannedOffer[] {
  const cutoff = now - days * 86_400_000;
  return offers.filter((o) => {
    const t = o.publishedAt ? Date.parse(o.publishedAt) : NaN;
    return Number.isNaN(t) || t >= cutoff;
  });
}

export type CatalogueEntry = { id: string; status: "open" | "expired" | "closed" };

/** Store or refresh offers in the catalogue; fingerprint → catalogue entry. */
export async function harvestOffers(
  db: SupabaseClient | null,
  offers: ScannedOffer[],
): Promise<{ entries: Map<string, CatalogueEntry>; error?: string }> {
  const entries = new Map<string, CatalogueEntry>();
  if (!db || !offers.length) return { entries };
  const rows = offers.map((o) => ({
    fingerprint: offerFingerprint(o),
    title: o.title,
    company: o.company,
    location: o.location,
    contract_type: o.contract_type,
    description: o.description,
    source: o.source,
    url: canonicalUrl(o.url),
    apply_url: o.applyUrl || null,
    published_at: o.publishedAt,
    rome_code: o.romeCode ?? null,
    board: o.board ?? null,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await db.rpc("upsert_offers", { p_rows: rows.slice(i, i + 200) });
    if (error) return { entries, error: error.message };
    for (const r of (data ?? []) as { o_fingerprint: string; o_id: string; o_status: CatalogueEntry["status"] }[])
      entries.set(r.o_fingerprint, { id: r.o_id, status: r.o_status });
  }
  return { entries };
}

/** A careers board read in full: its offers no longer listed are closed. */
export async function closeBoardOffers(db: SupabaseClient | null, board: string, listedUrls: string[]): Promise<number> {
  if (!db) return 0;
  const { data, error } = await db.rpc("close_board_offers", { p_board: board, p_urls: listedUrls });
  return error ? 0 : Number(data) || 0;
}

/** Offers nobody has seen for EXPIRE_DAYS become "expired". */
export async function expireOffers(db: SupabaseClient | null, days = EXPIRE_DAYS): Promise<number> {
  if (!db) return 0;
  const { data, error } = await db.rpc("expire_offers", { p_days: days });
  return error ? 0 : Number(data) || 0;
}
