import Link from "next/link";
import { redirect } from "next/navigation";
import { LegalFooter } from "@/components/jinnjob/legal";
import { NewPasswordForm } from "@/components/jinnjob/new-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nouveau mot de passe", robots: { index: false } };

/** Reached from the "mot de passe oublié" e-mail: the link already signed the account in. */
export default async function NewPasswordPage() {
  const supabase = await createClient();
  const claims = supabase ? await supabase.auth.getClaims() : null;
  if (!claims?.data?.claims?.sub) redirect("/login?error=link_expired");
  return (
    <div className="jj">
      <main className="jj-login" style={{ gridTemplateColumns: "1fr" }}>
        <div className="jj-login-form-wrap">
          <div className="jj-login-form">
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#4a4136", textDecoration: "none", fontSize: 15, minHeight: 44 }}>
              <span aria-hidden="true">←</span> Retour à l’accueil
            </Link>
            <h1 className="jj-fell" style={{ fontSize: 48, lineHeight: 1 }}>Nouveau mot de passe.</h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: "#4a4136" }}>Choisis un mot de passe de 8 caractères au moins. Les mots de passe déjà apparus dans une fuite de données sont refusés.</p>
            <NewPasswordForm />
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}
