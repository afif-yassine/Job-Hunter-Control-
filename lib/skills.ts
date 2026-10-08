/**
 * Skills in one comparable form, for the offers (read once by the shared
 * reader) and for the CV: "React.js", "react" and "ReactJS" are the same
 * skill; "Gestion de projet" and "gestion de projets" too.
 */

const ALIASES: Record<string, string> = {
  reactjs: "react",
  "react js": "react",
  nodejs: "node",
  "node js": "node",
  vuejs: "vue",
  "vue js": "vue",
  nextjs: "next",
  "next js": "next",
  js: "javascript",
  ts: "typescript",
  postgres: "postgresql",
  "ms excel": "excel",
  "microsoft excel": "excel",
  "pack office": "office",
  "microsoft office": "office",
  "suite office": "office",
  k8s: "kubernetes",
  "c sharp": "c#",
  csharp: "c#",
  "power bi": "powerbi",
  "google cloud": "gcp",
  "amazon web services": "aws",
  anglais: "anglais",
  english: "anglais",
  // Safe equivalences only: wider ones would inflate the free comparison.
  ml: "machine learning",
  "apprentissage automatique": "machine learning",
  "apprentissage profond": "deep learning",
  dl: "deep learning",
  genai: "ia generative",
  "generative ai": "ia generative",
  "intelligence artificielle": "ia",
  torch: "pytorch",
};

/**
 * Names whose final number is part of their identity: "ISO 27001" is not "ISO 9001", "Bac 5" is
 * not "Bac 2", "Industrie 4.0" is not "Industrie". Standards, levels, diplomas. A short list on
 * purpose: "Excel 2019" and "Windows Server 2019" still match their plain name on both sides.
 */
const NUMBER_IS_IDENTITY = new Set([
  "industrie", "industry", "web", "office", "microsoft",
  "iso", "iec", "en", "nf", "do", "as", "ieee", "rfc", "pci dss", "owasp top", "cmmi",
  "bac", "niveau", "level", "n", "rgpd article", "article",
]);

/** "java 17/21" → "java": only a purely numeric tail (digits, dots, slashes), after a separate word. */
function withoutVersion(s: string): string {
  const m = /^(.*\S)\s+v?\d+(?:[./,-]\d+)*\+?$/.exec(s);
  if (!m) return s;
  const lastWord = m[1].split(/[\s/-]+/).pop() ?? "";
  if (NUMBER_IS_IDENTITY.has(m[1]) || NUMBER_IS_IDENTITY.has(lastWord)) return s;
  return m[1];
}

/** "  React.JS " → "react"; "Java 17/21" → "java"; "" for nothing usable. */
export function normalizeSkill(raw: string): string {
  let s = withoutVersion(
    raw
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  s = s
    .replace(/\.js\b/g, "js")
    .replace(/[^a-z0-9+#/ -]+/g, " ")
    .replace(/[-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/ projets$/, " projet").replace(/^outils /, "outil ");
  return ALIASES[s] ?? ALIASES[s.replace(/ /g, "")] ?? s;
}

/**
 * Personal qualities (and the apprenticeship itself) that offers list among
 * their "skills". They say nothing about what a CV proves, so the free
 * comparison ignores them. Technical terms, even rare ones, are kept.
 */
const GENERIC_QUALITIES = new Set(
  [
    "autonomie",
    "curiosite",
    "ecoute",
    "rigueur",
    "motivation",
    "dynamisme",
    "esprit d'equipe",
    "communication",
    "adaptabilite",
    "organisation",
    "resolution de problemes",
    "resolution de probleme",
    "apprentissage",
  ].map(quality => normalizeSkill(quality)),
);

export const isGenericQuality = (skill: string): boolean => GENERIC_QUALITIES.has(normalizeSkill(skill));

/** Unique normalized skills, at most `max`, in their first order. */
export function normalizeSkills(list: unknown, max = 40): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const s = normalizeSkill(item);
    if (s && s.length <= 40 && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

type Profile = Record<string, unknown>;

/** Every skill a CV proves: listed skills, technologies of experiences and projects. */
export function profileSkills(profile: Profile | null | undefined, max = 120): string[] {
  if (!profile) return [];
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const raw: unknown[] = [];
  const skills = profile.skills;
  if (Array.isArray(skills)) raw.push(...skills);
  else if (skills && typeof skills === "object") for (const v of Object.values(skills as Record<string, unknown>)) if (Array.isArray(v)) raw.push(...v);
  for (const e of arr(profile.experience)) if (Array.isArray(e.technologies)) raw.push(...e.technologies);
  for (const p of arr(profile.projects)) if (Array.isArray(p.technologies)) raw.push(...p.technologies);
  for (const l of arr(profile.languages)) if (typeof l.language === "string") raw.push(l.language);
  return normalizeSkills(raw, max);
}
