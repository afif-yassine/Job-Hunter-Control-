"use client";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, LoaderCircle, RefreshCw } from "lucide-react";
import { Callout } from "@/components/ui";
import type { GatewayCredits } from "@/lib/admin/gateway-credits";
import { gapText, gatewayReasonText, UNKNOWN, usdFixed } from "./admin-display";
import { OriginTag } from "./origin-tag";

/**
 * The real balance of the AI key, read from Vercel: remaining credit, what the whole team spent,
 * what this application recorded, and the gap. One call when the page opens and a button; the route
 * is limited to 10 a minute, so nothing refreshes by itself.
 */
export function GatewayCreditsView({ demo }: { demo?: GatewayCredits }) {
  const [data, setData] = useState<GatewayCredits | null>(demo ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!demo);

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/gateway-credits", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (response.status === 429) throw new Error("Trop de demandes : réessaie dans une minute.");
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setData(body as GatewayCredits);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const g = data?.gateway;
  return (
    <section className="grow-section" aria-labelledby="credits-title">
      <h2 id="credits-title" className="section-title">
        <KeyRound size={18} aria-hidden /> Solde réel de la clé IA (Vercel)
      </h2>
      <div className="card gw">
        <div className="gw-head">
          <button className="btn secondary small" onClick={() => void load()} disabled={loading || Boolean(demo)}>
            <RefreshCw size={15} className={loading ? "spin" : undefined} aria-hidden /> Actualiser
          </button>
          <span className="muted small-text" role="status">
            {loading && !data ? (
              <>
                <LoaderCircle className="spin" size={14} aria-hidden /> Lecture du solde…
              </>
            ) : data ? (
              <>
                Lu le {new Date(data.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {demo ? " · démo" : ""}
              </>
            ) : null}
          </span>
        </div>

        {error && !data && (
          <Callout tone="warn" title="Solde indisponible">
            {error}
          </Callout>
        )}
        {error && data && <p className="grow-warn small-text">Dernière actualisation impossible : {error}</p>}

        {data && (
          <>
            {g && !g.available && (
              <Callout tone="warn" title="Solde indisponible">
                Le solde de la clé n’a pas pu être lu : {gatewayReasonText(g.reason)}. Ce n’est pas un solde de zéro.
              </Callout>
            )}
            <dl className="grow-per gw-figures">
              <div>
                <dt>Crédit restant</dt>
                <dd>
                  {g?.available ? usdFixed(g.balanceUsd) : UNKNOWN} {g && <OriginTag origin={g.origin} />}
                </dd>
              </div>
              <div>
                <dt>Total dépensé (Gateway)</dt>
                <dd>{g?.available ? usdFixed(g.totalUsedUsd) : UNKNOWN}</dd>
              </div>
              <div>
                <dt>Enregistré par l’application</dt>
                <dd>
                  {data.recorded ? usdFixed(data.recorded.usd) : UNKNOWN} {data.recorded && <OriginTag origin={data.recorded.origin} />}
                </dd>
              </div>
              <div>
                <dt>Écart</dt>
                <dd>{gapText(data.gapUsd)}</dd>
              </div>
            </dl>
            {data.recorded && (
              <p className="muted small-text">
                L’application a enregistré {data.recorded.calls} appels
                {data.recorded.unpricedCalls > 0 ? `, dont ${data.recorded.unpricedCalls} sans coût enregistré` : ""}.
              </p>
            )}
            {g?.available && <p className="muted small-text">Portée : {g.scope}</p>}
            <p className="muted small-text">{data.note}</p>
            <p className="muted small-text">Le plafond de 2 USD de la clé n’apparaît pas ici : il se règle côté Vercel et ne dépend pas du crédit acheté.</p>
          </>
        )}
      </div>
    </section>
  );
}
