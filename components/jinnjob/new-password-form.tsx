"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setNewPassword, type PasswordState } from "@/app/login/actions";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button className="jj-ribbon" type="submit" disabled={pending} aria-busy={pending} style={{ width: "100%", justifyContent: "center" }}>
      {pending ? "Enregistrement…" : "Enregistrer mon mot de passe"}
    </button>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState<PasswordState, FormData>(setNewPassword, { status: "idle" });
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="jj-field">
        Nouveau mot de passe
        <input className="jj-input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </label>
      <label className="jj-field">
        Encore une fois
        <input className="jj-input" name="again" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </label>
      {state.status === "error" && <p className="jj-error" role="alert">{state.message}</p>}
      <Save />
    </form>
  );
}
