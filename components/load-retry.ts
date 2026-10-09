import { explainError, type Audience } from "@/lib/errors";

/**
 * A token dated a few seconds in the future for the data server ("JWT issued at future") is a passing clock gap
 * between servers, or a wrong clock on the device. Asking again a moment later almost always works, so the
 * student never has to see it.
 */
const CLOCK_SKEW = /issued at future|jwt.*(not yet valid|future)|PGRST30[13]/i;

export function isClockSkew(error: { message?: string | null; code?: string | null } | null | undefined): boolean {
  if (!error) return false;
  return CLOCK_SKEW.test(error.message ?? "") || CLOCK_SKEW.test(error.code ?? "");
}

/** Wait 2 s and ask again, twice at most, and only for this error. `attempt` counts the retries already made. */
export const RETRY_DELAY_MS = 2000;
export const MAX_RETRIES = 2;
export function retryDecision(error: { message?: string | null; code?: string | null } | null | undefined, attempt: number): { retry: boolean; delayMs: number } {
  return { retry: isClockSkew(error) && attempt < MAX_RETRIES, delayMs: RETRY_DELAY_MS };
}

export const CONNECTION_TEXT = {
  title: "Connexion à tes données impossible pour l’instant",
  hint: "Recharge la page dans un instant. Si ça continue, vérifie que l’heure de ton appareil est réglée automatiquement.",
  retry: "Réessayer",
} as const;

/** What the dashboard says when the data could not be loaded. Only the administrator reads the raw message. */
export function loadErrorText(raw: string, audience: Audience): { title: string; hint: string | null } {
  if (audience === "admin") return { title: "Impossible de charger les données", hint: raw };
  if (isClockSkew({ message: raw })) return { title: CONNECTION_TEXT.title, hint: CONNECTION_TEXT.hint };
  const explained = explainError(raw, "student");
  return { title: explained?.title ?? CONNECTION_TEXT.title, hint: explained?.hint ?? CONNECTION_TEXT.hint };
}
