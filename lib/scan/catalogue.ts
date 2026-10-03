import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeText } from "@/lib/questions";
import type { ScanConfig, SearchQuery } from "./config";
import { inArea } from "./area";
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
  apprentice: "alternance",
  trainee: "stage",
  software: "developpeur",
  stagiaire: "stage",
  internship: "stage",
  intern: "stage",
  professionnalisation: "alternance",
  ai: "intelligence artificielle",
  ia: "intelligence artificielle",
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
  return [...new Set(searchWords(q.keywords))].sort().join(" ");
}

/** Normalised, canonical words of a text (same rules as the cache identity). */
export function searchWords(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    // Plural → singular ("développeurs", "analysts"), same rule on both sides.
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .flatMap((w) => (QUERY_SYNONYMS[w] ?? w).split(" "))
    .filter((w) => w && !QUERY_NOISE.has(w));
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

// Import from the catalogue ----------------------------------------------------

const CONTRACT_WORDS = new Set(["alternance", "stage", "cdi", "cdd", "interim", "freelance"]);

/**
 * Does this offer answer this query? Every job word of the query must be in
 * the title (after normalisation and synonyms); a contract word (alternance,
 * stage…) must be in the title or the contract type.
 */
export function matchesQuery(
  offer: { title: string; contract_type?: string | null; source?: string | null },
  query: SearchQuery,
): boolean {
  const words = searchWords(query.keywords);
  const contracts = words.filter((w) => CONTRACT_WORDS.has(w));
  const job = words.filter((w) => !CONTRACT_WORDS.has(w));
  if (!job.length) return false;
  const has = new Set(searchWords(`${offer.title} ${offer.contract_type ?? ""}`));
  if (!job.every((w) => has.has(w))) return false;
  if (!contracts.length) return true;
  // La bonne alternance only lists apprenticeships.
  const apprenticeshipSite = /^lba\b|labonnealternance/.test(offer.source ?? "");
  return contracts.some((c) => has.has(c) || (c === "alternance" && apprenticeshipSite));
}

export { inArea } from "./area";

type CatalogueRow = {
  id: string;
  fingerprint: string;
  title: string;
  company: string;
  location: string | null;
  contract_type: string | null;
  source: string;
  url: string;
  apply_url: string | null;
  published_at: string | null;
  rome_code: string | null;
  board: string | null;
};

const IMPORT_SCAN = 3000;
const IMPORT_MAX = 300;

/**
 * Offers already in the catalogue (found by any account, any wording) that
 * answer this account's search: no call to any job site. Read with the
 * account's own client (offers are readable by every signed-in user).
 */
export async function importFromCatalogue(
  db: SupabaseClient,
  config: ScanConfig,
  now = Date.now(),
): Promise<{ offers: ScannedOffer[]; entries: Map<string, CatalogueEntry>; boards: string[]; error?: string }> {
  const empty = { offers: [], entries: new Map<string, CatalogueEntry>(), boards: [] };
  if (!config.queries.length) return empty;
  const seenSince = new Date(now - (EXPIRE_DAYS + 1) * 86_400_000).toISOString();
  const { data, error } = await db
    .from("offers")
    .select("id,fingerprint,title,company,location,contract_type,source,url,apply_url,published_at,rome_code,board")
    .eq("status", "open")
    .gte("last_seen_at", seenSince)
    .order("last_seen_at", { ascending: false })
    .limit(IMPORT_SCAN);
  if (error) return { ...empty, error: error.message };
  const cutoff = now - config.maxAgeDays * 86_400_000;
  const rows = ((data ?? []) as CatalogueRow[])
    .filter((o) => !o.published_at || Date.parse(o.published_at) >= cutoff)
    .filter((o) => inArea(o.location, config))
    .filter((o) => config.queries.some((q) => matchesQuery(o, q)))
    .slice(0, IMPORT_MAX);
  if (!rows.length) return empty;

  // Full texts only for the offers kept (the catalogue can be large).
  const texts = new Map<string, string | null>();
  for (let i = 0; i < rows.length; i += 100) {
    const { data: part } = await db
      .from("offers")
      .select("id,description")
      .in("id", rows.slice(i, i + 100).map((r) => r.id));
    for (const r of (part ?? []) as { id: string; description: string | null }[]) texts.set(r.id, r.description);
  }
  const entries = new Map<string, CatalogueEntry>();
  const boards = new Set<string>();
  const offers = rows.map((r): ScannedOffer => {
    if (r.board) boards.add(r.board);
    const offer: ScannedOffer = {
      source: r.source,
      company: r.company,
      title: r.title,
      location: r.location,
      contract_type: r.contract_type,
      description: texts.get(r.id) ?? null,
      url: r.url,
      applyUrl: r.apply_url,
      publishedAt: r.published_at,
      romeCode: r.rome_code,
      board: r.board ?? undefined,
    };
    // Keyed like ingestOffers computes it (and as stored, should the rules change).
    entries.set(offerFingerprint(offer), { id: r.id, status: "open" });
    entries.set(r.fingerprint, { id: r.id, status: "open" });
    return offer;
  });
  return { offers, entries, boards: [...boards] };
}
