"use client";
import { useCallback, useEffect, useState } from "react";
import {
  BellRing,
  Bot,
  CircleAlert,
  CircleCheck,
  GraduationCap,
  Globe,
  LoaderCircle,
  RefreshCw,
  Server,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Callout, Chip, PageHead, Progress } from "@/components/ui";
import type { AdminAction, AdminOverview, AdminSource, SourceState } from "@/lib/admin/overview";
import { timeAgo } from "@/lib/labels";
import type { Ctx } from "./types";

type ChipTone = "good" | "warn" | "bad" | "info" | "neutral";

const TONE: Record<SourceState, ChipTone> = {
  active: "good",
  idle: "info",
  optional: "neutral",
  missing_key: "warn",
  quota: "warn",
  budget: "warn",
  auth: "bad",
  error: "bad",
};

const LEVEL: Record<AdminAction["level"], { label: string; tone: ChipTone }> = {
  required: { label: "Obligatoire", tone: "bad" },
  recommended: { label: "Conseillé", tone: "warn" },
  before_launch: { label: "Avant l’ouverture", tone: "info" },
};

const ORIGIN: Record<AdminSource["keyOrigin"], string> = {
  platform: "clé plateforme (Vercel)",
  account: "clé de ton compte seulement",
  none: "",
  not_needed: "",
};

function periodLabel(period: string) {
  if (period === "all") return "au total";
  return period.length === 7 ? "ce mois-ci" : "aujourd’hui";
}

/** Platform health in one page: AI, offer sources, automation, what to do. */
export function AdminView({ ctx }: { ctx: Ctx }) {
  const [data, setData] = useState<AdminOverview | null>(ctx.adminDemo ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!ctx.adminDemo);

  const load = useCallback(async () => {
    if (ctx.adminDemo) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/overview");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setData(body as AdminOverview);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [ctx.adminDemo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const refresh = (
    <button className="btn secondary" onClick={() => void load()} disabled={loading}>
      {loading ? <LoaderCircle size={16} className="spin" aria-hidden /> : <RefreshCw size={16} aria-hidden />} Actualiser
    </button>
  );

  if (!data)
    return (
      <>
        <PageHead title="Admin" subtitle="Santé de la plateforme." actions={refresh} />
        {error ? (
          <Callout tone="bad" title="Impossible de charger la page admin">
            {error}
          </Callout>
        ) : (
          <div className="empty">
            <LoaderCircle className="spin" aria-hidden /> Chargement…
          </div>
        )}
      </>
    );

  const required = data.actions.filter((a) => a.level === "required");
  const active = data.sources.filter((s) => s.state === "active").length;
  const available = data.sources.filter((s) => s.state !== "optional").length;

  return (
    <>
      <PageHead
        title="Admin"
        subtitle={`IA, points de recherche et automatisation — ${active}/${available} sources en service.`}
        actions={refresh}
      />

      {/* 1. What to do by hand ------------------------------------------------ */}
      <section className="admin-section">
        <h2 className="section-title">
          <TriangleAlert size={18} aria-hidden /> À faire manuellement
        </h2>
        {required.length === 0 && (
          <Callout tone="good" title="Rien d’obligatoire">
            La plateforme fonctionne. Les points ci-dessous améliorent la couverture ou préparent l’ouverture.
          </Callout>
        )}
        <ul className="card actions-list">
          {data.actions.map((a, i) => (
            <li key={i}>
              <Chip tone={LEVEL[a.level].tone}>{LEVEL[a.level].label}</Chip>
              <span>{a.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. AI -------------------------------------------------------------------- */}
      <section className="admin-section">
        <h2 className="section-title">
          <Bot size={18} aria-hidden /> Génération IA
        </h2>
        <div className="card kv">
          <div>
            <span>API IA</span>
            <strong>{data.ai.provider}</strong>
            <Chip tone={data.ai.configured ? "good" : "bad"}>{data.ai.configured ? "Activée" : "Clé manquante"}</Chip>
          </div>
          <div>
            <span>Modèle — analyse des offres</span>
            <code>{data.ai.analysisModel}</code>
          </div>
          <div>
            <span>Modèle — CV et lettres</span>
            <code>{data.ai.writingModel}</code>
          </div>
          <div>
            <span>Aujourd’hui (tous les comptes)</span>
            <strong>
              {data.ai.usageToday.analysis} analyses · {data.ai.usageToday.generation} CV + lettres ·{" "}
              {data.ai.usageToday.scan} recherches manuelles
            </strong>
          </div>
          <details className="why">
            <summary>Modèles moins chers : recommandations</summary>
            <ul>
              <li>
                <strong>Rédaction : </strong>
                {data.ai.advice.writing}
              </li>
              <li>
                <strong>Score : </strong>
                {data.ai.advice.scoring}
              </li>
              <li>
                <strong>Économies : </strong>
                {data.ai.advice.savings}
              </li>
            </ul>
          </details>
        </div>
      </section>

      {/* 3. Smart search (planned) -------------------------------------------------- */}
      <section className="admin-section">
        <h2 className="section-title">
          <Sparkles size={18} aria-hidden /> Recherche intelligente (embeddings)
        </h2>
        <div className="card kv">
          <div>
            <span>État</span>
            <Chip tone="info">{data.embeddings.status}</Chip>
          </div>
          <p className="muted">{data.embeddings.what}</p>
          <p className="muted small-text">{data.embeddings.tools}</p>
        </div>
      </section>

      {/* 4. Offer sources -------------------------------------------------------- */}
      <section className="admin-section">
        <h2 className="section-title">
          <Globe size={18} aria-hidden /> Points de recherche
        </h2>
        <ol className="sources">
          {data.sources.map((s) => (
            <SourceRow key={s.id} s={s} />
          ))}
        </ol>
        <details className="why">
          <summary>Non connectées volontairement ({data.notConnected.length})</summary>
          <ul>
            {data.notConnected.map((n) => (
              <li key={n.name}>
                <strong>{n.name}</strong> — {n.why}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* 4b. Enrichment (extra France Travail APIs) ------------------------------- */}
      <section className="admin-section">
        <h2 className="section-title">
          <GraduationCap size={18} aria-hidden /> Enrichissement (France Travail)
        </h2>
        <p className="muted small-text">
          API gratuites, mêmes identifiants que « Offres d’emploi ». Elles ne trouvent pas d’offres : elles
          enrichissent celles déjà trouvées (uniquement pour les offres venant de France Travail, qui seules portent
          un code ROME). Open Formation est souscrite mais pas utilisée : rien à configurer.
        </p>
        <ol className="sources">
          {data.enrichment.map((e) => (
            <li key={e.id} className="card source">
              <div className="source-head">
                <span className="source-n">{e.n}</span>
                <div className="source-name">
                  <strong>{e.name}</strong>
                  <span className="muted small-text">{e.covers}</span>
                </div>
                <Chip tone={e.unused ? "neutral" : e.ready ? "good" : "warn"}>
                  {e.unused ? "Non utilisée" : e.ready ? "Prêt" : "À terminer"}
                </Chip>
              </div>
              <p className="muted small-text">{e.usedFor}</p>
              <p className="muted small-text">{e.cost}</p>
              {!e.ready && !e.unused && (
                <div className="small-text warn-text">
                  À ajouter dans Vercel (Settings → Environment Variables) :
                  <dl className="env-values">
                    {e.missing.map((name) => {
                      const value = name === e.scopeVar ? e.scopeValue : name === e.urlVar ? e.urlValue : undefined;
                      return (
                        <div key={name}>
                          <dt>
                            <code>{name}</code>
                          </dt>
                          <dd>{value ? <code>{value}</code> : <span className="muted">tes identifiants francetravail.io</span>}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              )}
              {e.lastRun && (
                <p className={`small-text ${e.lastRun.status === "ok" ? "muted" : "warn-text"}`}>
                  Dernier appel {timeAgo(e.lastRun.at)} : {e.lastRun.status === "ok" ? "OK" : e.lastRun.message}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* 5. Automation & services ------------------------------------------------ */}
      <section className="admin-section">
        <h2 className="section-title">
          <Server size={18} aria-hidden /> Automatisation et services
        </h2>
        <div className="card kv">
          <div>
            <span>Recherche automatique (serveur)</span>
            <Chip tone={data.automation.cronConfigured ? "good" : "warn"}>
              {data.automation.cronConfigured ? "Configurée" : "Pas configurée"}
            </Chip>
            {data.automation.lastServerRun && <span className="muted small-text">dernier passage {timeAgo(data.automation.lastServerRun)}</span>}
          </div>
          <div>
            <span>Cache partagé entre comptes</span>
            <Chip tone={data.automation.sharedCache ? "good" : "warn"}>{data.automation.sharedCache ? "Actif" : "Inactif"}</Chip>
          </div>
          <div>
            <span>Robot Playwright (Railway)</span>
            <Chip tone={!data.worker.configured ? "warn" : data.worker.online ? "good" : "bad"}>
              {!data.worker.configured ? "Pas configuré" : data.worker.online ? "En ligne" : "Hors ligne"}
            </Chip>
          </div>
          <div>
            <span>Google Drive</span>
            <Chip tone={data.drive ? "good" : "warn"}>{data.drive ? "Connecté" : "Pas connecté"}</Chip>
          </div>
          <div>
            <span>Mode de sécurité</span>
            <Chip tone="good">PREPARE_ONLY — aucun envoi automatique</Chip>
          </div>
        </div>
      </section>

      {/* 6. Alerts ------------------------------------------------------------ */}
      <section className="admin-section">
        <h2 className="section-title">
          <BellRing size={18} aria-hidden /> Alertes des sources
        </h2>
        {data.alerts.length === 0 ? (
          <div className="card allgood">
            <CircleCheck aria-hidden /> Aucune alerte : pas de quota épuisé ni de source en panne.
          </div>
        ) : (
          <ul className="card actions-list">
            {data.alerts.map((a, i) => (
              <li key={i}>
                <CircleAlert size={16} aria-hidden className={a.title.startsWith("Source rétablie") ? "ok-ico" : "warn-ico"} />
                <span>
                  <strong>{a.title}</strong> — {a.message} <span className="muted small-text">· {timeAgo(a.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SourceRow({ s }: { s: AdminSource }) {
  const q = s.quality;
  const dupShare = q && q.links > 0 ? Math.max(0, Math.round((1 - q.offers / q.links) * 100)) : null;
  return (
    <li className="card source">
      <div className="source-head">
        <span className="source-n">{s.n}</span>
        <div className="source-name">
          <strong>{s.name}</strong>
          <span className="muted small-text">{s.covers}</span>
        </div>
        <Chip tone={TONE[s.state]}>{s.stateLabel}</Chip>
      </div>
      <div className="source-meta muted small-text">
        <span>{s.cost}</span>
        {ORIGIN[s.keyOrigin] && <span>· {ORIGIN[s.keyOrigin]}</span>}
        {s.companies !== null && <span>· {s.companies} entreprise{s.companies > 1 ? "s" : ""} suivie{s.companies > 1 ? "s" : ""}</span>}
      </div>
      {s.missingKeys.length > 0 && (
        <p className={`small-text ${s.state === "optional" ? "muted" : "warn-text"}`}>
          {s.state === "optional" ? "Pour l’activer, ajouter dans Vercel" : "À ajouter dans Vercel"} : {s.missingKeys.join(", ")}
        </p>
      )}
      {s.budget && (
        <div className="budget">
          <span className="small-text">
            Budget gratuit : <b>{s.budget.used}</b>/{s.budget.limit} appels {periodLabel(s.budget.period)}
          </span>
          <Progress value={s.budget.limit ? (s.budget.used / s.budget.limit) * 100 : 0} />
        </div>
      )}
      {s.lastRun && (
        <p className={`small-text ${s.lastRun.status === "ok" ? "muted" : "warn-text"}`}>
          Dernier passage {timeAgo(s.lastRun.at)} : {s.lastRun.status === "ok" ? `${s.lastRun.found} offre(s)${s.lastRun.cached ? " (cache)" : ""}` : s.lastRun.message}
          {s.runs7d.problems > 0 && ` · ${s.runs7d.problems} problème(s) en 7 j`}
        </p>
      )}
      {q && (
        <p className="small-text muted">
          30 j : {q.offers} offre{q.offers > 1 ? "s" : ""}
          {q.avgScore !== null && ` · score moyen ${q.avgScore}`}
          {q.strong > 0 && ` · ${q.strong} ≥ 80`}
          {dupShare !== null && dupShare > 0 && ` · ${dupShare} % doublons`}
          {q.suspected > 0 && ` · ${q.suspected} suspecte${q.suspected > 1 ? "s" : ""}`}
          {q.unreadable > 0 && ` · ${q.unreadable} illisible${q.unreadable > 1 ? "s" : ""}`}
        </p>
      )}
      {s.launchNote && s.keyOrigin !== "none" && <p className="small-text muted">Avant l’ouverture : {s.launchNote}</p>}
    </li>
  );
}
