export type SearchQuery = {
  keywords: string;
};

export type ScanConfig = {
  queries: SearchQuery[];
  /** French département codes (France Travail accepts up to 5). */
  departments: string[];
  maxAgeDays: number;
};

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
  maxAgeDays: 14,
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
      maxAgeDays: parsed.maxAgeDays || DEFAULT_CONFIG.maxAgeDays,
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
  const head = `${offer.title} ${offer.contract_type ?? ""}`;
  if (SENIOR.test(offer.title) && !CONTRACT.test(head)) return false;
  const contractOk =
    CONTRACT.test(head) || CONTRACT.test((offer.description ?? "").slice(0, 600));
  const techOk = TECH.test(offer.title) || TECH.test((offer.description ?? "").slice(0, 600));
  return contractOk && techOk;
}
