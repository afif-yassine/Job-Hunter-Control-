"use client";
import {
  ArrowRight,
  CircleCheck,
  CircleHelp,
  FileText,
  LoaderCircle,
  Play,
  Search,
  Settings,
  TriangleAlert,
  Check,
} from "lucide-react";
import { openQuestionCount } from "@/components/questions-panel";
import { Callout, Chip, PageHead, Progress, ScoreBadge } from "@/components/ui";
import { summarize } from "@/lib/pipeline-client";
import { sourceLabel, timeAgo } from "@/lib/labels";
import type { Ctx } from "./types";

const STEPS = [
  { id: "scan", label: "Chercher les offres" },
  { id: "analyze", label: "Calculer ton score" },
  { id: "generate", label: "Écrire CV et lettre" },
  { id: "prepare", label: "Lire les formulaires" },
] as const;

export function HomeView({ ctx }: { ctx: Ctx }) {
  const { data, status, pipeline, go } = ctx;
  const { jobs, documents, questions, runs } = data;
  const replaced = new Set(documents.map((d) => d.based_on_document_id).filter(Boolean));
  const toApprove = documents.filter((d) => !d.approved && !replaced.has(d.id)).length;
  const openQuestions = openQuestionCount(questions);
  const missing = jobs.filter((j) => j.status === "DISCOVERED" && !j.description).length;
  const best = jobs.filter((j) => (j.match_score ?? 0) >= 80).length;
  const ready = jobs.filter((j) => j.status === "WAITING_APPROVAL" || j.status === "PREPARED").length;
  const top = [...jobs]
    .filter((j) => (j.match_score ?? 0) >= 60)
    .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    .slice(0, 5);

  const noSource = status ? !status.scanConfigured : false;
  const lastRun = runs.find((r) => r.run_type === "PIPELINE");
  const last = status?.lastScanAt ?? lastRun?.created_at ?? null;

  // What is left to set up, most important first.
  const setup: { tone: "bad" | "warn"; title: string; text: string; cta?: string; view?: "settings" }[] = [];
  if (status) {
    if (!status.scanConfigured)
      setup.push({
        tone: "bad",
        title: "Connecte une source d’offres",
        text: "C’est ce qui permet de chercher sur tout internet (LinkedIn, Indeed, Welcome to the Jungle…). 3 minutes, gratuit.",
        cta: "Connecter maintenant",
        view: "settings",
      });
    if (!status.gemini)
      setup.push({
        tone: "bad",
        title: "Clé Gemini manquante",
        text: "Sans elle, impossible de calculer les scores et d’écrire les documents. Ajoute GEMINI_API_KEY dans Vercel.",
      });
    if (status.worker && !status.workerOnline)
      setup.push({
        tone: "warn",
        title: "Le worker Playwright est hors ligne",
        text: "Les offres et les documents fonctionnent, mais les formulaires ne seront pas lus. Vérifie le service Railway.",
      });
    else if (status.worker && status.workerBrowserReady === false)
      setup.push({
        tone: "warn",
        title: "Le navigateur du worker s’installe",
        text: "Railway doit finir de se mettre à jour (2 à 3 minutes). Les formulaires seront lus ensuite.",
      });
  }

  const running = pipeline.running;
  const p = pipeline.progress;
  const phaseIndex = p ? STEPS.findIndex((s) => s.id === p.phase) : -1;
  const report = pipeline.report;

  const todo: { icon: typeof CircleHelp; count: number; title: string; text: string; onClick: () => void }[] = [];
  if (openQuestions)
    todo.push({
      icon: CircleHelp,
      count: openQuestions,
      title: `${openQuestions} question${openQuestions > 1 ? "s" : ""} à répondre`,
      text: "L’assistant a besoin de toi avant de continuer.",
      onClick: () => go("questions"),
    });
  if (toApprove)
    todo.push({
      icon: FileText,
      count: toApprove,
      title: `${toApprove} document${toApprove > 1 ? "s" : ""} à valider`,
      text: "Relis ton CV et ta lettre, puis approuve-les.",
      onClick: () => go("documents"),
    });
  if (missing)
    todo.push({
      icon: Search,
      count: missing,
      title: `${missing} offre${missing > 1 ? "s" : ""} à compléter`,
      text: "L’annonce n’a pas pu être lue : colle son texte.",
      onClick: () => go("jobs", "missing"),
    });

  return (
    <>
      <PageHead title="Accueil" subtitle="Cherche, choisis, postule : l’assistant prépare tout, tu valides." />

      <section className="hero card">
        {running ? (
          <>
            <div className="hero-top">
              <LoaderCircle className="spin" aria-hidden />
              <div>
                <h2>Recherche en cours…</h2>
                <p className="muted">{p?.label}</p>
              </div>
              <button className="btn ghost" onClick={pipeline.cancel}>
                Arrêter
              </button>
            </div>
            <ol className="steps">
              {STEPS.map((step, i) => {
                const state = i < phaseIndex ? "done" : i === phaseIndex ? "active" : "todo";
                return (
                  <li key={step.id} className={state}>
                    <span className="stepdot">{state === "done" ? <Check size={14} aria-hidden /> : i + 1}</span>
                    <span>
                      {step.label}
                      {state === "active" && p && p.total > 1 && (
                        <small>
                          {" "}
                          {p.done}/{p.total}
                        </small>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            <Progress
              value={p ? ((Math.max(phaseIndex, 0) + (p.total ? p.done / p.total : 0)) / STEPS.length) * 100 : 0}
            />
          </>
        ) : (
          <>
            <div className="hero-top">
              <div>
                <h2>{noSource ? "Connecte une source pour commencer" : "Prêt à chercher"}</h2>
                <p className="muted">
                  {noSource
                    ? "Une clé gratuite suffit pour chercher sur tout internet."
                    : last
                      ? `Dernière recherche : ${timeAgo(last)}${status?.autoScan ? " · automatique à l’ouverture" : ""}`
                      : "Aucune recherche pour l’instant."}
                </p>
              </div>
            </div>
            <div className="hero-cta">
              {noSource ? (
                <button className="btn big" onClick={() => go("settings")}>
                  <Settings size={18} aria-hidden /> Connecter une source
                </button>
              ) : (
                <button className="btn big" disabled={Boolean(ctx.busy) || !status} onClick={() => void pipeline.start()}>
                  <Play size={18} aria-hidden /> Lancer la recherche
                </button>
              )}
              {!noSource && (
                <button
                  className="btn secondary"
                  disabled={Boolean(ctx.busy)}
                  onClick={() => void pipeline.start({ scan: false })}
                  title="Analyse et prépare les offres déjà présentes, sans chercher de nouvelles offres"
                >
                  Traiter les offres en attente
                </button>
              )}
            </div>
            <p className="muted small-text">
              Ce que fait « Lancer la recherche » : cherche les nouvelles offres, calcule ton score, écrit CV + lettre
              pour celles ≥ 80, puis lit le formulaire. <strong>Rien n’est jamais envoyé sans toi.</strong>
            </p>
          </>
        )}
      </section>

      {report && !running && (
        <section className="card result">
          <div className="result-head">
            <CircleCheck className={report.issues.length ? "warn-ico" : "ok-ico"} aria-hidden />
            <div>
              <h2>{report.cancelled ? "Recherche arrêtée" : "Recherche terminée"}</h2>
              <p>{summarize(report)}</p>
            </div>
            <button className="btn ghost small" onClick={pipeline.dismiss}>
              Fermer
            </button>
          </div>
          {report.needsDescription > 0 && (
            <Callout
              tone="info"
              title={`${report.needsDescription} offre${report.needsDescription > 1 ? "s" : ""} à compléter`}
              action={
                <button className="btn secondary small" onClick={() => go("jobs", "missing")}>
                  Voir
                </button>
              }
            >
              Ces annonces sont protégées : ouvre-les et colle leur texte pour les analyser.
            </Callout>
          )}
          {report.issues.length > 0 && (
            <div className="issues">
              <h3>
                <TriangleAlert size={16} aria-hidden /> {report.issues.length} problème{report.issues.length > 1 ? "s" : ""}
              </h3>
              <ul>
                {report.issues.slice(0, 5).map((issue, i) => (
                  <li key={i}>
                    <strong>{issue.where}</strong> — {issue.title}
                    {issue.hint && <span className="muted"> {issue.hint}</span>}
                  </li>
                ))}
              </ul>
              {report.issues.length > 5 && (
                <button className="btn ghost small" onClick={() => go("activity")}>
                  Tout voir dans l’activité
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {setup.length > 0 && (
        <section className="stack" aria-label="À configurer">
          {setup.map((item) => (
            <Callout
              key={item.title}
              tone={item.tone}
              title={item.title}
              action={
                item.view ? (
                  <button className="btn small" onClick={() => go(item.view!)}>
                    {item.cta}
                  </button>
                ) : undefined
              }
            >
              {item.text}
            </Callout>
          ))}
        </section>
      )}

      <section aria-label="À faire">
        <h2 className="section-title">À faire pour toi</h2>
        {todo.length ? (
          <div className="todo-grid">
            {todo.map((item) => (
              <button key={item.title} className="todo card" onClick={item.onClick}>
                <span className="todo-icon">
                  <item.icon size={20} aria-hidden />
                </span>
                <span className="todo-text">
                  <strong>{item.title}</strong>
                  <span className="muted">{item.text}</span>
                </span>
                <ArrowRight size={18} aria-hidden />
              </button>
            ))}
          </div>
        ) : (
          <div className="card allgood">
            <CircleCheck aria-hidden /> Tout est à jour. Lance une recherche pour trouver de nouvelles offres.
          </div>
        )}
      </section>

      <section className="stats" aria-label="Chiffres">
        <Stat value={jobs.length} label="Offres" onClick={() => go("jobs", "all")} />
        <Stat value={best} label="Très bonnes (≥ 80)" onClick={() => go("jobs", "best")} />
        <Stat value={ready} label="Dossiers prêts" onClick={() => go("jobs", "ready")} />
        <Stat value={documents.length} label="Documents" onClick={() => go("documents")} />
      </section>

      {top.length > 0 && (
        <section aria-label="Meilleures offres">
          <div className="section-row">
            <h2 className="section-title">Tes meilleures offres</h2>
            <button className="btn ghost small" onClick={() => go("jobs", "best")}>
              Tout voir
            </button>
          </div>
          <div className="card list">
            {top.map((job) => (
              <button key={job.id} className="row" onClick={() => go("jobs", "all")}>
                <ScoreBadge score={job.match_score} />
                <span className="row-main">
                  <strong>{job.title}</strong>
                  <span className="muted">
                    {job.company} · {job.location || "—"} · {sourceLabel(job.source_platform, job.source_url)}
                  </span>
                </span>
                <Chip tone={job.status === "WAITING_APPROVAL" ? "good" : "neutral"}>
                  {job.status === "WAITING_APPROVAL" ? "Dossier prêt" : "Analysée"}
                </Chip>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Stat({ value, label, onClick }: { value: number; label: string; onClick: () => void }) {
  return (
    <button className="stat card" onClick={onClick}>
      <strong>{value}</strong>
      <span className="muted">{label}</span>
    </button>
  );
}
