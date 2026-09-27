import type { ScanConfig } from "../config";
import { clip } from "../text";
import type { ScannedOffer } from "../types";

/**
 * Careers pages hosted on a recruitment platform (ATS) publish their offers as
 * public JSON, meant to be read by job boards. Reading it is legitimate, needs
 * no key, and often shows offers before they reach LinkedIn or Indeed.
 */

export type AtsId = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable";
export type AtsTarget = { ats: AtsId; slug: string };

export const ATS_LABEL: Record<AtsId, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
};

const SLUG = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

/**
 * A careers page URL (or "greenhouse:doctolib") → where to read its offers.
 * Returns null for anything else.
 */
export function parseAtsTarget(raw: string): AtsTarget | null {
  const text = raw.trim();
  const short = text.match(/^(greenhouse|lever|ashby|smartrecruiters|workable):([^/\s]+)$/i);
  if (short) return SLUG.test(short[2]) ? { ats: short[1].toLowerCase() as AtsId, slug: short[2].toLowerCase() } : null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
  const pick = (ats: AtsId, slug: string) => (SLUG.test(slug) ? { ats, slug: slug.toLowerCase() } : null);
  if (/^(job-boards|boards)(\.eu)?\.greenhouse\.io$/.test(host)) return pick("greenhouse", first);
  if (/^jobs(\.eu)?\.lever\.co$/.test(host)) return pick("lever", first);
  if (host === "jobs.ashbyhq.com") return pick("ashby", first);
  if (/^(careers|jobs)\.smartrecruiters\.com$/.test(host)) return pick("smartrecruiters", first);
  if (host === "apply.workable.com") return pick("workable", first);
  const sub = host.match(/^([a-z0-9-]+)\.workable\.com$/);
  if (sub && sub[1] !== "apply" && sub[1] !== "www") return pick("workable", sub[1]);
  return null;
}

export const targetKey = (t: AtsTarget) => `${t.ats}:${t.slug}`;

const pretty = (slug: string) =>
  slug
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** Greenhouse escapes its HTML (&lt;p&gt;): unescape before removing tags. */
function unescapeHtml(text: string | null | undefined): string {
  return (text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&");
}

const FRENCH_PLACES =
  /(france|paris|[iî]le[- ]de[- ]france|lyon|marseille|toulouse|lille|bordeaux|nantes|nice|rennes|strasbourg|montpellier|grenoble|sophia|la d[ée]fense|boulogne|issy|levallois|saint[- ]denis|nanterre|massy|v[ée]lizy|remote|t[ée]l[ée]travail|hybrid|anywhere)/i;

/** Keep offers in France (or remote); company boards list every country. */
export function inFrance(location: string | null, config: Pick<ScanConfig, "city">): boolean {
  if (!location) return true;
  if (FRENCH_PLACES.test(location)) return true;
  return Boolean(config.city) && location.toLowerCase().includes(config.city.toLowerCase());
}

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});

function date(value: unknown): string | null {
  if (typeof value === "number") return new Date(value).toISOString();
  const s = str(value);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function mapAtsJobs(target: AtsTarget, body: unknown): ScannedOffer[] {
  const source = `ats:${target.ats}`;
  const fallback = pretty(target.slug);
  const out: ScannedOffer[] = [];
  const push = (o: Omit<ScannedOffer, "source"> | null) => {
    if (o && o.title && o.url) out.push({ source, ...o });
  };
  const root = obj(body);

  if (target.ats === "greenhouse")
    for (const raw of (root.jobs as unknown[]) ?? []) {
      const j = obj(raw);
      push({
        company: str(j.company_name) ?? fallback,
        title: str(j.title) ?? "",
        location: str(obj(j.location).name),
        contract_type: null,
        description: clip(unescapeHtml(str(j.content))),
        url: str(j.absolute_url) ?? "",
        publishedAt: date(j.first_published ?? j.updated_at),
      });
    }

  if (target.ats === "lever")
    for (const raw of (Array.isArray(body) ? body : []) as unknown[]) {
      const j = obj(raw);
      const cat = obj(j.categories);
      const lists = ((j.lists as unknown[]) ?? [])
        .map((l) => `${str(obj(l).text) ?? ""}\n${str(obj(l).content) ?? ""}`)
        .join("\n");
      push({
        company: fallback,
        title: str(j.text) ?? "",
        location: str(cat.location),
        contract_type: str(cat.commitment),
        description: clip(`${str(j.descriptionPlain) ?? str(j.description) ?? ""}\n${lists}\n${str(j.additionalPlain) ?? ""}`),
        url: str(j.hostedUrl) ?? "",
        applyUrl: str(j.applyUrl),
        publishedAt: date(j.createdAt),
      });
    }

  if (target.ats === "ashby")
    for (const raw of (root.jobs as unknown[]) ?? []) {
      const j = obj(raw);
      if (j.isListed === false) continue;
      push({
        company: fallback,
        title: str(j.title) ?? "",
        location: str(j.location),
        contract_type: str(j.employmentType),
        description: clip(str(j.descriptionPlain) ?? str(j.descriptionHtml)),
        url: str(j.jobUrl) ?? "",
        applyUrl: str(j.applyUrl),
        publishedAt: date(j.publishedAt),
      });
    }

  if (target.ats === "smartrecruiters")
    for (const raw of (root.content as unknown[]) ?? []) {
      const j = obj(raw);
      const loc = obj(j.location);
      const id = str(j.id);
      push({
        company: str(obj(j.company).name) ?? fallback,
        title: str(j.name) ?? "",
        location: [str(loc.city), str(loc.country)?.toUpperCase() === "FR" ? "France" : str(loc.country)]
          .filter(Boolean)
          .join(", ") || null,
        contract_type: str(obj(j.typeOfEmployment).label),
        // The list has no text: the full page is read before scoring.
        description: null,
        url: id ? `https://jobs.smartrecruiters.com/${target.slug}/${id}` : "",
        publishedAt: date(j.releasedDate),
      });
    }

  if (target.ats === "workable")
    for (const raw of (root.jobs as unknown[]) ?? []) {
      const j = obj(raw);
      push({
        company: str(root.name) ?? fallback,
        title: str(j.title) ?? "",
        location: [str(j.city), str(j.country)].filter(Boolean).join(", ") || (j.telecommuting ? "Remote" : null),
        contract_type: str(j.employment_type),
        description: clip(str(j.description)),
        url: str(j.url) ?? str(j.shortlink) ?? "",
        applyUrl: str(j.application_url),
        publishedAt: date(j.published_on ?? j.created_at),
      });
    }

  return out;
}

export function atsEndpoint(t: AtsTarget): string {
  const s = encodeURIComponent(t.slug);
  switch (t.ats) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`;
    case "lever":
      return `https://api.lever.co/v0/postings/${s}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${s}?includeCompensation=false`;
    case "smartrecruiters":
      return `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=100`;
    case "workable":
      return `https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`;
  }
}

export type AtsScan = { offers: ScannedOffer[]; errors: string[] };

/** Reads every target (5 at a time); one broken page never stops the others. */
export async function scanAts(
  targets: AtsTarget[],
  config: Pick<ScanConfig, "city" | "maxAgeDays">,
  fetchImpl: typeof fetch = fetch,
): Promise<AtsScan> {
  const offers: ScannedOffer[] = [];
  const errors: string[] = [];
  const cutoff = Date.now() - Math.max(config.maxAgeDays, 30) * 86_400_000;
  let next = 0;
  const lane = async () => {
    while (next < targets.length) {
      const t = targets[next++];
      const name = `${ATS_LABEL[t.ats]} ${t.slug}`;
      try {
        const response = await fetchImpl(atsEndpoint(t), {
          headers: { accept: "application/json", "user-agent": "JobHunterControl/1.0 (personal job assistant)" },
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status === 404) {
          errors.push(`${name} : page carrière introuvable (vérifie le lien)`);
          continue;
        }
        if (!response.ok) {
          errors.push(`${name} : HTTP ${response.status}`);
          continue;
        }
        for (const offer of mapAtsJobs(t, await response.json())) {
          // Company boards keep old offers online: drop the stale ones.
          if (offer.publishedAt && Date.parse(offer.publishedAt) < cutoff) continue;
          if (inFrance(offer.location, config)) offers.push(offer);
        }
      } catch (error) {
        errors.push(`${name} : ${error instanceof Error ? error.message : "erreur"}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, targets.length) }, lane));
  return { offers, errors };
}
