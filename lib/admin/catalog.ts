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
    id: "lba",
    name: "La bonne alternance",
    kind: "api",
    covers: "Offres d’alternance de La bonne alternance et de ses partenaires (France Travail, Météojobs, flux d’entreprises).",
    keys: ["LBA_API_KEY"],
    cost: "Clé gratuite (espace développeurs api.apprentissage.beta.gouv.fr)",
    launchNote: "Usage commercial interdit sans accord écrit de La bonne alternance : ne mets la clé en production qu’une fois l’accord obtenu.",
    optional: true,
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

export type EnrichmentSource = {
  id: "ft:formation" | "ft:marche" | "ft:acces";
  name: string;
  covers: string;
  /** Same FRANCE_TRAVAIL_CLIENT_ID/_SECRET as the job-offers API. */
  scopeVar: string;
  urlVar: string;
  cost: string;
  usedFor: string;
  /** Subscribed but not used by the app: nothing to configure, never nagged about. */
  unused?: boolean;
  /** Confirmed values (Sept 2026, live francetravail.io docs) to paste in Vercel. */
  scopeValue?: string;
  urlValue?: string;
};

/**
 * Three more France Travail APIs — free, same credentials as "Offres
 * d'emploi" — that don't produce job offers themselves but enrich the ones
 * already found. Each needs its own OAuth2 scope, subscribed for free on
 * francetravail.io, then set as an env var (not a secret: it's just a
 * permission string, safe to paste in chat).
 */
export const ENRICHMENT_SOURCES: EnrichmentSource[] = [
  {
    id: "ft:formation",
    name: "Open Formation",
    covers: "RDV et plages de candidature pour une formation déjà identifiée (usage organisme de formation).",
    scopeVar: "FRANCE_TRAVAIL_FORMATION_SCOPE",
    urlVar: "FRANCE_TRAVAIL_FORMATION_URL",
    unused: true,
    cost: "Gratuit",
    usedFor: "Pas de recherche par métier possible avec cette API : non utilisée dans Job Hunter Control pour l’instant.",
  },
  {
    id: "ft:marche",
    name: "Marché du travail",
    covers: "Grande famille de statistiques France Travail (demandeurs, embauches, offres, salaires…) par métier et territoire.",
    scopeVar: "FRANCE_TRAVAIL_MARCHE_SCOPE",
    urlVar: "FRANCE_TRAVAIL_MARCHE_URL",
    scopeValue: "api_stats-offres-demandes-emploiv1 offresetdemandesemploi",
    urlValue: "https://api.francetravail.io/partenaire/stats-offres-demandes-emploi/v1/indicateur/stat-demandeurs",
    cost: "Gratuit",
    usedFor: "Ajoute une note sous l’offre : nombre de demandeurs d’emploi inscrits sur ce métier, dans ce département.",
  },
  {
    id: "ft:acces",
    name: "Accès à l’emploi des demandeurs d’emploi",
    covers: "Taux de retour à l’emploi à 6 mois, par métier et territoire.",
    scopeVar: "FRANCE_TRAVAIL_ACCES_EMPLOI_SCOPE",
    urlVar: "FRANCE_TRAVAIL_ACCES_EMPLOI_URL",
    scopeValue: "api_stats-perspectives-retour-emploiv1 retouremploi",
    urlValue: "https://api.francetravail.io/partenaire/stats-perspectives-retour-emploi/v1/indicateur/stat-acces-emploi",
    cost: "Gratuit",
    usedFor: "Indicateur admin : à quel point un métier « recrute vraiment » sur la durée (pas encore affiché par offre).",
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
    "Utiliser le modèle de rédaction affiché ci-dessus et vérifier les faits sur les preuves du profil. Comparer les alternatives sur les mêmes CV et lettres avant de changer la configuration.",
  scoring:
    "La comparaison standard des compétences et le classement vectoriel ne font pas d’appel LLM par offre et par étudiant. L’analyse approfondie reste facultative et limitée.",
  savings:
    "Réutiliser résumés, vecteurs et kits inchangés. Les réservations évitent les traitements simultanés ; les quotas et le plafond de la clé Gateway limitent les dépenses.",
};

export const EMBEDDINGS_PLAN = {
  status: "Prévu, pas encore activé",
  what: "Recherche intelligente : trouver les offres proches du CV par le sens, pas seulement par les mots-clés, puis n’envoyer à l’IA que les 20 meilleures.",
  tools:
    "pgvector dans Supabase (gratuit) + gemini-embedding-001 (0,15 $ par million de tokens, ~1 500 requêtes gratuites/jour). Alternative gratuite auto-hébergée : bge-m3 (multilingue) sur Railway.",
};
