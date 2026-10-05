import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginBoard } from "@/components/jinnjob/login-board";
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
          <LoginBoard />
        </div>
        <div className="jj-login-form-wrap">
          <div className="jj-login-form">
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#4a4136", textDecoration: "none", fontSize: 15, minHeight: 44 }}>
              <span aria-hidden="true">←</span> Retour à l’accueil
            </Link>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h1 className="jj-fell" style={{ fontSize: 56, lineHeight: 1, letterSpacing: "-.01em" }}>Ouvre ton dossier.</h1>
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
