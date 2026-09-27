/**
 * Turns raw technical errors (Playwright, fetch, Gemini...) into a sentence
 * Yassine can act on. The raw text stays available in the details.
 */
export type Explained = {
  title: string;
  hint: string | null;
  /** true when retrying later is the right move. */
  retry: boolean;
};

const RULES: { test: RegExp; out: Explained }[] = [
  {
    test: /Executable doesn't exist|Please update docker image|browserType\.launch/i,
    out: {
      title: "Le navigateur du worker n’est pas prêt",
      hint: "Le worker Railway se met à jour. Réessaie dans 2 à 3 minutes.",
      retry: true,
    },
  },
  {
    test: /injoignable|ECONNREFUSED|ENOTFOUND|fetch failed|502|503|Bad Gateway/i,
    out: {
      title: "Le worker Playwright ne répond pas",
      hint: "Vérifie que le service Railway est démarré, puis réessaie.",
      retry: true,
    },
  },
  {
    test: /timeout|timed out|aborted/i,
    out: {
      title: "La page de l’offre a mis trop de temps à répondre",
      hint: "Réessaie, ou postule directement depuis le lien de l’offre.",
      retry: true,
    },
  },
  {
    test: /A public HTTPS application URL is required|No application URL/i,
    out: {
      title: "Cette offre n’a pas de lien de candidature public",
      hint: "Ouvre l’offre et postule directement depuis le site.",
      retry: false,
    },
  },
  {
    test: /Worker Playwright non configur/i,
    out: {
      title: "Le worker Playwright n’est pas configuré",
      hint: "Ajoute WORKER_BASE_URL et WORKER_SHARED_SECRET dans Vercel.",
      retry: false,
    },
  },
  {
    test: /quota|429|RESOURCE_EXHAUSTED|rate limit/i,
    out: {
      title: "Quota atteint",
      hint: "Le service gratuit est saturé : réessaie plus tard.",
      retry: true,
    },
  },
  {
    test: /Gemini|GEMINI/i,
    out: {
      title: "Gemini n’a pas pu répondre",
      hint: "Réessaie dans un instant. Si ça continue, vérifie la clé Gemini.",
      retry: true,
    },
  },
  {
    test: /Unauthorized|401|refus/i,
    out: {
      title: "Accès refusé",
      hint: "Vérifie la clé ou reconnecte-toi.",
      retry: false,
    },
  },
];

export function explainError(raw: string | null | undefined): Explained | null {
  if (!raw) return null;
  for (const rule of RULES) if (rule.test.test(raw)) return rule.out;
  return { title: raw.length > 140 ? `${raw.slice(0, 137)}…` : raw, hint: null, retry: false };
}

/** Removes the ASCII box Playwright draws around its messages. */
export function cleanRaw(raw: string) {
  return raw.replace(/[╔╗╚╝═║]/g, " ").replace(/\s+/g, " ").trim();
}
