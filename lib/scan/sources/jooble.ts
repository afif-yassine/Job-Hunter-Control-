import type { ScanConfig } from "../config";
import type { ScannedOffer } from "../types";
import { clip } from "../text";

type JoobleJob = {
  id?: string | number;
  title?: string;
  location?: string;
  snippet?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
};

export function mapJoobleOffer(j: JoobleJob): ScannedOffer | null {
  if (!j.title || !j.link) return null;
  return {
    source: "jooble",
    company: j.company?.trim() || "Entreprise non communiquée",
    title: clip(j.title, 200) || j.title,
    location: j.location?.trim() || null,
    contract_type: j.type?.trim() || null,
    description: clip(j.snippet),
    url: j.link,
    publishedAt: j.updated || null,
  };
}

/**
 * "Each Jooble domain (country) requires its own unique REST API key"
 * (help.jooble.org, REST API documentation, checked Sept 2026): a key made on
 * fr.jooble.org is refused (403) by jooble.org, which is the US site. French
 * site first, then the international one for keys registered there; a
 * JOOBLE_HOST variable forces one.
 */
function joobleHosts(env: Record<string, string | undefined>): string[] {
  const forced = env.JOOBLE_HOST?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return forced ? [forced] : ["fr.jooble.org", "jooble.org"];
}

export async function scanJooble(
  config: ScanConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ScannedOffer[]> {
  const offers: ScannedOffer[] = [];
  const cutoff = Date.now() - config.maxAgeDays * 86_400_000;
  const key = encodeURIComponent(env.JOOBLE_API_KEY?.trim() || "");
  const hosts = joobleHosts(env);
  let host = 0;
  for (const query of config.queries) {
    let response: Response | null = null;
    // Once a host accepts the key, the next queries go straight to it.
    for (; host < hosts.length; host += 1) {
      response = await fetchImpl(`https://${hosts[host]}/api/${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keywords: query.keywords, location: config.city, radius: "40", page: 1 }),
      });
      if (response.status !== 401 && response.status !== 403) break;
    }
    if (!response || response.status === 401 || response.status === 403)
      throw new Error(
        `Clé Jooble refusée par ${hosts.join(" et ")} : vérifie que c’est bien la clé reçue par e-mail (sans les guillemets).`,
      );
    if (!response.ok) throw new Error(`Jooble « ${query.keywords} » : HTTP ${response.status}`);
    const body = (await response.json()) as { jobs?: JoobleJob[] };
    for (const raw of body.jobs ?? []) {
      const mapped = mapJoobleOffer(raw);
      if (!mapped) continue;
      const t = mapped.publishedAt ? Date.parse(mapped.publishedAt) : NaN;
      if (!Number.isNaN(t) && t < cutoff) continue;
      offers.push(mapped);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return offers;
}
