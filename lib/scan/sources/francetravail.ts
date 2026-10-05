import { cleanSalaryText } from "@/lib/salary";
import { getFranceTravailToken } from "@/lib/france-travail/client";
import type { ScanConfig } from "../config";
import type { ScannedOffer } from "../types";

const SEARCH_URL =
  "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

type FtOffer = {
  id?: string;
  intitule?: string;
  description?: string;
  dateCreation?: string;
  lieuTravail?: { libelle?: string };
  entreprise?: { nom?: string };
  typeContrat?: string;
  typeContratLibelle?: string;
  natureContrat?: string;
  origineOffre?: { urlOrigine?: string };
  contact?: { urlPostulation?: string };
  romeCode?: string;
  salaire?: { libelle?: string; commentaire?: string };
};

export function ftDate(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function mapFranceTravailOffer(o: FtOffer): ScannedOffer | null {
  if (!o.id || !o.intitule) return null;
  const detail = `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`;
  return {
    source: "francetravail",
    company: o.entreprise?.nom?.trim() || "Entreprise non communiquée",
    title: o.intitule.trim(),
    location: o.lieuTravail?.libelle?.trim() || null,
    contract_type:
      [o.natureContrat, o.typeContratLibelle || o.typeContrat]
        .filter(Boolean)
        .join(" · ") || null,
    description: o.description?.trim() || null,
    url: detail,
    applyUrl: o.contact?.urlPostulation || o.origineOffre?.urlOrigine || null,
    publishedAt: o.dateCreation || null,
    romeCode: o.romeCode?.trim() || null,
    salary: cleanSalaryText(o.salaire?.libelle) ?? cleanSalaryText(o.salaire?.commentaire),
  };
}

export async function scanFranceTravail(
  config: ScanConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<ScannedOffer[]> {
  const token = await getFranceTravailToken(SCOPE, env, fetchImpl);

  const since = new Date(now.getTime() - config.maxAgeDays * 86_400_000);
  const offers: ScannedOffer[] = [];
  for (const query of config.queries) {
    const params = new URLSearchParams({
      motsCles: query.keywords,
      departement: config.departments.slice(0, 5).join(","),
      range: "0-49",
      sort: "1", // most recent first
      minCreationDate: ftDate(since),
      maxCreationDate: ftDate(now),
    });
    const response = await fetchImpl(`${SEARCH_URL}?${params}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    });
    if (response.status === 204) continue; // no result
    if (response.status !== 200 && response.status !== 206)
      throw new Error(
        `Recherche France Travail « ${query.keywords} » : HTTP ${response.status}`,
      );
    const body = (await response.json()) as { resultats?: FtOffer[] };
    for (const raw of body.resultats ?? []) {
      const mapped = mapFranceTravailOffer(raw);
      if (mapped) offers.push(mapped);
    }
    await new Promise((r) => setTimeout(r, 150)); // stay far below 10 req/s
  }
  return offers;
}

/** France Travail returns at most 150 offers per call and 3 150 per search. */
export const FT_PAGE = 150;
export const FT_MAX_INDEX = 3149;

export type FtHarvestQuery = {
  /** Whole "Informatique / Télécommunication" domain ("M18")… */
  grandDomaine?: string;
  /** …or a list of ROME codes (up to 200). */
  codeROME?: string[];
  /** E2 = apprentissage, FS = professionnalisation. */
  natureContrat?: string;
  typeContrat?: string;
  region?: string;
  departement?: string;
};

/** "offres 0-149/1234" → 1234. */
export function ftTotal(contentRange: string | null): number | null {
  const m = /\/(\d+)\s*$/.exec(contentRange ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * One page of a national harvest search (offers of the last 31 days).
 * `total` lets the caller split a search that exceeds 3 150 offers.
 */
export async function fetchFranceTravailPage(
  query: FtHarvestQuery,
  start: number,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ offers: ScannedOffer[]; total: number | null; last: boolean }> {
  const end = Math.min(start + FT_PAGE - 1, FT_MAX_INDEX);
  const params = new URLSearchParams({ range: `${start}-${end}`, sort: "1", publieeDepuis: "31" });
  if (query.grandDomaine) params.set("grandDomaine", query.grandDomaine);
  if (query.codeROME?.length) params.set("codeROME", query.codeROME.slice(0, 200).join(","));
  if (query.natureContrat) params.set("natureContrat", query.natureContrat);
  if (query.typeContrat) params.set("typeContrat", query.typeContrat);
  if (query.region) params.set("region", query.region);
  if (query.departement) params.set("departement", query.departement);
  const response = await fetchImpl(`${SEARCH_URL}?${params}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 204) return { offers: [], total: 0, last: true };
  if (response.status === 429) throw new Error("France Travail : trop de requêtes (429), reprise à la prochaine tranche.");
  if (response.status !== 200 && response.status !== 206) {
    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`France Travail : HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
  }
  const total = ftTotal(response.headers.get("content-range"));
  const body = (await response.json()) as { resultats?: FtOffer[] };
  const offers = (body.resultats ?? []).map(mapFranceTravailOffer).filter((o): o is ScannedOffer => Boolean(o));
  const last = response.status === 200 || end >= FT_MAX_INDEX || (total !== null && end + 1 >= total) || offers.length < FT_PAGE;
  return { offers, total, last };
}

export { SCOPE as FT_OFFERS_SCOPE };
