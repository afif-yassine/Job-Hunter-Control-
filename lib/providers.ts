/**
 * Job sources the user can connect from Réglages > Sources.
 * Client-safe: no secret, only labels and instructions.
 *
 * Why not "scan the whole internet" directly? LinkedIn, Indeed, Hellowork...
 * forbid automated scraping and block it. Aggregator APIs (JSearch reads
 * Google for Jobs, which lists LinkedIn / Indeed / Welcome to the Jungle...)
 * and the official France Travail API are the legitimate way to cover them.
 */
export type ProviderId = "jsearch" | "adzuna" | "francetravail" | "jooble" | "gmail";

export type ProviderField = {
  /** Same name as the environment variable it replaces. */
  key: string;
  label: string;
  secret: boolean;
  placeholder?: string;
};

export type ProviderDef = {
  id: ProviderId;
  name: string;
  covers: string;
  /** Time needed to get the key. */
  effort: string;
  free: string;
  url: string;
  urlLabel: string;
  steps: string[];
  fields: ProviderField[];
  recommended?: boolean;
  advanced?: boolean;
};

export const PROVIDERS: ProviderDef[] = [
  {
    id: "jsearch",
    name: "JSearch — tout internet",
    covers: "Google Jobs : LinkedIn, Indeed, Glassdoor, Welcome to the Jungle, Hellowork, APEC…",
    effort: "3 min",
    free: "Gratuit (≈200 recherches par mois)",
    url: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch",
    urlLabel: "Ouvrir JSearch sur RapidAPI",
    recommended: true,
    steps: [
      "Ouvre la page JSearch et crée un compte gratuit RapidAPI.",
      "Clique sur « Pricing », puis « Subscribe » sur le plan Basic (gratuit).",
      "Copie la valeur « X-RapidAPI-Key » (onglet Endpoints) et colle-la ci-dessous.",
    ],
    fields: [{ key: "JSEARCH_API_KEY", label: "Clé API JSearch", secret: true }],
  },
  {
    id: "adzuna",
    name: "Adzuna — offres agrégées",
    covers: "Des milliers de sites d’emploi français, dont beaucoup de PME.",
    effort: "2 min",
    free: "Gratuit",
    url: "https://developer.adzuna.com/signup",
    urlLabel: "Créer un compte Adzuna",
    steps: [
      "Crée un compte développeur gratuit sur Adzuna.",
      "Sur ton tableau de bord, copie « Application ID » et « Application Key ».",
      "Colle-les ci-dessous.",
    ],
    fields: [
      { key: "ADZUNA_APP_ID", label: "Application ID", secret: false },
      { key: "ADZUNA_APP_KEY", label: "Application Key", secret: true },
    ],
  },
  {
    id: "francetravail",
    name: "France Travail — offres officielles",
    covers: "Toutes les offres déposées à France Travail (alternance, stage, CDI).",
    effort: "10 min",
    free: "Gratuit",
    url: "https://francetravail.io/inscription",
    urlLabel: "Créer un compte francetravail.io",
    steps: [
      "Crée un compte sur francetravail.io, puis « Mes applications » > « Créer une application ».",
      "Ajoute l’API « Offres d’emploi v2 » à ton application.",
      "Copie l’« Identifiant client » et la « Clé secrète » ci-dessous.",
    ],
    fields: [
      { key: "FRANCE_TRAVAIL_CLIENT_ID", label: "Identifiant client", secret: false },
      { key: "FRANCE_TRAVAIL_CLIENT_SECRET", label: "Clé secrète", secret: true },
    ],
  },
  {
    id: "jooble",
    name: "Jooble — moteur d’offres",
    covers: "Un moteur qui rassemble des offres de nombreux sites.",
    effort: "5 min",
    free: "Gratuit (clé envoyée par e-mail)",
    url: "https://fr.jooble.org/api/about",
    urlLabel: "Demander une clé Jooble",
    steps: [
      "Remplis le formulaire de demande de clé sur Jooble.",
      "La clé arrive par e-mail (quelques minutes à quelques heures).",
      "Colle-la ci-dessous.",
    ],
    fields: [{ key: "JOOBLE_API_KEY", label: "Clé API Jooble", secret: true }],
  },
  {
    id: "gmail",
    name: "Alertes e-mail (Gmail)",
    covers: "Tes alertes LinkedIn, Indeed, Hellowork, APEC… lues dans Gmail.",
    effort: "20 min",
    free: "Gratuit — réglage avancé",
    url: "https://console.cloud.google.com/apis/credentials",
    urlLabel: "Ouvrir Google Cloud",
    advanced: true,
    steps: [
      "Crée des alertes e-mail sur chaque site et range-les dans le libellé « job-alerts ».",
      "Crée un client OAuth Google (voir docs/SCANNER.md dans le projet) et obtiens un refresh token.",
      "Colle les trois valeurs ci-dessous.",
    ],
    fields: [
      { key: "GMAIL_CLIENT_ID", label: "Client ID", secret: false },
      { key: "GMAIL_CLIENT_SECRET", label: "Client secret", secret: true },
      { key: "GMAIL_REFRESH_TOKEN", label: "Refresh token", secret: true },
    ],
  },
];

export function providerById(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
