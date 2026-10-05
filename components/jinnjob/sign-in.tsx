"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { login, sendMagicLink, sendPasswordReset, signUpWithPassword, type MagicLinkState, type PasswordState } from "@/app/login/actions";

const RESEND_AFTER = 60;
const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Webmail shortcuts for the "check your inbox" step, picked from the address. */
function inboxFor(email: string): { label: string; href: string } | null {
  const domain = email.split("@")[1] ?? "";
  if (/^(gmail|googlemail)\.com$/.test(domain)) return { label: "Ouvrir Gmail", href: "https://mail.google.com/mail/u/0/#search/in%3Aanywhere+newer_than%3A1h" };
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(domain)) return { label: "Ouvrir Outlook", href: "https://outlook.live.com/mail/0/" };
  if (/^yahoo\.[a-z.]+$/.test(domain)) return { label: "Ouvrir Yahoo Mail", href: "https://mail.yahoo.com/" };
  if (/^(icloud|me|mac)\.com$/.test(domain)) return { label: "Ouvrir iCloud Mail", href: "https://www.icloud.com/mail" };
  if (/^(orange|wanadoo)\.fr$/.test(domain)) return { label: "Ouvrir Orange Mail", href: "https://messagerie.orange.fr/" };
  return null;
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="jj-ribbon" type="submit" disabled={pending} aria-busy={pending} style={{ width: "100%", justifyContent: "center" }}>
      {pending ? "Envoi en cours…" : children}
      {!pending && <span className="arr" aria-hidden="true">→</span>}
    </button>
  );
}

/** Seconds left before another link may be requested (Supabase allows one a minute). */
function useCountdown(from: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (from === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [from]);
  if (from === null) return 0;
  return Math.max(0, RESEND_AFTER - Math.floor((now - from) / 1000));
}

type Mode = "signup" | "signin" | "link";
const MODES: { id: Mode; label: string }[] = [
  { id: "signup", label: "Créer un compte" },
  { id: "signin", label: "Se connecter" },
  { id: "link", label: "Lien par e-mail" },
];

export function SignIn({ google, next, error }: { google: boolean; next: string; error: string | null }) {
  const [mode, setMode] = useState<Mode>("signup");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <p className="jj-error" role="alert">{error}</p>}
      {google && (
        <>
          <a className="jj-bound" href={next === "/" ? "/auth/google" : `/auth/google?next=${encodeURIComponent(next)}`} style={{ width: "100%" }}>
            <GoogleMark />
            Continuer avec Google
          </a>
          <div className="jj-or jj-mono" style={{ fontSize: 13, letterSpacing: ".12em" }}>OU AVEC TON E-MAIL</div>
        </>
      )}
      <div className="jj-modes" role="tablist" aria-label="Façon de se connecter">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? "is-on" : ""} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === "signup" && <SignUpForm next={next} />}
      {mode === "signin" && <SignInForm next={next} />}
      {mode === "link" && <MagicLinkForm next={next} />}
      <p className="jj-consent">
        En continuant, tu acceptes les <Link href="/conditions">conditions d’utilisation</Link> et tu as lu la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>. Rien n’est envoyé à un recruteur sans ton accord.
      </p>
    </div>
  );
}

/** "Regarde ta boîte mail" screen shared by the three e-mail flows. */
function Sent({ email, title, children, again, left, onChange, againLabel = "Renvoyer l’e-mail" }: { email: string; title: string; children: React.ReactNode; again: () => void; left: number; onChange: () => void; againLabel?: string }) {
  const inbox = inboxFor(email);
  return (
    <motion.div className="jj-sent" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} role="status" aria-live="polite">
      <Envelope />
      <h2 className="jj-fell" style={{ fontSize: 34, lineHeight: 1.05 }}>{title}</h2>
      <p>{children}</p>
      {inbox && <a className="jj-bound" href={inbox.href} target="_blank" rel="noreferrer" style={{ width: "100%" }}>{inbox.label}</a>}
      <p className="jj-sent-help">Rien reçu ? Regarde dans les indésirables ou l’onglet Promotions.</p>
      <div className="jj-sent-actions">
        <button className="jj-quill" type="button" onClick={again} disabled={left > 0}>
          {left > 0 ? `${againLabel} dans ${left} s` : againLabel}
        </button>
        <button className="jj-quill" type="button" onClick={onChange}>Changer d’adresse</button>
      </div>
    </motion.div>
  );
}

function MagicLinkForm({ next }: { next: string }) {
  const [state, action] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const left = useCountdown(state.status === "sent" ? state.at : null);
  const form = useRef<HTMLFormElement>(null);
  if (state.status === "sent" && !editing)
    return (
      <>
        <form ref={form} action={action} hidden>
          <input name="email" defaultValue={state.email} />
          <input name="next" defaultValue={next} />
        </form>
        <Sent email={state.email} title="Regarde ta boîte mail." left={left} again={() => form.current?.requestSubmit()} onChange={() => setEditing(true)}>
          Un lien de connexion vient de partir vers <strong>{state.email}</strong>. Il est valable une heure et ne sert qu’une fois. Tu peux l’ouvrir sur ce téléphone ou cet ordinateur, peu importe.
        </Sent>
      </>
    );
  return (
    <form action={(fd) => { setEditing(false); return action(fd); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="next" value={next} />
      <EmailField state={state} />
      {state.status === "error" ? (
        <p id="jj-mail-error" className="jj-error" role="alert">{state.message}</p>
      ) : (
        <p id="jj-mail-hint" className="jj-hint">Pas de mot de passe : on t’envoie un lien, tu cliques, tu es dedans. Ton compte est créé à la première connexion.</p>
      )}
      <Submit>Recevoir mon lien</Submit>
    </form>
  );
}

function EmailField({ state }: { state: { status: string; email?: string } }) {
  return (
    <label className="jj-field">
      Adresse e-mail
      <input
        className="jj-input"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="prenom.nom@exemple.fr"
        defaultValue={state.status === "idle" ? "" : (state.email ?? "")}
        required
        aria-invalid={state.status === "error"}
        aria-describedby={state.status === "error" ? "jj-mail-error" : undefined}
      />
    </label>
  );
}

function PasswordField({ label, autoComplete, hint }: { label: string; autoComplete: "new-password" | "current-password"; hint?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="jj-field">
      {label}
      <span className="jj-pwrow">
        <input className="jj-input" name="password" type={shown ? "text" : "password"} autoComplete={autoComplete} minLength={autoComplete === "new-password" ? 8 : undefined} maxLength={72} required />
        <button type="button" className="jj-quill" onClick={() => setShown((v) => !v)} aria-pressed={shown}>{shown ? "Cacher" : "Voir"}</button>
      </span>
      {hint && <small className="jj-hint">{hint}</small>}
    </label>
  );
}

function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState<PasswordState, FormData>(signUpWithPassword, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const left = useCountdown(state.status === "confirm" ? state.at : null);
  const form = useRef<HTMLFormElement>(null);
  if (state.status === "confirm" && !editing)
    return (
      <Sent email={state.email} title="Confirme ton adresse." left={left} againLabel="Recommencer" again={() => setEditing(true)} onChange={() => setEditing(true)}>
        Un e-mail de confirmation vient de partir vers <strong>{state.email}</strong>. Clique sur le lien dedans : ton compte sera prêt et tu seras connecté. Si cette adresse a déjà un compte, utilise « Se connecter ».
      </Sent>
    );
  return (
    <form ref={form} action={(fd) => { setEditing(false); return action(fd); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="next" value={next} />
      <EmailField state={state} />
      <PasswordField label="Mot de passe" autoComplete="new-password" hint="8 caractères au moins. Les mots de passe déjà apparus dans une fuite de données sont refusés." />
      {state.status === "error" && <p id="jj-mail-error" className="jj-error" role="alert">{state.message}</p>}
      <Submit>Créer mon compte</Submit>
    </form>
  );
}

function SignInForm({ next }: { next: string }) {
  const [forgot, setForgot] = useState(false);
  if (forgot) return <ForgotForm onBack={() => setForgot(false)} />;
  return (
    <form action={login} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="next" value={next} />
      <label className="jj-field">
        Adresse e-mail
        <input className="jj-input" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </label>
      <PasswordField label="Mot de passe" autoComplete="current-password" />
      <Submit>Entrer</Submit>
      <button type="button" className="jj-quill" onClick={() => setForgot(true)} style={{ alignSelf: "flex-start" }}>Mot de passe oublié ?</button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [state, action] = useActionState<PasswordState, FormData>(sendPasswordReset, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const left = useCountdown(state.status === "reset-sent" ? state.at : null);
  if (state.status === "reset-sent" && !editing)
    return (
      <Sent email={state.email} title="Regarde ta boîte mail." left={left} againLabel="Recommencer" again={() => setEditing(true)} onChange={() => setEditing(true)}>
        Si un compte existe pour <strong>{state.email}</strong>, un lien pour choisir un nouveau mot de passe vient de partir. Il est valable une heure.
      </Sent>
    );
  return (
    <form action={(fd) => { setEditing(false); return action(fd); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <EmailField state={state} />
      {state.status === "error" ? <p id="jj-mail-error" className="jj-error" role="alert">{state.message}</p> : <p className="jj-hint">On t’envoie un lien pour choisir un nouveau mot de passe.</p>}
      <Submit>Recevoir le lien</Submit>
      <button type="button" className="jj-quill" onClick={onBack} style={{ alignSelf: "flex-start" }}>← Retour</button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Envelope() {
  return (
    <svg className="jj-envelope" viewBox="0 0 120 84" width="120" height="84" aria-hidden="true">
      <motion.rect x="4" y="10" width="112" height="70" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2" initial={{ y: 24, opacity: 0 }} animate={{ y: 10, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }} />
      <motion.path d="M4 10 L60 52 L116 10" fill="none" stroke="var(--ink)" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.6, ease: EASE }} />
      <motion.circle cx="60" cy="56" r="11" fill="var(--ox)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: "spring", stiffness: 420, damping: 14 }} />
      <motion.path d="M55 56 L59 60 L66 52" fill="none" stroke="var(--paper)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.95, duration: 0.35 }} />
    </svg>
  );
}
