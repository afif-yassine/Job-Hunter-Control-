import { categorize, CATEGORIES, type CategoryId } from "@/lib/scan/categories";

/**
 * A CV (PDF) read once and turned into the verified profile every CV and
 * letter is written from. Only what is written in the CV is kept: nothing is
 * guessed or completed. The person checks the result before it is saved.
 */

export type ImportedProfile = {
  identity: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    portfolio_url: string | null;
  };
  profile: {
    skills: Record<string, string[]>;
    languages: string[];
    education: { degree: string; institution: string; level: string | null; start: string | null; end: string | null }[];
    experience: { title: string; organization: string; start: string | null; end: string | null; facts: string[]; technologies: string[] }[];
    projects: { name: string; technologies: string[]; description: string | null }[];
  };
};

export const IMPORT_PROMPT = `Tu lis le CV joint (PDF). Extrais UNIQUEMENT ce qui y est écrit : n'invente, ne complète et ne reformule aucun fait, aucune date, aucun diplôme, aucune technologie. Une information absente vaut null (ou une liste vide).
Réponds par un seul objet JSON :
{"identity":{"full_name","email","phone","location","linkedin_url","github_url","portfolio_url"},
 "skills":{"<groupe>":["compétence",…]} (groupes courts en français, ex. "langages","frameworks","data","devops","outils","bureautique"),
 "languages":["Français (natif)",…],
 "education":[{"degree","institution","level","start","end"}],
 "experience":[{"title","organization","start","end","facts":["une réalisation par phrase, telle qu'écrite"],"technologies":[]}],
 "projects":[{"name","technologies":[],"description"}]}
Dates au format AAAA-MM ou AAAA quand c'est tout ce qui est écrit. Liens complets (https://…).`;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown, max = 300): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const list = (v: unknown, max = 40, len = 300): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => str(x, len)).filter((x): x is string => Boolean(x)))].slice(0, max) : [];
const url = (v: unknown): string | null => {
  const s = str(v, 300);
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
};
const email = (v: unknown): string | null => {
  const s = str(v, 200);
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
};

/** Whatever the model answered → a clean profile (unknown fields dropped, sizes capped). */
export function normalizeImported(raw: unknown): ImportedProfile {
  const root = obj(raw);
  const id = obj(root.identity);
  const skills: Record<string, string[]> = {};
  for (const [group, values] of Object.entries(obj(root.skills)).slice(0, 12)) {
    const items = list(values, 30, 80);
    const name = str(group, 40);
    if (name && items.length) skills[name] = items;
  }
  const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max).map(obj) : []);
  return {
    identity: {
      full_name: str(id.full_name, 120),
      email: email(id.email),
      phone: str(id.phone, 40),
      location: str(id.location, 120),
      linkedin_url: url(id.linkedin_url),
      github_url: url(id.github_url),
      portfolio_url: url(id.portfolio_url),
    },
    profile: {
      skills,
      languages: list(root.languages, 10, 60),
      education: arr(root.education, 8)
        .map((e) => ({ degree: str(e.degree, 200) ?? "", institution: str(e.institution, 200) ?? "", level: str(e.level, 60), start: str(e.start, 20), end: str(e.end, 20) }))
        .filter((e) => e.degree || e.institution),
      experience: arr(root.experience, 12)
        .map((e) => ({
          title: str(e.title, 200) ?? "",
          organization: str(e.organization, 200) ?? "",
          start: str(e.start, 20),
          end: str(e.end, 20),
          facts: list(e.facts, 12, 400),
          technologies: list(e.technologies, 30, 60),
        }))
        .filter((e) => e.title || e.organization),
      projects: arr(root.projects, 12)
        .map((p) => ({ name: str(p.name, 200) ?? "", technologies: list(p.technologies, 30, 60), description: str(p.description, 500) }))
        .filter((p) => p.name),
    },
  };
}

/** Is there enough to write CVs from? */
export function importProblems(p: ImportedProfile): string[] {
  const problems: string[] = [];
  if (!p.identity.full_name) problems.push("Nom introuvable dans le CV.");
  if (!p.profile.experience.length && !p.profile.education.length && !p.profile.projects.length)
    problems.push("Aucune expérience, formation ou projet lu : le PDF est peut-être une image scannée.");
  return problems;
}

/** Job categories that fit the CV (titles, projects, skills), most evident first. */
export function suggestCategories(p: ImportedProfile): CategoryId[] {
  const votes = new Map<CategoryId, number>();
  const texts = [
    ...p.profile.experience.map((e) => `${e.title} ${e.technologies.join(" ")}`),
    ...p.profile.projects.map((x) => `${x.name} ${x.technologies.join(" ")}`),
    ...p.profile.education.map((e) => e.degree),
    ...Object.entries(p.profile.skills).map(([g, v]) => `${g} ${v.join(" ")}`),
  ];
  for (const t of texts) for (const c of categorize({ title: t })) votes.set(c, (votes.get(c) ?? 0) + 1);
  return CATEGORIES.map((c) => c.id)
    .filter((id) => votes.has(id))
    .sort((a, b) => (votes.get(b) ?? 0) - (votes.get(a) ?? 0))
    .slice(0, 4);
}

export const DEFAULT_LEDGER = {
  rule: "Ne jamais inventer une technologie ou une expérience ; utiliser une compétence voisine ou signaler l'écart.",
  automatic: ["Identité et contacts", "Formation", "Expériences et réalisations écrites dans le CV", "Projets", "Compétences", "Langues"],
  must_confirm: ["Données légales, autorisation de travail, salaire, handicap, permis"],
  excluded: [],
};
