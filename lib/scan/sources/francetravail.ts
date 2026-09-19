import type { ScanConfig } from "../config";
import type { ScannedOffer } from "../types";

const TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire";
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
  };
}

export async function scanFranceTravail(
  config: ScanConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<ScannedOffer[]> {
  const tokenResponse = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.FRANCE_TRAVAIL_CLIENT_ID || "",
      client_secret: env.FRANCE_TRAVAIL_CLIENT_SECRET || "",
      scope: SCOPE,
    }),
  });
  if (!tokenResponse.ok)
    throw new Error(
      `Authentification France Travail refusée (${tokenResponse.status}). Vérifie FRANCE_TRAVAIL_CLIENT_ID / _SECRET et que l'API « Offres d'emploi v2 » est activée sur francetravail.io.`,
    );
  const { access_token: token } = (await tokenResponse.json()) as { access_token?: string };
  if (!token) throw new Error("France Travail n'a pas renvoyé de jeton.");

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
