/**
 * "Accès à l'emploi des demandeurs d'emploi" — France Travail's statistic on
 * the share of jobseekers finding a job lasting 1+ month within 6 months of
 * registering, by métier/territory. Admin-facing insight only for the MVP
 * (not shown per offer): how "live" a given métier really is.
 * Free · https://francetravail.io/produits-partages/catalogue/acces-emploi-demandeurs-emploi
 */
import { franceTravailApiReady, getFranceTravailToken, pickNumber } from "./client";

export type AccessRate = { rate6Months: number | null; raw: unknown };

const SCOPE_VAR = "FRANCE_TRAVAIL_ACCES_EMPLOI_SCOPE";
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
  if (!accesEmploiApiReady(env)) return null;
  const token = await getFranceTravailToken(env[SCOPE_VAR]!, env, fetchImpl);
  const url = new URL(env[URL_VAR]!);
  url.searchParams.set("codeRome", params.romeCode);
  if (params.department) url.searchParams.set("codeDepartement", params.department);
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Accès à l'emploi des demandeurs d'emploi : HTTP ${response.status}`);
  const body = (await response.json()) as unknown;
  const rec =
    ((Array.isArray((body as { resultats?: unknown[] })?.resultats)
      ? (body as { resultats: Record<string, unknown>[] }).resultats[0]
      : (body as Record<string, unknown>)) ?? {}) as Record<string, unknown>;
  return { rate6Months: pickNumber(rec, ["tauxAcces6Mois", "tauxAcces", "taux"]), raw: body };
}
