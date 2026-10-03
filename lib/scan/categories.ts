import { searchWords } from "./words";

/**
 * The jobs the platform covers (decided scope: stage, alternance and CDD in
 * IT, digital and office jobs) and how an offer is put in them.
 *
 * - `romes`: ROME 4.0 codes (France Travail's MétierScope, Oct 2026). Used to
 *   harvest France Travail and to classify its offers. Refresh them when the
 *   ROME nomenclature changes (twice a year).
 * - `words`: phrases looked for in the title, after normalisation (accents,
 *   case, plurals, synonyms: see searchWords). An offer can be in several
 *   categories ("Chef de projet data" → projet + data).
 * - `search`: what is typed into keyword-based sources (Adzuna…).
 */

export type CategoryId =
  | "web"
  | "mobile"
  | "devops"
  | "systemes"
  | "data"
  | "cyber"
  | "qa"
  | "projet"
  | "design"
  | "marketing"
  | "bureautique";

export type Category = {
  id: CategoryId;
  label: string;
  examples: string;
  romes: string[];
  words: string[];
  /** Title words that rule the category out ("business developer" is sales). */
  not?: string[];
  search: string;
};

export const CATEGORIES: Category[] = [
  {
    id: "web",
    label: "Développement web et logiciel",
    examples: "Développeur front, back, full stack, Java, Python",
    romes: ["M1805", "M1855", "M1861", "M1836", "M1841", "M1848", "M1818", "M1813", "M1821", "M1831", "M1837", "M1877", "M1892"],
    words: [
      "developpeur", "developpement", "programmeur", "full stack", "front end", "back end", "integrateur web", "logiciel",
      "java", "python", "php", "javascript", "typescript", "react", "angular", "node", "symfony", "laravel",
      "golang", "ingenieur logiciel", "ingenieur etude", "concepteur developpeur", "analyste programmeur",
    ],
    not: ["business", "commercial", "affaire"],
    search: "développeur",
  },
  {
    id: "mobile",
    label: "Développement mobile",
    examples: "Développeur iOS, Android, Flutter",
    romes: [],
    words: ["mobile", "ios", "android", "flutter", "kotlin", "swift", "react native"],
    not: ["commercial", "vendeur", "conseiller"],
    search: "développeur mobile",
  },
  {
    id: "devops",
    label: "DevOps et cloud",
    examples: "DevOps, SRE, ingénieur cloud",
    romes: ["M1827", "M1860", "M1876", "M1879", "M1826"],
    words: ["devop", "sre", "cloud", "kubernete", "docker", "aws", "azure", "gcp", "platform engineer", "ingenieur plateforme", "ci cd"],
    search: "devops",
  },
  {
    id: "systemes",
    label: "Systèmes, réseaux et support",
    examples: "Technicien support, admin systèmes et réseaux, helpdesk",
    romes: [
      "M1801", "M1802", "M1804", "M1807", "M1810", "M1816", "M1829", "M1830", "M1839", "M1843", "M1847", "M1849",
      "M1869", "M1874", "M1884", "I1401", "I1404", "I1405", "I1406", "I1409",
    ],
    words: [
      "systeme", "reseau", "administrateur systeme", "admin sys", "technicien informatique", "technicien support",
      "support informatique", "helpdesk", "help desk", "service desk", "support utilisateur", "parc informatique",
      "telecom", "it support", "support technician", "infrastructure", "exploitation informatique", "technicien exploitation", "windows", "linux",
    ],
    search: "technicien informatique",
  },
  {
    id: "data",
    label: "Data et IA",
    examples: "Data analyst, data engineer, data scientist, IA",
    romes: ["M1811", "M1824", "M1851", "M1872", "M1894", "M1868", "M1889", "M1873", "M1419", "M1405", "M1423"],
    words: [
      "data", "donnee", "bi", "business intelligence", "decisionnel", "machine learning", "deep learning", "ml",
      "intelligence artificielle", "llm", "statisticien", "statistique", "analytic", "big data", "base de donnee",
    ],
    search: "data",
  },
  {
    id: "cyber",
    label: "Cybersécurité",
    examples: "Analyste SOC, pentester, technicien sécurité",
    romes: ["M1812", "M1817", "M1819", "M1833", "M1846", "M1856", "M1863", "M1866", "M1882", "M1883"],
    words: ["cybersecurite", "cyber", "soc", "pentest", "pentester", "rssi", "securite informatique", "securite si", "securite systeme"],
    search: "cybersécurité",
  },
  {
    id: "qa",
    label: "Test et qualité",
    examples: "Testeur, QA, automatisation des tests",
    romes: ["M1815", "M1820", "M1832", "M1842"],
    words: ["testeur", "test", "qa", "qualite logiciel", "recette", "homologation", "validation logiciel"],
    search: "testeur QA",
  },
  {
    id: "projet",
    label: "Projet, produit et conseil SI",
    examples: "Chef de projet digital, Product Owner, consultant AMOA",
    romes: [
      "M1803", "M1806", "M1814", "M1823", "M1825", "M1828", "M1838", "M1844", "M1853", "M1858", "M1859", "M1864",
      "M1867", "M1870", "M1871", "M1875", "M1881", "M1886",
    ],
    words: [
      "chef de projet", "product owner", "product manager", "product management", "website manager", "project manager", "scrum", "amoa", "moa", "pmo", "business analyst",
      "consultant si", "consultant fonctionnel", "erp", "sap", "salesforce", "projet digital", "projet informatique", "projet web",
    ],
    search: "chef de projet digital",
  },
  {
    id: "design",
    label: "Design numérique",
    examples: "UX/UI designer, webdesigner",
    romes: ["E1205", "E1206", "E1207", "E1210"],
    words: ["ux", "ui", "webdesign", "webdesigner", "web designer", "designer", "graphiste", "motion design", "figma"],
    search: "UX UI designer",
  },
  {
    id: "marketing",
    label: "Marketing digital",
    examples: "SEO, community manager, growth, webmarketing",
    romes: ["E1101", "E1124", "E1405", "E1406", "E1407", "M1716", "M1718", "M1719"],
    words: [
      "community manager", "seo", "sea", "marketing digital", "webmarketing", "web marketing", "growth", "social media",
      "reseaux sociaux", "traffic manager", "e commerce", "content manager", "acquisition", "emailing",
    ],
    search: "marketing digital",
  },
  {
    id: "bureautique",
    label: "Bureautique et assistanat",
    examples: "Assistant administratif, secrétariat, gestion administrative",
    romes: [
      "M1601", "M1602", "M1604", "M1605", "M1606", "M1607", "M1608", "M1611", "M1612", "M1613", "M1614", "M1620",
      "M1621", "M1501", "M1213",
    ],
    words: [
      "assistant administratif", "assistante administrative", "assistant administrative", "secretaire", "secretariat",
      "accueil", "standardiste", "saisie", "assistant direction", "assistant comptable", "assistant rh",
      "gestionnaire administratif", "gestion administrative", "office manager", "bureautique", "agent administratif",
    ],
    search: "assistant administratif",
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function category(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Every ROME code of the scope (France Travail harvest). */
export const SCOPE_ROMES = [...new Set(CATEGORIES.flatMap((c) => c.romes))];

/** ROME codes outside the "M18" IT domain (harvested by code). */
export const EXTRA_ROMES = SCOPE_ROMES.filter((r) => !r.startsWith("M18"));

const phraseIn = (title: string, phrase: string) => ` ${title} `.includes(` ${searchWords(phrase).join(" ")} `);

/** Categories of an offer: from its title first, its ROME code otherwise. */
export function categorize(offer: { title: string; romeCode?: string | null }): CategoryId[] {
  const title = searchWords(offer.title).join(" ");
  const found = CATEGORIES.filter(
    (c) => c.words.some((w) => phraseIn(title, w)) && !(c.not ?? []).some((w) => phraseIn(title, w)),
  ).map((c) => c.id);
  // Mobile developers are developers too, but not the other way round.
  if (found.includes("mobile") && !found.includes("web") && /developpeur|developpement/.test(title)) found.push("web");
  if (found.length) return [...new Set(found)];
  const byRome = offer.romeCode ? CATEGORIES.find((c) => c.romes.includes(offer.romeCode!)) : undefined;
  return byRome ? [byRome.id] : [];
}

export type ContractKind = "alternance" | "stage" | "cdd" | "cdi" | "autre";

/** Alternance wins over CDD (France Travail files apprenticeships as CDD). */
export function contractKind(offer: { title: string; contract_type?: string | null; source?: string | null }): ContractKind {
  const words = new Set(searchWords(`${offer.title} ${offer.contract_type ?? ""}`));
  if (words.has("alternance") || /^lba\b|labonnealternance/.test(offer.source ?? "")) return "alternance";
  if (words.has("stage")) return "stage";
  if (words.has("cdd") || /duree determinee/.test(searchWords(offer.contract_type ?? "").join(" "))) return "cdd";
  if (words.has("cdi") || /duree indeterminee/.test(searchWords(offer.contract_type ?? "").join(" "))) return "cdi";
  return "autre";
}

/** The contracts of the scope. */
export const SCOPE_CONTRACTS: ContractKind[] = ["alternance", "stage", "cdd"];
