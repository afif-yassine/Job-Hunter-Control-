import type { ScanConfig } from "../config";
import { clip } from "../text";
import type { ScannedOffer } from "../types";

/**
 * La bonne alternance (API Apprentissage, beta.gouv.fr): apprenticeship
 * offers posted on La bonne alternance plus its partners (France Travail,
 * Météojobs, direct company feeds…).
 *
 * Licence: the key is free but the API is "réservée à des fins non lucratives"
 * — commercial use needs their written agreement. The source only runs when
 * LBA_API_KEY is set: set it in production only once that agreement exists.
 *
 * Endpoint (from the operator's own incident notes, Sept 2026):
 *   GET https://api.apprentissage.beta.gouv.fr/api/job/v1/search
 *       ?latitude&longitude&radius&romes=M1805,M1806
 * The exact response field names are not published in plain text, so the
 * mapper below accepts both the nested shape listed on the explorer page
 * (identifier / offer / workplace / contract / apply) and flat names.
 */

const SEARCH_URL = "https://api.apprentissage.beta.gouv.fr/api/job/v1/search";
const GEOCODER = "https://api-adresse.data.gouv.fr/search/";

/** Tech / data métiers used when the account has no ROME code yet (ROME 4.0). */
export const DEFAULT_TECH_ROMES = ["M1805", "M1806", "M1802", "M1810", "M1801", "M1403"];

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (...values: unknown[]): string | null => {
  for (const v of values) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
};

export function mapLbaJob(raw: unknown): ScannedOffer | null {
  const j = obj(raw);
  const offer = obj(j.offer);
  const workplace = obj(j.workplace);
  const location = obj(workplace.location);
  const contract = obj(j.contract);
  const apply = obj(j.apply);
  const id = obj(j.identifier);
  const publication = obj(offer.publication);

  const title = str(offer.title, j.title);
  const url = str(apply.url, j.url, j.apply_url);
  if (!title || !url) return null;
  const types = contract.type;
  return {
    source: str(id.partner_label) ? `lba:${String(id.partner_label).toLowerCase().replace(/[^a-z0-9]+/g, "")}` : "lba",
    company: str(workplace.name, workplace.brand, workplace.legal_name, j.company) || "Entreprise non communiquée",
    title: clip(title, 200) || title,
    location: str(location.address, workplace.address, j.location),
    contract_type: Array.isArray(types) ? types.filter((t) => typeof t === "string").join(" · ") || null : str(types),
    description: clip(str(offer.description, j.description)),
    url,
    applyUrl: url,
    publishedAt: str(publication.creation, offer.creation, j.creation, j.created_at),
    romeCode: Array.isArray(offer.rome_codes) ? str(...(offer.rome_codes as unknown[])) : null,
  };
}

/** Every job-like array of the response, whatever its top-level name. */
export function lbaJobsIn(body: unknown): unknown[] {
  const root = obj(body);
  const lists = ["jobs", "offres_emploi_lba", "offres_emploi_partenaires", "results"];
  return lists.flatMap((k) => (Array.isArray(root[k]) ? (root[k] as unknown[]) : []));
}

/** City name → coordinates (Base Adresse Nationale, public, no key). */
export async function geocodeCity(city: string, fetchImpl: typeof fetch = fetch): Promise<{ lat: number; lon: number } | null> {
  const params = new URLSearchParams({ q: city, type: "municipality", limit: "1" });
  const response = await fetchImpl(`${GEOCODER}?${params}`, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const body = (await response.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
  const c = body.features?.[0]?.geometry?.coordinates;
  return c && Number.isFinite(c[0]) && Number.isFinite(c[1]) ? { lon: c[0], lat: c[1] } : null;
}

export async function scanLba(
  config: ScanConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
  romes: string[] = DEFAULT_TECH_ROMES,
): Promise<ScannedOffer[]> {
  const key = env.LBA_API_KEY?.trim() || "";
  const place = await geocodeCity(config.city || "Paris", fetchImpl);
  if (!place) throw new Error(`La bonne alternance : ville introuvable (« ${config.city} »).`);
  const params = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    radius: "30",
    romes: romes.slice(0, 10).join(","),
  });
  const response = await fetchImpl(`${SEARCH_URL}?${params}`, {
    headers: { accept: "application/json", authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401 || response.status === 403)
    throw new Error("Clé La bonne alternance refusée : vérifie LBA_API_KEY (espace développeurs, page Profil).");
  if (response.status === 429) throw new Error("Quota La bonne alternance atteint, réessaie plus tard.");
  if (!response.ok) throw new Error(`La bonne alternance : HTTP ${response.status}`);
  const cutoff = Date.now() - Math.max(config.maxAgeDays, 30) * 86_400_000;
  return lbaJobsIn(await response.json())
    .map(mapLbaJob)
    .filter((o): o is ScannedOffer => Boolean(o))
    .filter((o) => !o.publishedAt || Date.parse(o.publishedAt) >= cutoff || Number.isNaN(Date.parse(o.publishedAt)));
}
