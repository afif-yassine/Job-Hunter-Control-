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
