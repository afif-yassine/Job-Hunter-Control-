import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Lamp } from "@/components/jinnjob/lamp";
import { SignIn } from "@/components/jinnjob/sign-in";
import { LegalFooter } from "@/components/jinnjob/legal";
import { authErrorMessage, safeNext } from "@/lib/auth-messages";
import { googleSignInEnabled } from "@/lib/google-signin";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const supabase = await createClient();
  const claims = supabase ? await supabase.auth.getClaims() : null;
  const { error, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (claims?.data?.claims?.sub) redirect(next);
  const google = googleSignInEnabled();
  return (
    <div className="jj">
      <main className="jj-login">
        <div className="jj-login-art" aria-hidden="true">
          <div className="jj-tome">
            <Lamp size={130} color="#d9b86a" cut="#7b2d26" accent="#f3ecdc" />
            <div className="jj-word" style={{ fontSize: 62, color: "#f3ecdc", position: "relative" }}>LeBon<em style={{ color: "#f3ecdc" }}>Taf</em></div>
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
              <p style={{ fontSize: 18, lineHeight: 1.55, color: "#4a4136" }}>Connexion ou inscription, c’est la même porte : ton compte se crée à la première visite. Gratuit pendant la phase de test.</p>
            </div>
            <SignIn google={google} next={next} error={authErrorMessage(error)} />
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
