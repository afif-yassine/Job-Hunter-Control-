"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isEmail, magicLinkError, safeNext } from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string; at: number }
  | { status: "error"; message: string; email: string };

/** The address of this site as the visitor reached it (preview, production or local). */
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Sends a one-time sign-in link. The account is created on first use, so
 * there is no separate sign-up form. The link points to /auth/confirm, which
 * works even when the e-mail is opened on another device.
 */
export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { status: "error", message: "Cette adresse e-mail ne semble pas valide.", email };
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Le service de connexion n’est pas configuré.", email };
  const next = safeNext(String(formData.get("next") ?? ""));
  const redirectTo = new URL("/auth/confirm", await siteOrigin());
  if (next !== "/") redirectTo.searchParams.set("next", next);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo.toString() },
  });
  if (error) return { status: "error", message: magicLinkError(error), email };
  return { status: "sent", email, at: Date.now() };
}

/** Password sign-in, kept for accounts created before magic links. */
export async function login(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=config");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=bad_password");
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function logout() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
