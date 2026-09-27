/**
 * One client_id/client_secret pair (FRANCE_TRAVAIL_CLIENT_ID / _SECRET),
 * shared by every France Travail partner API. Each API just needs its own
 * OAuth2 "scope" string — subscribed for free on francetravail.io — and its
 * own base URL. Kept here once so job offers, Open Formation, Marché du
 * travail and Accès à l'emploi des demandeurs d'emploi all authenticate the
 * same way.
 */

// Confirmed from the live francetravail.io API documentation (Sept 2026,
// "Client Credentials OAuth Flow" panel shown on every endpoint page).
// Overridable (FRANCE_TRAVAIL_TOKEN_URL) in case France Travail moves it again.
export const FRANCE_TRAVAIL_TOKEN_URL =
  "https://authentification-partenaire.francetravail.io/connexion/oauth2/access_token?realm=/partenaire";

type Env = Record<string, string | undefined>;

export class FranceTravailAuthError extends Error {}

/** A fresh access token for one scope. Tokens are short-lived (~25 min); no caching across calls. */
export async function getFranceTravailToken(
  scope: string,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const clientId = env.FRANCE_TRAVAIL_CLIENT_ID || "";
  const clientSecret = env.FRANCE_TRAVAIL_CLIENT_SECRET || "";
  const tokenUrl = env.FRANCE_TRAVAIL_TOKEN_URL?.trim() || FRANCE_TRAVAIL_TOKEN_URL;
  const response = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
  });
  if (!response.ok)
    throw new FranceTravailAuthError(
      `Authentification France Travail refusée (${response.status}). Vérifie FRANCE_TRAVAIL_CLIENT_ID / _SECRET et que cette API est bien souscrite sur francetravail.io (scope « ${scope} »).`,
    );
  const { access_token: token } = (await response.json()) as { access_token?: string };
  if (!token) throw new FranceTravailAuthError("France Travail n'a pas renvoyé de jeton.");
  return token;
}

/** True once both the shared credentials and this API's scope/URL are set. */
export function franceTravailApiReady(scopeEnvVar: string, urlEnvVar: string, env: Env = process.env): boolean {
  return Boolean(env.FRANCE_TRAVAIL_CLIENT_ID?.trim() && env.FRANCE_TRAVAIL_CLIENT_SECRET?.trim() && env[scopeEnvVar]?.trim() && env[urlEnvVar]?.trim());
}

/**
 * These three APIs (Open Formation, Marché du travail, Accès à l'emploi des
 * demandeurs d'emploi) were only just subscribed on francetravail.io: their
 * exact response shape has not been confirmed against a live call yet. These
 * helpers read a field under any of several plausible names and keep the raw
 * payload too, so nothing is lost while the mapping gets refined.
 */
export function pickString(rec: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!rec) return null;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function pickNumber(rec: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!rec) return null;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

export function pickArray(body: unknown, keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    for (const k of keys) {
      const v = (body as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}
