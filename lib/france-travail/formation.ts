/**
 * NOT WIRED INTO THE APP (confirmed Sept 2026 from the live docs).
 *
 * "Open Formation" turned out not to be a training-search catalogue: its 3
 * endpoints ("Lister les dates de rendez-vous à une formation", "Consulter
 * le détail d'un rendez-vous", "Lister les plages de candidature") only let
 * an organisme de formation look up RDV/candidature windows for a formation
 * it already runs — they need numeroSession/numeroAction/numeroFormation as
 * path parameters, not a métier or ROME code. There is no way to search
 * "which training fills this skill gap" with this API.
 *
 * Kept here, unused, in case a future France Travail API (or a different
 * provider, e.g. Mon Compte Formation's own open data) exposes a real
 * search-by-métier endpoint — the OAuth plumbing below is reusable as-is.
 * Free · https://francetravail.io/produits-partages/catalogue/open-formation
 */
import { franceTravailApiReady, getFranceTravailToken, pickArray, pickNumber, pickString } from "./client";

export type TrainingSuggestion = {
  title: string;
  provider: string | null;
  url: string | null;
  durationHours: number | null;
  funded: boolean | null;
};

const SCOPE_VAR = "FRANCE_TRAVAIL_FORMATION_SCOPE";
const URL_VAR = "FRANCE_TRAVAIL_FORMATION_URL";
type Env = Record<string, string | undefined>;

export function formationApiReady(env: Env = process.env): boolean {
  return franceTravailApiReady(SCOPE_VAR, URL_VAR, env);
}

export async function fetchTrainingSuggestions(
  params: { romeCode: string; department?: string | null; limit?: number },
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<TrainingSuggestion[]> {
  if (!formationApiReady(env)) return [];
  const token = await getFranceTravailToken(env[SCOPE_VAR]!, env, fetchImpl);
  const url = new URL(env[URL_VAR]!);
  url.searchParams.set("codeRome", params.romeCode);
  if (params.department) url.searchParams.set("codeDepartement", params.department);
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`Open Formation : HTTP ${response.status}`);
  const body = (await response.json()) as unknown;
  const rows = pickArray(body, ["formations", "resultats", "result"]) as Record<string, unknown>[];
  const limit = params.limit ?? 3;
  return rows.slice(0, limit).map((row) => ({
    title: pickString(row, ["intitule", "intituleFormation", "libelle"]) || "Formation",
    provider: pickString(row, ["organismeFormation", "organisme", "nomOrganisme"]),
    url: pickString(row, ["urlFormation", "url", "lienInscription"]),
    durationHours: pickNumber(row, ["dureeIndicativeHeures", "dureeHeures", "duree"]),
    funded: /cpf|gratuit|financ|pris en charge/i.test(
      [pickString(row, ["modaliteFinancement", "financement"]) ?? ""].join(" "),
    ) || null,
  }));
}
