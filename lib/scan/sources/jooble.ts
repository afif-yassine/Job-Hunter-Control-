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

export async function scanJooble(
  config: ScanConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ScannedOffer[]> {
  const offers: ScannedOffer[] = [];
  const cutoff = Date.now() - config.maxAgeDays * 86_400_000;
  for (const query of config.queries) {
    const response = await fetchImpl(`https://jooble.org/api/${encodeURIComponent(env.JOOBLE_API_KEY || "")}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keywords: query.keywords, location: config.city, radius: "40", page: "1" }),
    });
    if (response.status === 401 || response.status === 403)
      throw new Error("Clé Jooble refusée : vérifie la clé reçue par e-mail.");
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
