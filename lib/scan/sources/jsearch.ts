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
 *
 * "/search" was renamed to "/search-v2" (confirmed Sept 2026 straight from
 * RapidAPI's own console: the sidebar still labels the endpoint "Job
 * Search", but the raw captured request line is
 * "GET https://jsearch.p.rapidapi.com/search-v2?...") — calling the old
 * "/search" path now gets a clean "Endpoint '/search' does not exist" from
 * RapidAPI's gateway itself, which is the exact 404 this was chasing.
 * OpenWeb Ninja (same underlying data) is switched by analogy, unconfirmed.
 */
const HOSTS = [
  {
    url: "https://jsearch.p.rapidapi.com/search-v2",
    headers: (key: string) => ({ "x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com" }),
  },
  {
    url: "https://api.openwebninja.com/jsearch/search-v2",
    headers: (key: string) => ({ "x-api-key": key }),
  },
];

/**
 * The API always explains a refusal in its body (e.g. "Invalid date posted
 * value. Date posted value should be 'anytime' (default), 'today', '3days',
 * 'week' or 'month'." — confirmed live, Sept 2026). Surfacing that text is
 * what turns a bare "HTTP 404" into something actually debuggable, instead
 * of having to reproduce the call from a screenshot every time.
 */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    const err = body.error as Record<string, unknown> | undefined;
    const message = (err?.mess ?? err?.message ?? body.message ?? body.mess) as string | undefined;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    // Not JSON: fall through to the raw text below.
  }
  try {
    const text = (await response.text()).trim();
    if (text) return text.slice(0, 300);
  } catch {
    // Body already consumed or unreadable.
  }
  return "";
}

/**
 * "/search-v2" wraps the jobs in an object (`data: { jobs: [...], cursor }`)
 * instead of the old "/search"'s bare array (`data: [...]`) — confirmed live
 * Sept 2026. Accepting both shapes means a future host or fallback that
 * still returns the old array form won't crash ("object is not iterable").
 */
function extractJobs(body: unknown): JSearchJob[] {
  const data = (body as { data?: unknown } | null | undefined)?.data;
  if (Array.isArray(data)) return data as JSearchJob[];
  const jobs = (data as { jobs?: unknown } | null | undefined)?.jobs;
  return Array.isArray(jobs) ? (jobs as JSearchJob[]) : [];
}

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
    // v5 (current, confirmed live Sept 2026 with a real 200 OK): "query" is
    // keywords only, the city goes in its own "location" param — packing
    // "<keywords> in <city>, France" into "query" is what caused our 404s.
    // No more "page" either — pagination is cursor-based (num_pages still
    // controls how many pages are fetched).
    const params = new URLSearchParams({
      query: query.keywords,
      location: config.city,
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
    if (!response || response.status === 401 || response.status === 403) {
      const detail = response ? await readErrorDetail(response) : "";
      throw new Error(
        `Clé JSearch refusée : vérifie la clé et que tu es bien abonné au plan Basic gratuit.${detail ? ` (${detail})` : ""}`,
      );
    }
    if (response.status === 429) {
      const detail = await readErrorDetail(response);
      throw new Error(`Quota JSearch atteint pour ce mois (plan gratuit).${detail ? ` (${detail})` : ""}`);
    }
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(`JSearch « ${query.keywords} » : HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
    }
    const body: unknown = await response.json();
    for (const raw of extractJobs(body)) {
      const mapped = mapJSearchOffer(raw);
      if (mapped) offers.push(mapped);
    }
  }
  return offers;
}
