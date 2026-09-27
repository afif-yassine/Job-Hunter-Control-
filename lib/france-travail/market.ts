/**
 * "Marché du travail" — confirmed live (Sept 2026) to be a broad statistics
 * family (Demandeurs, Dynamique Emploi, Embauches, Offres, Perspectives
 * Recrutement, Salaires...), not one simple "tension for this métier" call.
 * For the MVP we use one confirmed indicator — jobseekers registered for a
 * métier in a territory, per quarter ("DE_1") — as a short market note under
 * an offer. POST with a JSON body (not GET/querystring, as first assumed).
 * Free · https://francetravail.io/produits-partages/catalogue/marche-travail
 */
import { franceTravailApiReady, getFranceTravailToken, pickArray, pickNumber, pickString } from "./client";

export type MarketInsight = {
  jobseekerCount: number | null;
  period: string | null;
  raw: unknown;
};

const SCOPE_VAR = "FRANCE_TRAVAIL_MARCHE_SCOPE";
/** Full endpoint URL including its path, e.g. .../v1/indicateur/stat-demandeurs */
const URL_VAR = "FRANCE_TRAVAIL_MARCHE_URL";
type Env = Record<string, string | undefined>;

export function marketApiReady(env: Env = process.env): boolean {
  return franceTravailApiReady(SCOPE_VAR, URL_VAR, env);
}

export async function fetchMarketInsight(
  params: { romeCode: string; department?: string | null },
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<MarketInsight | null> {
  if (!marketApiReady(env) || !params.department) return null;
  const token = await getFranceTravailToken(env[SCOPE_VAR]!, env, fetchImpl);
  const body = {
    codeTypeTerritoire: "DEP",
    codeTerritoire: params.department,
    codeTypeActivite: "ROME",
    codeActivite: params.romeCode,
    codeTypePeriode: "TRIMESTRE",
    codeTypeNomenclature: "CATCAND",
  };
  const response = await fetchImpl(env[URL_VAR]!, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Marché du travail : HTTP ${response.status}`);
  const raw = (await response.json()) as unknown;
  const rows = pickArray(raw, ["valeurs", "resultats", "result"]) as Record<string, unknown>[];
  const rec = (rows[0] ?? raw) as Record<string, unknown>;
  return {
    jobseekerCount: pickNumber(rec, ["valeur", "nombre", "nombreDemandeurs", "value"]),
    period: pickString(rec, ["periode", "libellePeriode", "codePeriode"]),
    raw,
  };
}
