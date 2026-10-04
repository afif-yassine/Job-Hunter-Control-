import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-messages";
import { googleSignInEnabled } from "@/lib/google-signin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  if (!googleSignInEnabled()) return fail("google_off");
  const supabase = await createClient();
  if (!supabase) return fail("config");
  const callback = new URL("/auth/callback", request.url);
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (next !== "/") callback.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) return fail("google_failed");
  return NextResponse.redirect(data.url);
}
