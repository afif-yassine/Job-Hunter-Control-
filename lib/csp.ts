/**
 * Content-Security-Policy with a fresh nonce per request: only the scripts
 * Next.js renders with that nonce (and what they load) can run, so injected
 * markup cannot execute JavaScript. Next reads the nonce from the request's
 * CSP header and adds it to its own scripts.
 */
export function buildCsp(nonce: string, env: Record<string, string | undefined> = process.env): string {
  let supabase = "https://*.supabase.co wss://*.supabase.co";
  try {
    if (env.NEXT_PUBLIC_SUPABASE_URL) {
      const u = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
      supabase = `${u.origin} wss://${u.host}`;
    }
  } catch {
    // keep the generic Supabase hosts
  }
  const dev = env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}`,
    // PDF preview of a generated document.
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // "Ouvrir dans Overleaf" posts the LaTeX source to Overleaf.
    "form-action 'self' https://www.overleaf.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
