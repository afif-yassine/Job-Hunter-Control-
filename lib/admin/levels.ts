/**
 * Launch levels of the admin space, played like a game: each level has a goal
 * (students, Pro accounts) and steps worth points. Some steps are detected
 * from the data, the others the admin ticks by hand (admin_quests).
 */

import type { Hosting } from "@/lib/economics";

export type GrowthStats = {
  users: number;
  admins: number;
  new_today: number;
  new_7d: number;
  new_30d: number;
  active_1d: number;
  active_7d: number;
  active_30d: number;
  pro: number;
  with_cv: number;
  kits_month: number;
  applied_month: number;
  interviews_month: number;
  offers_open: number;
  offers_summarized: number;
  offers_embedded: number;
  offers_new_7d: number;
};

/** What the automatic steps can look at. */
export type StepFacts = GrowthStats & {
  analysisPriceIn: number;
  aiUsdMonth: number;
  monthMarginEur: number;
};

export type StepDef = {
  id: string;
  label: string;
  hint?: string;
  xp: number;
  /** Detected from the data; manual steps have none. */
  auto?: (f: StepFacts) => boolean;
  /** Link to the place where it is done. */
  href?: string;
};

export type LevelDef = {
  n: number;
  id: string;
  name: string;
  badge: string;
  goalUsers: number;
  goalPro: number;
  /** Hosting at this level, in dollars per month. */
  hosting: Hosting;
  steps: StepDef[];
};

const students = (f: StepFacts) => Math.max(0, f.users - f.admins);
const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

export const LEVELS: LevelDef[] = [
  {
    n: 1,
    id: "first-100",
    name: "Les 100 premiers",
    badge: "Bon départ",
    goalUsers: 100,
    goalPro: 0,
    hosting: { vercel: 0, supabase: 0, other: 2 },
    steps: [
      { id: "deploy-sprint6", label: "Mettre en ligne le Sprint 6 (Mon suivi)", hint: "Lance deploy-job-hunter.bat sur ton PC.", xp: 50 },
      {
        id: "gemini-paid",
        label: "Clé Gemini payante avec plafond de dépenses",
        hint: "Le niveau gratuit de Google peut entraîner ses modèles sur les CV : à éviter (RGPD). Plafond conseillé : 20 $/mois.",
        xp: 50,
        href: "https://aistudio.google.com/",
      },
      {
        id: "cheap-analysis",
        label: "Score sur un modèle bon marché",
        hint: "Dans Vercel : AI_MODEL_ANALYSIS = gemini-2.5-flash-lite. Le score coûte alors environ 17 fois moins cher.",
        xp: 40,
        auto: (f) => f.analysisPriceIn <= 0.2,
      },
      {
        id: "google-credits",
        label: "Demander les crédits Google for Startups",
        hint: "Niveau « Start » : jusqu’à 2 000 $ de crédits Gemini, sans levée de fonds. Il faut un site et une société.",
        xp: 80,
        href: "https://startup.google.com/cloud/",
      },
      {
        id: "catalogue-ready",
        label: "Catalogue lu et vectorisé (90 % des offres)",
        hint: "Arrive avec le Sprint 7 : chaque offre résumée et vectorisée une seule fois pour tous.",
        xp: 100,
        auto: (f) => f.offers_open > 0 && share(f.offers_embedded, f.offers_open) >= 0.9 && share(f.offers_summarized, f.offers_open) >= 0.9,
      },
      { id: "students-10", label: "10 premiers étudiants inscrits", xp: 50, auto: (f) => students(f) >= 10 },
      { id: "feedback-10", label: "Recueillir l’avis de 10 étudiants", hint: "Un appel de 10 minutes ou un formulaire : qu’est-ce qui manque, qu’est-ce qui gêne ?", xp: 60 },
      { id: "students-100", label: "100 étudiants inscrits", xp: 150, auto: (f) => students(f) >= 100 },
    ],
  },
  {
    n: 2,
    id: "first-1000",
    name: "Les 1 000",
    badge: "Ça décolle",
    goalUsers: 1000,
    goalPro: 40,
    hosting: { vercel: 20, supabase: 25, other: 2 },
    steps: [
      { id: "company", label: "Créer la micro-entreprise (SIRET)", hint: "Obligatoire pour encaisser avec Stripe et pour les crédits Google.", xp: 60, href: "https://formalites.entreprises.gouv.fr/" },
      {
        id: "legal-check",
        label: "Faire valider l’offre Pro par un juriste",
        hint: "Article L5321-3 du Code du travail : on ne fait pas payer un étudiant pour lui trouver un emploi. La recherche reste gratuite ; le Pro vend l’écriture de CV et de lettres.",
        xp: 60,
      },
      { id: "vercel-pro", label: "Passer Vercel en Pro (20 $/mois)", hint: "Le plan gratuit Hobby interdit l’usage commercial : à faire avant le premier paiement.", xp: 40, href: "https://vercel.com/pricing" },
      { id: "supabase-pro", label: "Passer Supabase en Pro (25 $/mois)", hint: "Sauvegardes quotidiennes et pas de mise en pause.", xp: 40, href: "https://supabase.com/pricing" },
      { id: "stripe", label: "Activer Stripe : Pro à 7,99 €/mois", hint: "Carte européenne : 1,5 % + 0,25 € par paiement, environ 0,7 % de plus pour les abonnements.", xp: 100, href: "https://dashboard.stripe.com/" },
      { id: "first-pro", label: "Premier abonné Pro", xp: 100, auto: (f) => f.pro >= 1 },
      { id: "email-pro", label: "E-mails pro (Resend + contact@lebontaf.com)", xp: 40 },
      { id: "school", label: "Premier partenariat avec une école ou un CFA", hint: "Le canal le moins cher pour trouver des étudiants.", xp: 120 },
      { id: "profitable", label: "Rentable ce mois-ci", hint: "Le revenu Pro paie l’hébergement et l’IA.", xp: 200, auto: (f) => f.pro > 0 && f.monthMarginEur >= 0 },
      { id: "students-1000", label: "1 000 étudiants inscrits", xp: 250, auto: (f) => students(f) >= 1000 },
    ],
  },
  {
    n: 3,
    id: "first-8000",
    name: "Les 8 000",
    badge: "Référence",
    goalUsers: 8000,
    goalPro: 240,
    hosting: { vercel: 50, supabase: 60, other: 25 },
    steps: [
      { id: "batch", label: "Lire le catalogue en lot (Batch API, −50 %)", xp: 60 },
      {
        id: "ai-per-active",
        label: "Coût IA sous 0,10 $ par étudiant actif",
        hint: "Mesuré sur le mois en cours, à partir de 100 actifs.",
        xp: 120,
        auto: (f) => f.active_30d >= 100 && f.aiUsdMonth / f.active_30d < 0.1,
      },
      { id: "open-model-test", label: "Tester un modèle open source pour lire les offres", hint: "Sur le banc d’essai : même qualité de résumé ?", xp: 80 },
      { id: "self-host", label: "Louer une carte graphique seulement si la facture IA dépasse 500 $/mois", xp: 100 },
      { id: "support", label: "FAQ et réponse aux e-mails sous 48 h", xp: 60 },
      { id: "pro-100", label: "100 abonnés Pro", xp: 200, auto: (f) => f.pro >= 100 },
      { id: "students-8000", label: "8 000 étudiants inscrits", xp: 500, auto: (f) => students(f) >= 8000 },
    ],
  },
];

export const RANKS = [
  { xp: 0, title: "Stagiaire" },
  { xp: 300, title: "Alternant" },
  { xp: 800, title: "Junior" },
  { xp: 1500, title: "Confirmé" },
  { xp: 2500, title: "Fondateur" },
];

export type StepState = Omit<StepDef, "auto"> & { done: boolean; automatic: boolean; doneAt: string | null };
export type LevelState = Omit<LevelDef, "steps"> & {
  steps: StepState[];
  done: number;
  xp: number;
  xpMax: number;
  complete: boolean;
  status: "done" | "current" | "locked";
};

export type Progress = {
  levels: LevelState[];
  current: number;
  xp: number;
  rank: { title: string; next: { title: string; xp: number } | null };
};

/** Where the admin stands: steps done, points, rank, current level. */
export function progress(facts: StepFacts, manual: Map<string, string>): Progress {
  let current = 0;
  const levels: LevelState[] = LEVELS.map((level) => {
    const steps: StepState[] = level.steps.map(({ auto, ...s }) => {
      const automatic = Boolean(auto);
      const done = automatic ? Boolean(auto!(facts)) : manual.has(s.id);
      return { ...s, automatic, done, doneAt: automatic ? null : (manual.get(s.id) ?? null) };
    });
    const done = steps.filter((s) => s.done).length;
    const xp = steps.reduce((t, s) => t + (s.done ? s.xp : 0), 0);
    const xpMax = steps.reduce((t, s) => t + s.xp, 0);
    return { ...level, steps, done, xp, xpMax, complete: done === steps.length, status: "locked" as const };
  });
  for (const l of levels) {
    if (!l.complete && !current) current = l.n;
  }
  if (!current) current = levels.length;
  for (const l of levels) l.status = l.complete ? "done" : l.n === current ? "current" : l.n < current ? "done" : "locked";
  const xp = levels.reduce((t, l) => t + l.xp, 0);
  const reached = [...RANKS].reverse().find((r) => xp >= r.xp) ?? RANKS[0];
  const next = RANKS.find((r) => r.xp > xp) ?? null;
  return { levels, current, xp, rank: { title: reached.title, next } };
}

export const ALL_STEP_IDS = new Set(LEVELS.flatMap((l) => l.steps.map((s) => s.id)));
export const MANUAL_STEP_IDS = new Set(LEVELS.flatMap((l) => l.steps.filter((s) => !s.auto).map((s) => s.id)));
