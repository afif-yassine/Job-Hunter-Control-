"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Gauge, Trophy, Users } from "lucide-react";
import { Mark, Wordmark } from "@/components/jinnjob/logo";
import { AdminView } from "@/components/views/admin-view";
import type { AdminOverview } from "@/lib/admin/overview";
import type { Growth } from "@/lib/admin/growth";
import type { GatewayCredits } from "@/lib/admin/gateway-credits";
import type { AccountsPage } from "@/lib/admin/users";
import { AccountsView } from "./accounts-view";
import type { Tone } from "@/lib/labels";
import { GrowthView } from "./growth-view";

type Tab = "growth" | "platform" | "accounts";
const TABS: { id: Tab; label: string; icon: typeof Gauge }[] = [
  { id: "growth", label: "Croissance", icon: Trophy },
  { id: "platform", label: "Plateforme", icon: Gauge },
  { id: "accounts", label: "Comptes", icon: Users },
];
/** The address bar only carries the name of the page, never data. */
const HASH: Record<Tab, string> = { growth: "#croissance", platform: "#plateforme", accounts: "#comptes" };
const tabFromHash = (hash: string): Tab => (hash === HASH.platform ? "platform" : hash === HASH.accounts ? "accounts" : "growth");

/** The admin space: its own header and pages, apart from the students' space. */
export function AdminApp({ email, demo }: { email: string; demo?: { growth: Growth; overview: AdminOverview; gateway?: GatewayCredits; accounts?: AccountsPage } }) {
  const [tab, setTab] = useState<Tab>("growth");
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const fromHash = () => setTab(tabFromHash(window.location.hash));
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const go = (next: Tab) => {
    setTab(next);
    try {
      window.history.replaceState(null, "", HASH[next]);
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  };

  const notify = useCallback((text: string, tone: Tone = "info") => {
    window.clearTimeout(timer.current);
    setToast(text ? { text, tone } : null);
    if (text && tone !== "bad") timer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  return (
    <div className="adm">
      <header className="adm-top">
        <Link className="adm-brand" href="/" aria-label="Retour à l’espace étudiant">
          <Mark size={34} intro={false} />
          <Wordmark size={22} />
          <span className="adm-stamp">QG admin</span>
        </Link>
        <nav className="adm-tabs" aria-label="Pages admin">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? "pill active" : "pill"} aria-current={tab === id ? "page" : undefined} onClick={() => go(id)}>
              <Icon size={15} aria-hidden /> {label}
            </button>
          ))}
        </nav>
        <div className="adm-who">
          <span className="muted small-text">{email}</span>
          <Link className="btn ghost small" href="/">
            <ArrowLeft size={15} aria-hidden /> Espace étudiant
          </Link>
        </div>
      </header>
      <main className="adm-main">
        {tab === "growth" ? (
          <GrowthView demo={demo?.growth} gatewayDemo={demo?.gateway} notify={notify} />
        ) : tab === "accounts" ? (
          <AccountsView demo={demo?.accounts} />
        ) : (
          <AdminView ctx={{ adminDemo: demo?.overview, notify }} />
        )}
      </main>
      {toast && (
        <div className={`toast ${toast.tone}`} role="status" onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
