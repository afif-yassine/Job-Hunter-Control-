"use client";
import { Activity, BriefcaseBusiness, ChevronRight, LogOut, Settings, ShieldCheck } from "lucide-react";
import { logout } from "@/app/login/actions";
import { PageHead } from "@/components/ui";
import type { Ctx, View } from "./types";

const ITEMS: { id: View; label: string; text: string; icon: typeof Settings }[] = [
  { id: "applications", label: "Candidatures", text: "État de chaque dossier et de son formulaire", icon: BriefcaseBusiness },
  { id: "activity", label: "Activité", text: "Journal et notifications", icon: Activity },
  { id: "settings", label: "Réglages", text: "Sources d’offres, recherche, connexions", icon: Settings },
];

export function MoreView({ ctx, badge }: { ctx: Ctx; badge: (id: View) => number }) {
  return (
    <>
      <PageHead title="Plus" />
      <div className="card list">
        {ITEMS.map(({ id, label, text, icon: Icon }) => (
          <button key={id} className="row" onClick={() => ctx.go(id)}>
            <span className="todo-icon">
              <Icon size={20} aria-hidden />
            </span>
            <span className="row-main">
              <strong>
                {label} {badge(id) > 0 && <b className="badge inline">{badge(id)}</b>}
              </strong>
              <span className="muted">{text}</span>
            </span>
            <ChevronRight size={18} aria-hidden />
          </button>
        ))}
      </div>
      <div className="card stack" style={{ marginTop: 16 }}>
        <span className="chip good">
          <ShieldCheck size={13} aria-hidden /> Mode sécurisé : jamais d’envoi automatique
        </span>
        {ctx.userEmail && <p className="muted">Connecté : {ctx.userEmail}</p>}
        {ctx.userEmail && (
          <form action={logout}>
            <button className="btn secondary">
              <LogOut size={16} aria-hidden /> Déconnexion
            </button>
          </form>
        )}
      </div>
    </>
  );
}
