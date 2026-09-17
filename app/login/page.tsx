import { redirect } from "next/navigation";
import { login } from "./actions";
import { createClient } from "@/lib/supabase/server";
import "./login.css";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const claims = supabase ? await supabase.auth.getClaims() : null;
  if (claims?.data?.claims?.sub) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <section className="card login-card">
        <div className="mark">JH</div>
        <div><div className="eyebrow">AI Agent Hunter</div><h1>Connexion sécurisée</h1><p className="muted">Accédez au tableau de bord de Yassine Afif.</p></div>
        {error && <p className="error-box">{error}</p>}
        <form action={login} className="login-form">
          <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label>Mot de passe<input name="password" type="password" minLength={8} required /></label>
          <button className="btn" type="submit">Se connecter</button>
        </form>
        <p className="muted login-note">La création publique de comptes est désactivée. Seul le compte déjà créé dans Supabase peut se connecter.</p>
      </section>
    </main>
  );
}
