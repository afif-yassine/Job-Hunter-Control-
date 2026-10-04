/**
 * Sign-in helpers shared by the login page and the auth routes. The URL only
 * ever carries a short error code, never a message: nobody can make the login
 * page display a sentence of their choosing.
 */

export const AUTH_ERRORS = {
  link_expired: "Ce lien de connexion a expiré ou a déjà servi. Demande-en un nouveau ci-dessous.",
  link_invalid: "Ce lien de connexion n’est pas valide. Demande-en un nouveau ci-dessous.",
  google_cancelled: "Connexion avec Google annulée.",
  google_failed: "Google n’a pas pu confirmer ta connexion. Réessaie dans un instant.",
  google_off: "La connexion avec Google n’est pas encore ouverte : utilise ton adresse e-mail.",
  bad_password: "Adresse e-mail ou mot de passe incorrect.",
  config: "Le service de connexion n’est pas configuré. Réessaie plus tard.",
  unknown: "La connexion n’a pas abouti. Réessaie dans un instant.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;

export function authErrorMessage(code: string | undefined | null): string | null {
  if (!code) return null;
  return code in AUTH_ERRORS ? AUTH_ERRORS[code as AuthErrorCode] : AUTH_ERRORS.unknown;
}

/** Where to go after signing in: only a path of this site, never another site ("//evil.com", "https://…", "/\evil"). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "https://x.invalid");
    if (url.origin !== "https://x.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/** Plain e-mail check before calling Supabase (the browser already checks; this is for scripts). */
export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** French message for an error from supabase.auth.signInWithOtp. */
export function magicLinkError(error: { message?: string; status?: number; code?: string }): string {
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (error.status === 429 || /rate limit|too many|security purposes|over_email_send_rate_limit/.test(text))
    return "Un lien vient déjà de partir. Attends une minute avant d’en demander un autre.";
  if (/not authorized|not allowed|signups? not allowed|email_address_not_authorized|signup_disabled/.test(text))
    return "Les inscriptions par e-mail ouvrent bientôt. En attendant, connecte-toi avec Google.";
  if (/invalid|validate|email_address_invalid/.test(text)) return "Cette adresse e-mail ne semble pas valide.";
  return "Le lien n’a pas pu être envoyé. Réessaie dans un instant.";
}
