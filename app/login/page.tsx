import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { Lamp } from "@/components/jinnjob/lamp";
import { NoAccountYet } from "@/components/jinnjob/no-account";
import { googleSignInEnabled } from "@/lib/google-signin";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const claims = supabase ? await supabase.auth.getClaims() : null;
  if (claims?.data?.claims?.sub) redirect("/");
  const { error } = await searchParams;
  const google = googleSignInEnabled();
  return (
    <div className="jj">
      <main className="jj-login">
        <div className="jj-login-art" aria-hidden="true">
          <div className="jj-tome">
            <Lamp size={130} color="#d9b86a" cut="#7b2d26" accent="#f3ecdc" />
            <div className="jj-word" style={{ fontSize: 62, color: "#f3ecdc", position: "relative" }}>Jinn<em style={{ color: "#f3ecdc" }}>Job</em></div>
            <div className="jj-fellsc" style={{ fontSize: 20, letterSpacing: ".08em", color: "#f0ddd0", position: "relative" }}>Tome I · Ton alternance</div>
          </div>
        </div>
        <div className="jj-login-form-wrap">
          <div className="jj-login-form">
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#4a4136", textDecoration: "none", fontSize: 15, minHeight: 44 }}>
              <span aria-hidden="true">←</span> Retour à l’accueil
            </Link>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h1 className="jj-fell" style={{ fontSize: 56, lineHeight: 1, letterSpacing: "-.01em" }}>Ouvre ton livre.</h1>
              <p style={{ fontSize: 18, lineHeight: 1.55, color: "#4a4136" }}>Tes pistes, tes CV et tes candidatures t’attendent. Rien n’est envoyé sans toi.</p>
            </div>
            {error && <p className="jj-error" role="alert">{error}</p>}
            {google && (
              <>
                <a className="jj-bound" href="/auth/google" style={{ width: "100%" }}>
                  <span className="jj-gmark" aria-hidden="true">G</span>
                  Continuer avec Google
                </a>
                <div className="jj-or jj-mono" style={{ fontSize: 13, letterSpacing: ".12em" }}>OU PAR E-MAIL</div>
              </>
            )}
            <form action={login} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label className="jj-field">Adresse e-mail<input className="jj-input" name="email" type="email" autoComplete="email" required /></label>
              <label className="jj-field">Mot de passe<input className="jj-input" name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
              <div style={{ marginTop: 6 }}>
                <button className="jj-ribbon" type="submit">Entrer <span className="arr" aria-hidden="true">→</span></button>
              </div>
            </form>
            <NoAccountYet />
          </div>
        </div>
      </main>
    </div>
  );
}
