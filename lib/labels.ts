/** French labels and tones for the statuses stored in the database. */
export type Tone = "neutral" | "info" | "good" | "warn" | "bad";

const JOB: Record<string, { label: string; tone: Tone }> = {
  DISCOVERED: { label: "À analyser", tone: "info" },
  ANALYZED: { label: "Analysée", tone: "neutral" },
  WAITING_APPROVAL: { label: "Documents prêts", tone: "good" },
  PREPARED: { label: "Préparée", tone: "good" },
  SUBMITTED: { label: "Déjà postulée", tone: "good" },
  CONFIRMED: { label: "Candidature confirmée", tone: "good" },
  INTERVIEW: { label: "Entretien", tone: "good" },
  SKIPPED: { label: "Écartée", tone: "neutral" },
  REJECTED: { label: "Refusée", tone: "bad" },
};

/** Why an offer waits in "À vérifier". */
export const REVIEW: Record<string, { label: string; tone: Tone }> = {
  SUSPECTED: { label: "Offre suspecte", tone: "bad" },
  PROBABLE_DUPLICATE: { label: "Doublon probable", tone: "warn" },
  ALREADY_APPLIED: { label: "Déjà postulé ?", tone: "warn" },
};

const APPLICATION: Record<string, { label: string; tone: Tone }> = {
  WAITING_APPROVAL: { label: "À valider", tone: "warn" },
  PREPARED: { label: "Formulaire prêt", tone: "good" },
  PAUSED: { label: "En pause", tone: "warn" },
  SUBMITTED: { label: "Envoyée", tone: "good" },
  REJECTED: { label: "Écartée", tone: "bad" },
};

const RUN: Record<string, { label: string; tone: Tone }> = {
  COMPLETED: { label: "Terminé", tone: "good" },
  CANCELLED: { label: "Arrêté", tone: "neutral" },
  QUEUED: { label: "En attente", tone: "info" },
  RUNNING: { label: "En cours", tone: "info" },
  PAUSED: { label: "En pause", tone: "warn" },
  FAILED: { label: "Échec", tone: "bad" },
};

export const RUN_TYPES: Record<string, string> = {
  PIPELINE: "Recherche complète",
  OFFER_SCAN: "Recherche d’offres",
  PLAYWRIGHT_PREPARE: "Préparation d’une candidature",
  PLAYWRIGHT_INSPECT: "Inspection d’un formulaire",
};

const fallback = (raw: string) => ({ label: raw.replace(/_/g, " ").toLowerCase(), tone: "neutral" as Tone });

export const jobStatus = (s: string) => JOB[s] ?? fallback(s);
export const applicationStatus = (s: string) => APPLICATION[s] ?? fallback(s);
export const runStatus = (s: string) => RUN[s] ?? fallback(s);
export const runType = (s: string) => RUN_TYPES[s] ?? s.replace(/_/g, " ").toLowerCase();

export const DOCUMENT_KIND: Record<string, string> = {
  TAILORED_CV: "CV",
  COVER_LETTER: "Lettre de motivation",
};

/** "il y a 12 min" style label. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "jamais";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "à l’instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(t).toLocaleDateString("fr-FR");
}

/** Site name shown on an offer card. */
export function sourceLabel(platform: string | null | undefined, url: string | null | undefined): string {
  const raw = (platform || "").toLowerCase();
  if (raw === "manual") return "Ajoutée à la main";
  const known: [RegExp, string][] = [
    [/linkedin/, "LinkedIn"],
    [/indeed/, "Indeed"],
    [/wttj|welcome/, "Welcome to the Jungle"],
    [/hellowork/, "Hellowork"],
    [/apec/, "APEC"],
    [/francetravail/, "France Travail"],
    [/adzuna/, "Adzuna"],
    [/jooble/, "Jooble"],
    [/glassdoor/, "Glassdoor"],
    [/greenhouse/, "Greenhouse"],
    [/lever/, "Lever"],
    [/ashby/, "Ashby"],
    [/smartrecruiters/, "SmartRecruiters"],
    [/workable/, "Workable"],
  ];
  for (const [re, name] of known) if (re.test(raw)) return name;
  try {
    if (url) return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // not a URL
  }
  return raw ? raw.replace(/^jsearch:|^alert:|^ats:/, "") : "Manuelle";
}

/** Distinct platform names where the same offer was seen. */
export function platformsOf(job: {
  source_platform?: string | null;
  source_url?: string | null;
  job_sources?: { platform: string | null; url: string }[] | null;
}): string[] {
  const names = new Set<string>([sourceLabel(job.source_platform, job.source_url)]);
  for (const s of job.job_sources ?? []) names.add(sourceLabel(s.platform, s.url));
  return [...names];
}
