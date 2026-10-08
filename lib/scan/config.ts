import { CATEGORY_IDS, SCOPE_CONTRACTS, categorize, category, contractKind } from "./categories";
import { parseAtsTarget, targetKey, type AtsTarget } from "./sources/ats";
import { storedSearches, type SavedSearch } from "../saved-searches";

export type SearchQuery = {
  keywords: string;
  /** Set when the query comes from a ticked category (the platform harvests those). */
  category?: string;
  /** Contract of a category query (alternance, stage, cdd). */
  contract?: string;
};

export type ScanConfig = {
  queries: SearchQuery[];
  /** French département codes (France Travail accepts up to 5). */
  departments: string[];
  /** Town used by the aggregator APIs (Adzuna, Jooble, JSearch). */
  city: string;
  maxAgeDays: number;
  /** Company careers pages read directly (Greenhouse, Lever, Ashby…). */
  targets: AtsTarget[];
  /** Job categories ticked by the account (lib/scan/categories.ts). */
  categories?: string[];
  /** Contracts wanted: alternance, stage, cdd. */
  contracts?: string[];
};

/** What the user edits in Réglages > Recherche. */
export type ScanPrefs = {
  savedSearches?: SavedSearch[];
  contracts: string[];
  /** Job categories ticked instead of (or on top of) typed keywords. */
  categories: string[];
  keywords: string[];
  city: string;
  departments: string[];
  maxAgeDays: number;
  /** "greenhouse:doctolib", "lever:mistral"… (see parseAtsTarget). */
  targets: string[];
};

/**
 * A new account searches nothing until it has chosen its jobs (or its CV
 * import proposed them): no keywords, city or area are assumed for it.
 */
export const DEFAULT_PREFS: ScanPrefs = {
  contracts: ["alternance", "stage"],
  categories: [],
  keywords: [],
  city: "",
  departments: [],
  maxAgeDays: 14,
  targets: [],
};

/** At least one job category, keyword or company was chosen: otherwise nothing is searched. */
export const hasChosenSearch = (prefs: Pick<ScanPrefs, "categories" | "keywords" | "targets">): boolean =>
  Boolean(prefs.categories?.length || prefs.keywords.length || prefs.targets.length);

/**
 * Whether a student's update reads the shared catalogue only (no job-site API at all).
 * Off by default: it is the owner's decision, taken once the platform's own collection is proven to run.
 */
export const studentCatalogueOnly = (env: Record<string, string | undefined> = process.env): boolean => env.STUDENT_CATALOGUE_ONLY?.trim() === "1";

export const NO_SEARCH_MESSAGE = "Choisis tes métiers pour lancer la recherche.";

export const MAX_TARGETS = 30;

const list = (value: unknown, max: number) =>
  Array.isArray(value)
    ? [...new Set(value.map((v) => String(v).trim()).filter(Boolean))].slice(0, max)
    : [];

/** Any stored value → valid preferences (missing fields fall back to defaults). */
export function normalizePrefs(value: unknown): ScanPrefs {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const days = Number(v.maxAgeDays);
  const departments = list(v.departments, 5)
    .map((d) => d.replace(/\D/g, ""))
    .filter(Boolean)
    .map((d) => d.padStart(2, "0"))
    .filter((d) => d.length <= 3 && d !== "00");
  return {
    ...(Array.isArray(v.savedSearches) ? { savedSearches: storedSearches(v.savedSearches) } : {}),
    contracts: list(v.contracts, 4).filter((c) => SCOPE_CONTRACTS.includes(c as never)).length
      ? list(v.contracts, 4).filter((c) => SCOPE_CONTRACTS.includes(c as never))
      : DEFAULT_PREFS.contracts,
    categories: list(v.categories, CATEGORY_IDS.length).filter((c) => CATEGORY_IDS.includes(c as never)),
    // With categories ticked, typed keywords are optional.
    keywords: list(v.keywords, 8).length
      ? list(v.keywords, 8)
      : list(v.categories, 1).length
        ? []
        : DEFAULT_PREFS.keywords,
    city: typeof v.city === "string" && v.city.trim() ? v.city.trim().slice(0, 60) : DEFAULT_PREFS.city,
    departments: departments.length ? departments : DEFAULT_PREFS.departments,
    maxAgeDays: Number.isFinite(days) && days >= 1 && days <= 60 ? Math.round(days) : DEFAULT_PREFS.maxAgeDays,
    targets: [
      ...new Set(
        list(v.targets, 100)
          .map(parseAtsTarget)
          .filter((t): t is AtsTarget => Boolean(t))
          .map(targetKey),
      ),
    ].slice(0, MAX_TARGETS),
  };
}

/** contracts × keywords → search queries (capped to keep API quotas safe). */
export function configFromPrefs(prefs: ScanPrefs, maxQueries = 10): ScanConfig {
  const queries: SearchQuery[] = [];
  // Ticked categories first: the same words for everybody → shared cache.
  for (const id of prefs.categories ?? [])
    for (const contract of prefs.contracts) {
      const c = category(id);
      if (c && queries.length < maxQueries) queries.push({ keywords: `${contract} ${c.search}`, category: c.id, contract });
    }
  for (const keyword of prefs.keywords)
    for (const contract of prefs.contracts)
      if (queries.length < maxQueries) queries.push({ keywords: `${contract} ${keyword}` });
  return {
    queries,
    departments: prefs.departments.slice(0, 5),
    city: prefs.city,
    maxAgeDays: prefs.maxAgeDays,
    targets: prefs.targets.map(parseAtsTarget).filter((t): t is AtsTarget => Boolean(t)),
    categories: prefs.categories ?? [],
    contracts: prefs.contracts,
  };
}

/**
 * Default search: alternance / stage in tech + AI around Paris.
 * Override with the SCAN_CONFIG environment variable (JSON), for example:
 * {"queries":[{"keywords":"alternance data"}],"departments":["75","92"],"maxAgeDays":10}
 */
export const DEFAULT_CONFIG: ScanConfig = {
  queries: [
    { keywords: "alternance développeur" },
    { keywords: "alternance intelligence artificielle" },
    { keywords: "alternance data" },
    { keywords: "stage développeur" },
    { keywords: "stage intelligence artificielle" },
    { keywords: "stage machine learning" },
  ],
  departments: ["75", "92", "93", "94", "91"],
  city: "Paris",
  maxAgeDays: 14,
  targets: [],
};

export function loadScanConfig(env: Record<string, string | undefined> = process.env): ScanConfig {
  const raw = env.SCAN_CONFIG?.trim();
  if (!raw) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<ScanConfig>;
    return {
      queries: parsed.queries?.length ? parsed.queries : DEFAULT_CONFIG.queries,
      departments: (parsed.departments?.length
        ? parsed.departments
        : DEFAULT_CONFIG.departments
      ).slice(0, 5),
      city: parsed.city || DEFAULT_CONFIG.city,
      maxAgeDays: parsed.maxAgeDays || DEFAULT_CONFIG.maxAgeDays,
      targets: [],
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

const TECH =
  /(d[ée]velopp|software|logiciel|data|\bia\b|intelligence artificielle|machine learning|\bml\b|python|full ?stack|back ?end|front ?end|web|informatique|ing[ée]nieur|devops|cloud|cyber|r[ée]seau|nlp|llm)/i;
const CONTRACT = /(alternan|apprenti|professionnalisation|stage|stagiaire|intern(ship)?\b)/i;
const SENIOR = /(senior|s[ée]nior|\blead\b|directeur|manager|responsable|head of|principal)/i;

/** Cheap relevance pre-filter so Gemini only scores plausible offers. */
export function isRelevant(offer: {
  title: string;
  contract_type?: string | null;
  description?: string | null;
}): boolean {
  // Scope: stage, alternance or CDD, in IT, digital or office jobs.
  const kind = contractKind(offer);
  const inScopeContract = SCOPE_CONTRACTS.includes(kind);
  if (SENIOR.test(offer.title) && !inScopeContract) return false;
  const start = (offer.description ?? "").slice(0, 600);
  const contractOk = inScopeContract || (kind === "autre" && CONTRACT.test(start));
  const jobOk = TECH.test(offer.title) || categorize(offer).length > 0 || TECH.test(start);
  return contractOk && jobOk;
}
