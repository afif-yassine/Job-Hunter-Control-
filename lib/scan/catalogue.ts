import type { SupabaseClient } from "@supabase/supabase-js";
import { searchWords } from "./words";
import type { ScanConfig, SearchQuery } from "./config";
import { inArea } from "./area";
import { categorize, contractKind } from "./categories";
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

/**
 * Identity of a query for the shared cache: case, accents, punctuation, word
 * order, filler words and common synonyms do not matter —
 * "Alternance Développeur Web", "alternance developpeur web" and
 * "web developer alternant" are the same search.
 */
export function normalizeQuery(q: SearchQuery): string {
  return [...new Set(searchWords(q.keywords))].sort().join(" ");
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
    categories: categorize(o),
    contract_kind: contractKind(o),
    salary: o.salary ?? null,
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
export { searchWords } from "./words";

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
  categories?: string[] | null;
  contract_kind?: string | null;
};

/** Is the offer in one of the ticked categories, with a wanted contract? */
export function matchesCategories(
  offer: Pick<CatalogueRow, "title" | "contract_type" | "source" | "rome_code" | "categories" | "contract_kind">,
  config: Pick<ScanConfig, "categories" | "contracts">,
): boolean {
  const wanted = config.categories ?? [];
  if (!wanted.length) return false;
  const cats = offer.categories?.length ? offer.categories : categorize({ title: offer.title, romeCode: offer.rome_code });
  if (!cats.some((c) => wanted.includes(c))) return false;
  const kinds = config.contracts ?? [];
  const kind = offer.contract_kind || contractKind(offer);
  return !kinds.length || kinds.includes(kind);
}

const IMPORT_SCAN = 3000;
/** Offers added for being close to the profile (embeddings), on top of the words and categories. */
const SIMILAR_MAX = 40;
const SIMILAR_MIN = 0.55;
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
  // Nothing asked yet: only the profile can still bring offers (embeddings).
  const seenSince = new Date(now - (EXPIRE_DAYS + 1) * 86_400_000).toISOString();
  const { data, error } = await db
    .from("offers")
    .select("id,fingerprint,title,company,location,contract_type,source,url,apply_url,published_at,rome_code,board,categories,contract_kind")
    .eq("status", "open")
    .gte("last_seen_at", seenSince)
    .order("last_seen_at", { ascending: false })
    .limit(IMPORT_SCAN);
  if (error) return { ...empty, error: error.message };
  const cutoff = now - config.maxAgeDays * 86_400_000;
  const fits = (o: CatalogueRow) => (!o.published_at || Date.parse(o.published_at) >= cutoff) && inArea(o.location, config);
  const byWords = ((data ?? []) as CatalogueRow[])
    .filter(fits)
    .filter((o) => matchesCategories(o, config) || config.queries.some((q) => matchesQuery(o, q)))
    .slice(0, IMPORT_MAX);

  // Closest to the profile (embeddings), whatever their words: same place,
  // dates and contracts, in the scope of the platform.
  const similar: CatalogueRow[] = [];
  const { data: near } = await db.rpc("match_offers_for_me", { p_limit: 200 });
  const nearIds = ((near ?? []) as { offer_id: string; similarity: number }[])
    .filter((r) => r.similarity >= SIMILAR_MIN)
    .map((r) => r.offer_id)
    .filter((id) => !byWords.some((o) => o.id === id));
  for (let i = 0; i < nearIds.length && similar.length < SIMILAR_MAX; i += 100) {
    const { data: part } = await db
      .from("offers")
      .select("id,fingerprint,title,company,location,contract_type,source,url,apply_url,published_at,rome_code,board,categories,contract_kind")
      .in("id", nearIds.slice(i, i + 100));
    const kinds = config.contracts ?? [];
    for (const o of (part ?? []) as CatalogueRow[]) {
      const kind = o.contract_kind || contractKind(o);
      if (fits(o) && (!kinds.length || kinds.includes(kind)) && similar.length < SIMILAR_MAX) similar.push(o);
    }
  }
  const rows = [...byWords, ...similar];
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

/**
 * How many open offers of each category the catalogue holds around the
 * account (for the category picker). Computed from the offers' own fields:
 * never calls a job site.
 */
export async function categoryCounts(
  db: SupabaseClient,
  area: Pick<ScanConfig, "city" | "departments" | "maxAgeDays" | "contracts">,
  now = Date.now(),
): Promise<{ total: number; byCategory: Record<string, number>; error?: string }> {
  const { data, error } = await db
    .from("offers")
    .select("title,location,contract_type,source,rome_code,published_at,categories,contract_kind")
    .eq("status", "open")
    .order("last_seen_at", { ascending: false })
    .limit(IMPORT_SCAN * 3);
  if (error) return { total: 0, byCategory: {}, error: error.message };
  const cutoff = now - area.maxAgeDays * 86_400_000;
  const kinds = area.contracts ?? [];
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const o of (data ?? []) as CatalogueRow[]) {
    if (o.published_at && Date.parse(o.published_at) < cutoff) continue;
    if (!inArea(o.location, area)) continue;
    const kind = o.contract_kind || contractKind(o);
    if (kinds.length && !kinds.includes(kind)) continue;
    const cats = o.categories?.length ? o.categories : categorize({ title: o.title, romeCode: o.rome_code });
    if (!cats.length) continue;
    total += 1;
    for (const c of cats) byCategory[c] = (byCategory[c] ?? 0) + 1;
  }
  return { total, byCategory };
}
