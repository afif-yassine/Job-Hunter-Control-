/**
 * "Accès à l'emploi des demandeurs d'emploi" — France Travail's statistic on
 * the share of jobseekers finding a job lasting 1+ month within 6 months of
 * registering, by métier/territory. Admin-facing insight only for the MVP
 * (not shown per offer): how "live" a given métier really is.
 *
 * Confirmed live (Sept 2026) straight from the "Stats d'accès à l'emploi...
 * (ACC_1)" endpoint page: POST body {codeTypeTerritoire, codeTerritoire,
 * codeTypeActivite, codeActivite, codeTypePeriode, codeTypeNomenclature:
 * "DUREEEMP"}, scopes "api_stats-perspectives-retour-emploiv1" +
 * "retouremploi". One detail is NOT taken as-is: the page's own example uses
 * codeTypeTerritoire "REG" with codeTerritoire "75" — but its sibling
 * endpoint (Marché du travail's DE_1, same "stats-*" family, same
 * territoire-type enum) confirmed "DEP" works, and "DEP" is the only level
 * our own data has (jobs only carry a department, never a region), so "DEP"
 * is what's sent here too.
 * Free · https://francetravail.io/produits-partages/catalogue/acces-emploi-demandeurs-emploi
 */
import { franceTravailApiReady, getFranceTravailToken, pickArray, pickNumber } from "./client";

export type AccessRate = { rate6Months: number | null; raw: unknown };

const SCOPE_VAR = "FRANCE_TRAVAIL_ACCES_EMPLOI_SCOPE";
/** Full endpoint URL including its path. */
const URL_VAR = "FRANCE_TRAVAIL_ACCES_EMPLOI_URL";
type Env = Record<string, string | undefined>;

export function accesEmploiApiReady(env: Env = process.env): boolean {
  return franceTravailApiReady(SCOPE_VAR, URL_VAR, env);
}

export async function fetchAccessRate(
  params: { romeCode: string; department?: string | null },
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessRate | null> {
  if (!accesEmploiApiReady(env) || !params.department) return null;
  const token = await getFranceTravailToken(env[SCOPE_VAR]!, env, fetchImpl);
  const body = {
    codeTypeTerritoire: "DEP",
    codeTerritoire: params.department,
    codeTypeActivite: "ROME",
    codeActivite: params.romeCode,
    codeTypePeriode: "TRIMESTRE",
    codeTypeNomenclature: "DUREEEMP",
  };
  const response = await fetchImpl(env[URL_VAR]!, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Accès à l'emploi des demandeurs d'emploi : HTTP ${response.status}`);
  const raw = (await response.json()) as unknown;
  const rows = pickArray(raw, ["valeurs", "resultats", "result"]) as Record<string, unknown>[];
  const rec = (rows[0] ?? raw) as Record<string, unknown>;
  return { rate6Months: pickNumber(rec, ["tauxAcces6Mois", "tauxAcces", "taux", "valeur"]), raw };
}
