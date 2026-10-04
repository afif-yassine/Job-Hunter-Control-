import { NextResponse, type NextRequest } from "next/server";
import { googleSignInEnabled } from "@/lib/google-signin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const back = (error: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
  if (!googleSignInEnabled()) return back("La connexion avec Google n’est pas encore ouverte.");
  const supabase = await createClient();
  if (!supabase) return back("Configuration Supabase manquante.");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("/auth/callback", request.url).toString() },
  });
  if (error || !data.url) return back(error?.message ?? "Google n’a pas répondu.");
  return NextResponse.redirect(data.url);
}
