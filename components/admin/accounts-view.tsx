"use client";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Users } from "lucide-react";
import { Callout } from "@/components/ui";
import type { AccountsPage } from "@/lib/admin/users";
import { costText, dateText, orDash, pageLabel, planText, UNKNOWN, yesNoOrDash } from "./admin-display";
import { OriginTag } from "./origin-tag";

const PER_PAGE = 25;

/**
 * The accounts of the platform, read only: dates, CV imported or not, plan, kits of the month, AI calls and
 * cost. Something the server could not read is a dash, never "non" or zero. No action, nothing is changed here.
 * The e-mail addresses are shown for the administrator only; they are never put in the address bar nor in a title.
 */
export function AccountsView({ demo }: { demo?: AccountsPage }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AccountsPage | null>(demo ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!demo);

  const load = useCallback(
    async (wanted: number) => {
      if (demo) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/users?page=${wanted}&perPage=${PER_PAGE}`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (response.status === 429) throw new Error("Trop de demandes : réessaie dans une minute.");
        if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
        setData(body as AccountsPage);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setLoading(false);
      }
    },
    [demo],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 0);
    return () => window.clearTimeout(timer);
  }, [load, page]);

  const shownPage = data?.page ?? page;
  return (
    <section className="grow-section" aria-labelledby="accounts-title">
      <h2 id="accounts-title" className="section-title">
        <Users size={18} aria-hidden /> Comptes
      </h2>
      <p className="muted small-text">Lecture seule : cette liste ne permet de rien modifier. Un tiret veut dire « inconnu », pas « non » ni zéro.{demo ? " Démo : données factices." : ""}</p>

      {error && (
        <Callout tone="warn" title="Liste des comptes indisponible">
          {error}{" "}
          <button className="linkbtn" onClick={() => void load(page)}>
            Réessayer
          </button>
        </Callout>
      )}

      {!data && !error && (
        <p className="muted">
          <LoaderCircle className="spin" size={16} aria-hidden /> Chargement des comptes…
        </p>
      )}

      {data && (
        <div className="card">
          <div className="grow-table-wrap" role="region" aria-label="Liste des comptes, défilement horizontal" tabIndex={0}>
            <table className="grow-table acc-table">
              <caption className="sr">Comptes de la plateforme, page {shownPage}</caption>
              <thead>
                <tr>
                  <th scope="col">Compte</th>
                  <th scope="col">Inscrit le</th>
                  <th scope="col">Dernière connexion</th>
                  <th scope="col">CV importé</th>
                  <th scope="col">Formule</th>
                  <th scope="col">Admin</th>
                  <th scope="col">Dossiers ce mois</th>
                  <th scope="col">Appels IA (30 j)</th>
                  <th scope="col">
                    Coût IA (30 j) <OriginTag origin={data.aiCostOrigin} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.userId}>
                    <th scope="row">{a.email ?? UNKNOWN}</th>
                    <td>{dateText(a.createdAt)}</td>
                    <td>{dateText(a.lastSignInAt)}</td>
                    <td>{yesNoOrDash(a.hasCv, "oui", "non")}</td>
                    <td>{planText(a.plan)}</td>
                    <td>{yesNoOrDash(a.isAdmin, "oui", "non")}</td>
                    <td>{orDash(a.kitsThisMonth, String)}</td>
                    <td>{orDash(a.aiCalls30d, String)}</td>
                    <td>{costText(a.aiCostUsd30d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="acc-nav" aria-label="Pages de la liste des comptes">
            <button className="btn secondary small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || Boolean(demo) || shownPage <= 1}>
              Précédent
            </button>
            <span className="muted small-text" role="status" aria-live="polite">
              {pageLabel({ page: shownPage, perPage: data.perPage, total: data.total, count: data.accounts.length })}
            </span>
            <button className="btn secondary small" onClick={() => setPage((p) => p + 1)} disabled={loading || Boolean(demo) || !data.hasMore}>
              Suivant
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}
