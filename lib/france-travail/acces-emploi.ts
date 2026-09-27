/**
 * "Accès à l'emploi des demandeurs d'emploi" — France Travail's statistic on
 * the share of jobseekers finding a job lasting 1+ month within 6 months of
 * registering, by métier/territory. Admin-facing insight only for the MVP
 * (not shown per offer): how "live" a given métier really is.
 *
 * Sibling API of "Marché du travail" (same "stats-*" platform, same request
 * shape confirmed there: POST with a JSON body, not GET/querystring) — the
 * body shape below follows that confirmed pattern but hasn't been verified
 * against this specific endpoint's own live response yet.
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
