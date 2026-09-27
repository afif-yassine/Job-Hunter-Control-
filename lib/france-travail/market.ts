/**
 * "Marché du travail" — France Travail's labor-market statistics API
 * (tension per métier/territoire, hiring volume, salary range). Enriches a
 * job's analysis with market context; never blocks scoring if unavailable.
 * Free · https://francetravail.io/produits-partages/catalogue/marche-travail
 */
import { franceTravailApiReady, getFranceTravailToken, pickNumber, pickString } from "./client";

export type MarketInsight = {
  tensionLabel: string | null;
  tensionScore: number | null;
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  hiringVolume: number | null;
  raw: unknown;
};

const SCOPE_VAR = "FRANCE_TRAVAIL_MARCHE_SCOPE";
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
  if (!marketApiReady(env)) return null;
  const token = await getFranceTravailToken(env[SCOPE_VAR]!, env, fetchImpl);
  const url = new URL(env[URL_VAR]!);
  url.searchParams.set("codeRome", params.romeCode);
  if (params.department) url.searchParams.set("codeDepartement", params.department);
  const response = await fetchImpl(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Marché du travail : HTTP ${response.status}`);
  const body = (await response.json()) as unknown;
  const rec =
    ((Array.isArray((body as { resultats?: unknown[] })?.resultats)
      ? (body as { resultats: Record<string, unknown>[] }).resultats[0]
      : (body as Record<string, unknown>)) ?? {}) as Record<string, unknown>;
  return {
    tensionLabel: pickString(rec, ["tensionLibelle", "libelleTension", "indicateurTensionLibelle"]),
    tensionScore: pickNumber(rec, ["tension", "indiceTension", "scoreTension", "indicateurTension"]),
    avgSalaryMin: pickNumber(rec, ["salaireMin", "salaireMoyenMin", "salaireMensuelMin"]),
    avgSalaryMax: pickNumber(rec, ["salaireMax", "salaireMoyenMax", "salaireMensuelMax"]),
    hiringVolume: pickNumber(rec, ["nombreEmbauches", "volumeEmbauches", "embauches"]),
    raw: body,
  };
}
