import type { ScanConfig } from "../config";
import type { ScannedOffer } from "../types";
import { clip } from "../text";

type JSearchJob = {
  job_id?: string;
  employer_name?: string;
  job_title?: string;
  job_description?: string;
  job_apply_link?: string;
  job_google_link?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_employment_type?: string;
  job_employment_types?: string[];
  job_posted_at_datetime_utc?: string;
  job_publisher?: string;
};

const CONTRACT: Record<string, string> = {
  FULLTIME: "Temps plein",
  PARTTIME: "Temps partiel",
  INTERN: "Stage",
  CONTRACTOR: "Freelance",
};

export function mapJSearchOffer(j: JSearchJob): ScannedOffer | null {
  const url = j.job_apply_link || j.job_google_link;
  if (!j.job_title || !url) return null;
  const types = j.job_employment_types?.length ? j.job_employment_types : [j.job_employment_type];
  const publisher = (j.job_publisher || "web").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return {
    source: `jsearch:${publisher}`,
    company: j.employer_name?.trim() || "Entreprise non communiquée",
    title: clip(j.job_title, 200) || j.job_title,
    location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || null,
    contract_type:
      types
        .filter((t): t is string => Boolean(t))
        .map((t) => CONTRACT[t] || t)
        .join(" · ") || null,
    description: clip(j.job_description),
    url,
    applyUrl: j.job_apply_link || null,
    publishedAt: j.job_posted_at_datetime_utc || null,
  };
}

/**
 * The key can come from RapidAPI (x-rapidapi-key) or from OpenWeb Ninja
 * (x-api-key): the first host that accepts it is used.
 */
const HOSTS = [
  {
    url: "https://jsearch.p.rapidapi.com/search",
    headers: (key: string) => ({ "x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com" }),
  },
  {
    url: "https://api.openwebninja.com/jsearch/search",
    headers: (key: string) => ({ "x-api-key": key }),
  },
];

export async function scanJSearch(
  config: ScanConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<ScannedOffer[]> {
  const key = env.JSEARCH_API_KEY || "";
  const offers: ScannedOffer[] = [];
  // The free plan is ~200 requests / month: one page for the first 3 queries.
  const queries = config.queries.slice(0, 3);
  const datePosted = config.maxAgeDays <= 3 ? "3days" : config.maxAgeDays <= 7 ? "week" : "month";
  let host = 0;
  for (const query of queries) {
    const params = new URLSearchParams({
      query: `${query.keywords} in ${config.city}, France`,
      page: "1",
      num_pages: "1",
      country: "fr",
      language: "fr",
      date_posted: datePosted,
    });
    let response: Response | null = null;
    for (; host < HOSTS.length; host += 1) {
      response = await fetchImpl(`${HOSTS[host].url}?${params}`, {
        headers: { accept: "application/json", ...HOSTS[host].headers(key) },
      });
      if (response.status !== 401 && response.status !== 403) break;
    }
    if (!response || response.status === 401 || response.status === 403)
      throw new Error(
        "Clé JSearch refusée : vérifie la clé et que tu es bien abonné au plan Basic gratuit.",
      );
    if (response.status === 429)
      throw new Error("Quota JSearch atteint pour ce mois (plan gratuit).");
    if (!response.ok) throw new Error(`JSearch « ${query.keywords} » : HTTP ${response.status}`);
    const body = (await response.json()) as { data?: JSearchJob[] };
    for (const raw of body.data ?? []) {
      const mapped = mapJSearchOffer(raw);
      if (mapped) offers.push(mapped);
    }
  }
  return offers;
}
