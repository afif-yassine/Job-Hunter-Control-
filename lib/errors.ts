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

/** `technical`: the cause names the platform (worker, keys, hosting): only the administrator sees it. */
const RULES: { test: RegExp; out: Explained; technical?: true }[] = [
  {
    test: /Executable doesn't exist|Please update docker image|browserType\.launch/i,
    technical: true,
    out: {
      title: "Le navigateur du worker n’est pas prêt",
      hint: "Le worker Railway se met à jour. Réessaie dans 2 à 3 minutes.",
      retry: true,
    },
  },
  {
    test: /injoignable|ECONNREFUSED|ENOTFOUND|fetch failed|502|503|Bad Gateway/i,
    technical: true,
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
    technical: true,
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
    technical: true,
    out: {
      title: "Gemini n’a pas pu répondre",
      hint: "Réessaie dans un instant. Si ça continue, vérifie la clé Gemini.",
      retry: true,
    },
  },
  {
    test: /Unauthorized|401|refus/i,
    technical: true,
    out: {
      title: "Accès refusé",
      hint: "Vérifie la clé ou reconnecte-toi.",
      retry: false,
    },
  },
];

/** What a student reads when the cause is on our side. */
export const NEUTRAL_ERROR: Explained = {
  title: "Ça n’a pas marché de notre côté",
  hint: "Réessaie dans quelques minutes.",
  retry: true,
};

/** Words of the platform that no student should have to read. */
const PLATFORM_WORDS = /railway|vercel|playwright|gemini|gateway|supabase|WORKER_|\/api\/|HTTP \d{3}|Connexion impossible|Réponse vide|\bRPC\b|\bJWT\b|TypeError|undefined/i;

export type Audience = "admin" | "student";

/** The administrator keeps every technical detail; a student gets one neutral sentence for platform causes. */
export function explainError(raw: string | null | undefined, audience: Audience = "admin"): Explained | null {
  if (!raw) return null;
  const rule = RULES.find((r) => r.test.test(raw));
  if (audience === "student" && (rule?.technical || (!rule && PLATFORM_WORDS.test(raw)))) return NEUTRAL_ERROR;
  if (rule) return rule.out;
  return { title: raw.length > 140 ? `${raw.slice(0, 137)}…` : raw, hint: null, retry: false };
}

/** Removes the ASCII box Playwright draws around its messages. */
export function cleanRaw(raw: string) {
  return raw.replace(/[╔╗╚╝═║]/g, " ").replace(/\s+/g, " ").trim();
}
