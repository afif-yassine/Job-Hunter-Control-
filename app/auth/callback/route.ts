import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";

/** Google sends the user back here with a one-time code, exchanged for a session. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  if (params.get("error") === "access_denied") return fail("google_cancelled");
  const code = params.get("code");
  if (!code) return fail("google_failed");
  const supabase = await createClient();
  if (!supabase) return fail("config");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("google_failed");
  return NextResponse.redirect(new URL(safeNext(params.get("next")), request.url));
}
