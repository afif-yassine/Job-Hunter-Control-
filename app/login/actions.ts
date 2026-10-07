"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isEmail, magicLinkError, passwordError, passwordProblem, safeNext } from "@/lib/auth-messages";
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

export type PasswordState =
  | { status: "idle" }
  | { status: "confirm"; email: string; at: number }
  | { status: "reset-sent"; email: string; at: number }
  | { status: "error"; message: string; email: string };

function confirmUrl(origin: string, next: string) {
  const url = new URL("/auth/confirm", origin);
  if (next !== "/") url.searchParams.set("next", next);
  return url;
}

/**
 * Creates an account with an e-mail and a password. The account only works
 * once the address is confirmed (link in the e-mail), so nobody can open an
 * account with somebody else's address. Owner decision (2026-10-07): an
 * address that already has an account gets a clear "already exists" message —
 * clarity for the student chosen over enumeration protection.
 */
export async function signUpWithPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isEmail(email)) return { status: "error", message: "Cette adresse e-mail ne semble pas valide.", email };
  const problem = passwordProblem(password);
  if (problem) return { status: "error", message: problem, email };
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Le service de connexion n’est pas configuré.", email };
  const next = safeNext(String(formData.get("next") ?? ""));
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: confirmUrl(await siteOrigin(), next).toString() },
  });
  if (error) return { status: "error", message: passwordError(error), email };
  // Supabase hides "already registered" behind a fake user with no identities.
  // The owner chose clarity over enumeration protection: say it and stop here.
  if (data.user && data.user.identities?.length === 0) {
    return {
      status: "error",
      message: "Un compte existe déjà avec cette adresse. Connecte-toi avec ton mot de passe, Google ou un lien par e-mail.",
      email,
    };
  }
  // Confirmation switched off in Supabase: the account is already signed in.
  if (data.session) redirect(next);
  return { status: "confirm", email, at: Date.now() };
}

/** Password sign-in. */
export async function login(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=config");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${error.code === "email_not_confirmed" ? "not_confirmed" : "bad_password"}`);
  redirect(safeNext(String(formData.get("next") ?? "")));
}

/** "Mot de passe oublié": a link that opens the page where a new password is chosen. */
export async function sendPasswordReset(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isEmail(email)) return { status: "error", message: "Cette adresse e-mail ne semble pas valide.", email };
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Le service de connexion n’est pas configuré.", email };
  const redirectTo = new URL("/auth/confirm", await siteOrigin());
  redirectTo.searchParams.set("next", "/auth/nouveau-mot-de-passe");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });
  if (error) return { status: "error", message: passwordError(error), email };
  return { status: "reset-sent", email, at: Date.now() };
}

/** Saves the new password of the signed-in account (reached from the reset link). */
export async function setNewPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const again = String(formData.get("again") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { status: "error", message: problem, email: "" };
  if (password !== again) return { status: "error", message: "Les deux mots de passe ne sont pas identiques.", email: "" };
  const supabase = await createClient();
  if (!supabase) return { status: "error", message: "Le service de connexion n’est pas configuré.", email: "" };
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?error=link_expired");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: passwordError(error), email: "" };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
