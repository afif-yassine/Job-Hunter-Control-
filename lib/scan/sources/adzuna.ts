import type { ScanConfig } from "../config";
import type { ScannedOffer } from "../types";
import { clip } from "../text";

type AdzunaResult = {
  id?: string | number;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  contract_type?: string;
  contract_time?: string;
};

export function mapAdzunaOffer(r: AdzunaResult): ScannedOffer | null {
  if (!r.title || !r.redirect_url) return null;
  return {
    source: "adzuna",
    company: r.company?.display_name?.trim() || "Entreprise non communiquée",
    title: clip(r.title, 200) || r.title,
    location: r.location?.display_name?.trim() || null,
    contract_type: [r.contract_time, r.contract_type].filter(Boolean).join(" · ") || null,
    // Adzuna only returns a short extract: the pipeline completes it from the ad page.
    description: clip(r.description),
    url: r.redirect_url,
    publishedAt: r.created || null,
  };
}

export async function scanAdzuna(
  config: ScanConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ScannedOffer[]> {
  const offers: ScannedOffer[] = [];
  for (const query of config.queries) {
    const params = new URLSearchParams({
      app_id: env.ADZUNA_APP_ID || "",
      app_key: env.ADZUNA_APP_KEY || "",
      what: query.keywords,
      where: config.city,
      distance: "30",
      results_per_page: "50",
      max_days_old: String(config.maxAgeDays),
      sort_by: "date",
      "content-type": "application/json",
    });
    const response = await fetchImpl(`https://api.adzuna.com/v1/api/jobs/fr/search/1?${params}`, {
      headers: { accept: "application/json" },
    });
    if (response.status === 401 || response.status === 403)
      throw new Error("Clés Adzuna refusées : vérifie l’Application ID et l’Application Key.");
    if (!response.ok) throw new Error(`Adzuna « ${query.keywords} » : HTTP ${response.status}`);
    const body = (await response.json()) as { results?: AdzunaResult[] };
    for (const raw of body.results ?? []) {
      const mapped = mapAdzunaOffer(raw);
      if (mapped) offers.push(mapped);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return offers;
}
