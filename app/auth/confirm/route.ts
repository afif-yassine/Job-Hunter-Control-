import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

/**
 * Target of the link in the sign-in e-mail. The e-mail template sends
 * `token_hash` (works on any device); a `code` (PKCE, same browser only) is
 * still accepted for e-mails sent with the default template.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  const supabase = await createClient();
  if (!supabase) return fail("config");

  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return fail(/expired|invalid|not found/i.test(error.message) ? "link_expired" : "link_invalid");
  }

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    return fail("link_expired");
  }

  // Supabase sends errors back in the query (e.g. error_code=otp_expired).
  if (params.get("error_code") === "otp_expired") return fail("link_expired");
  return fail("link_invalid");
}
