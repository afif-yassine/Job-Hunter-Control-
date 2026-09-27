/**
 * Everything the admin page lists, in one place: offer sources, AI models and
 * the planned smart search. Client-safe (no secret, only labels and facts).
 * Prices were checked in September 2026; review them before relying on them.
 */

export type SourceKind = "api" | "careers" | "email" | "external";

export type CatalogSource = {
  id: string;
  name: string;
  kind: SourceKind;
  covers: string;
  /** Environment variables of the platform key ("" = no key needed). */
  keys: string[];
  cost: string;
  /** Before opening to paying clients. */
  launchNote?: string;
  /** Nice to have: a missing key is not a problem. */
  optional?: boolean;
};

export const SOURCES: CatalogSource[] = [
  {
    id: "francetravail",
    name: "France Travail",
    kind: "api",
    covers: "Toutes les offres déposées à France Travail (officiel).",
    keys: ["FRANCE_TRAVAIL_CLIENT_ID", "FRANCE_TRAVAIL_CLIENT_SECRET"],
    cost: "Gratuit · 10 appels/seconde",
    launchNote: "Licence ouverte : usage commercial autorisé en citant France Travail.",
  },
  {
    id: "jsearch",
    name: "JSearch (Google Jobs)",
    kind: "api",
    covers: "LinkedIn, Indeed, Welcome to the Jungle, HelloWork, APEC, Glassdoor…",
    keys: ["JSEARCH_API_KEY"],
    cost: "Gratuit 200 req/mois · Pro 25 $ (10 000) · Ultra 75 $ (50 000)",
    launchNote: "Budget gratuit plafonné à 180 req/mois par la plateforme (JSEARCH_MONTHLY_BUDGET).",
  },
  {
    id: "adzuna",
    name: "Adzuna",
    kind: "api",
    covers: "Des milliers de sites d’emploi français, dont des PME.",
    keys: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
    cost: "Gratuit 250 appels/jour, 2 500/mois",
    launchNote: "Usage commercial restreint : licence à demander à Adzuna avant l’ouverture publique.",
  },
  {
    id: "jooble",
    name: "Jooble",
    kind: "api",
    covers: "Moteur d’offres multi-sites.",
    keys: ["JOOBLE_API_KEY"],
    cost: "Clé gratuite, quota total limité",
    optional: true,
  },
  { id: "ats:greenhouse", name: "Greenhouse", kind: "careers", covers: "Pages carrière des entreprises clientes de Greenhouse.", keys: [], cost: "Gratuit, sans clé" },
  { id: "ats:lever", name: "Lever", kind: "careers", covers: "Pages carrière Lever.", keys: [], cost: "Gratuit, sans clé" },
  { id: "ats:ashby", name: "Ashby", kind: "careers", covers: "Pages carrière Ashby.", keys: [], cost: "Gratuit, sans clé" },
  { id: "ats:smartrecruiters", name: "SmartRecruiters", kind: "careers", covers: "Pages carrière SmartRecruiters.", keys: [], cost: "Gratuit, sans clé" },
  { id: "ats:workable", name: "Workable", kind: "careers", covers: "Pages carrière Workable.", keys: [], cost: "Gratuit, sans clé" },
  { id: "ats:recruitee", name: "Recruitee", kind: "careers", covers: "Pages carrière Recruitee.", keys: [], cost: "Gratuit, sans clé" },
  {
    id: "gmail",
    name: "Alertes e-mail (Gmail)",
    kind: "email",
    covers: "Alertes LinkedIn, Indeed, HelloWork… reçues par e-mail.",
    keys: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"],
    cost: "Gratuit",
    launchNote: "Lire la boîte Gmail des clients exigera l’audit de sécurité Google (payant).",
    optional: true,
  },
  {
    id: "webhook",
    name: "Scanner externe",
    kind: "external",
    covers: "Un service tiers qui renvoie des offres (compatibilité).",
    keys: ["SCAN_WEBHOOK_URL"],
    cost: "Selon le service",
    optional: true,
  },
];

/** Not connected on purpose, with the reason (shown for transparency). */
export const NOT_CONNECTED = [
  { name: "LinkedIn, Indeed, Welcome to the Jungle, APEC en direct", why: "Robots interdits par leurs conditions : couverts via JSearch (Google Jobs)." },
  { name: "Workday", why: "Pas d’API publique documentée : zone grise, à vérifier avant usage." },
  { name: "Teamtailor", why: "Demande une clé fournie par chaque entreprise." },
];

export const AI_ADVICE = {
  writing:
    "Garder Gemini Flash pour les CV et lettres : n°1 du classement Hemingway-bench (rédacteurs professionnels, à l’aveugle). Alternative moins chère à tester sur le français : Mistral Large 3 (0,50 $ / 1,50 $ par million de tokens).",
  scoring:
    "Pour le score (gros volume, peu d’écriture) : Gemini Flash-Lite (0,30 $ / 2,50 $) ou DeepSeek V3.2 (0,28 $ / 0,42 $). Éviter Qwen pour les CV : jugé enclin aux erreurs factuelles.",
  savings:
    "Économies sans changer de modèle : Batch API Gemini (−50 %) pour les analyses du serveur, et cache du profil (−90 % sur la partie répétée). Attention : prix de Gemini Flash ×2 au 1er janvier 2027.",
};

export const EMBEDDINGS_PLAN = {
  status: "Prévu, pas encore activé",
  what: "Recherche intelligente : trouver les offres proches du CV par le sens, pas seulement par les mots-clés, puis n’envoyer à l’IA que les 20 meilleures.",
  tools:
    "pgvector dans Supabase (gratuit) + gemini-embedding-001 (0,15 $ par million de tokens, ~1 500 requêtes gratuites/jour). Alternative gratuite auto-hébergée : bge-m3 (multilingue) sur Railway.",
};
