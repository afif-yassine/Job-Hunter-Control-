"use client";
import { Activity, ChevronRight, CircleHelp, FileText, Gauge, LogOut, Map as MapIcon, Settings, ShieldCheck } from "lucide-react";
import { logout } from "@/app/login/actions";
import { PageHead } from "@/components/ui";
import type { Ctx, View } from "./types";

const ITEMS: { id: View; label: string; text: string; icon: typeof Settings }[] = [
  { id: "documents", label: "Mes documents", text: "Tous tes CV et lettres, offre par offre", icon: FileText },
  { id: "questions", label: "Mes réponses", text: "Tes réponses aux questions des formulaires, réutilisées partout", icon: CircleHelp },
  { id: "settings", label: "Réglages", text: "Ton CV, tes métiers, ton compte", icon: Settings },
  { id: "roadmap", label: "Feuille de route", text: "Ce qui marche, ce qui est en cours, ce qui arrive", icon: MapIcon },
];

export function MoreView({ ctx, badge }: { ctx: Ctx; badge: (id: View) => number }) {
  const items = ctx.status?.isAdmin
    ? [
        ...ITEMS,
        { id: "activity" as View, label: "Activité", text: "Journal technique des recherches (admin)", icon: Activity },
        { id: "admin" as View, label: "Espace admin", text: "Croissance, niveaux, coûts, sources d’offres", icon: Gauge },
      ]
    : ITEMS;
  return (
    <>
      <PageHead title="Plus" />
      <div className="card list">
        {items.map(({ id, label, text, icon: Icon }) => (
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
