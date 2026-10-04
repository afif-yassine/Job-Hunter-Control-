/**
 * "Continuer avec Google" is off until the Google provider is set up in
 * Supabase (Authentication > Providers) AND public sign-up is wanted: any
 * Google account could then create an account. Turn it on with
 * NEXT_PUBLIC_GOOGLE_SIGNIN=1 in Vercel.
 */
export function googleSignInEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_GOOGLE_SIGNIN === "1";
}
