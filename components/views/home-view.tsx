"use client";
import { scoreOf } from "@/lib/fit";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CircleCheck,
  CircleHelp,
  LoaderCircle,
  Play,
  Send,
  Settings,
  TriangleAlert,
  Check,
  ShieldAlert,
} from "lucide-react";
import { openQuestionCount } from "@/components/questions-panel";
import { Callout, PageHead, Progress } from "@/components/ui";
import { kitsByJob, stageOf, todayTasks, TRACK } from "@/lib/journey";
import { OfferCard } from "./offer-card";
import { summarize } from "@/lib/pipeline-client";
import { timeAgo } from "@/lib/labels";
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
  const openQuestions = openQuestionCount(questions);
  const toReview = jobs.filter((j) => j.review_flag && j.status !== "SKIPPED").length;

  // Known to have no CV yet: the CV comes first. Unknown (undefined) changes nothing.
  const noProfile = ctx.hasProfile === false;
  const noSource = status ? !status.scanConfigured : false;
  const lastRun = runs.find((r) => r.run_type === "PIPELINE");
  const last = status?.lastScanAt ?? lastRun?.created_at ?? null;

  // What is left to set up, most important first.
  const setup: { tone: "bad" | "warn"; title: string; text: string; cta?: string; view?: "settings" }[] = [];
  if (status?.isAdmin) {
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
  const isAdmin = status?.isAdmin === true;
  // A free account never writes documents or reads forms by itself: only the steps that really happen are shown.
  const steps = status?.plan?.plan === "free" ? STEPS.slice(0, 2) : STEPS;
  const phaseAt = p ? steps.findIndex((s) => s.id === p.phase) : -1;
  const phaseIndex = p && phaseAt < 0 ? steps.length - 1 : phaseAt;
  const report = pipeline.report;
  // A student gets one discreet card; the full search block (counters, steps, explanations) is for the administrator.
  const showStudentCard = !running && Boolean(status) && !isAdmin && !noSource;

  const tasks = todayTasks(jobs);
  const kits = kitsByJob(documents);
  const counts = Object.fromEntries(TRACK.map((c) => [c.id, jobs.filter((j) => c.stages.includes(stageOf(j))).length])) as Record<string, number>;
  const fresh = jobs.filter((j) => stageOf(j) === "new" && !j.review_flag && !j.gone_reason);
  const freshTop = [...fresh]
    .sort((a, b) => scoreOf(b) - scoreOf(a))
    .slice(0, 4);
  const plan = status?.plan;

  // Small things that still block a step, shown after the journey tasks.
  const extras: { icon: typeof CircleHelp; title: string; text: string; onClick: () => void }[] = [];
  if (openQuestions)
    extras.push({
      icon: CircleHelp,
      title: `${openQuestions} question${openQuestions > 1 ? "s" : ""} de formulaire`,
      text: "Réponds une fois, on la reprend dans toutes tes candidatures.",
      onClick: () => go("questions"),
    });
  if (toReview)
    extras.push({
      icon: ShieldAlert,
      title: `${toReview} offre${toReview > 1 ? "s" : ""} à vérifier`,
      text: "Suspecte ou en double : c’est toi qui décides.",
      onClick: () => go("jobs", "review"),
    });

  return (
    <>
      <PageHead title="Accueil" subtitle="Où en est chacune de tes candidatures, et ce qui t’attend aujourd’hui." />
      {noProfile && (
        <section className="card cv-cta cv-first" aria-label="Importer mon CV">
          <div>
            <strong>Commence par ton CV</strong>
            <p className="muted small-text">
              Dépose ton CV en PDF une seule fois : on classe les offres selon ton profil et on prépare ton CV et ta lettre à partir de lui.
              Rien n’est inventé, et tu vérifies tout avant d’enregistrer.
            </p>
          </div>
          <button className="btn big" onClick={() => go("settings")}>
            Importer mon CV
          </button>
        </section>
      )}
      <section className="journey-strip" aria-label="Où en sont tes candidatures">
        {TRACK.map((c) => (
          <button key={c.id} className="journey-count card" onClick={() => go("track")}>
            <strong>{counts[c.id]}</strong>
            <span>{c.label}</span>
          </button>
        ))}
      </section>

      {plan && plan.limit !== null && (
        <div className={`plan-card card${plan.used >= plan.limit ? " is-full" : ""}`}>
          <div>
            <strong>Offre gratuite</strong>
            <span className="muted small-text">
              {plan.used >= plan.limit
                ? `Tes ${plan.limit} dossiers du mois sont utilisés. Les prochains arrivent le ${plan.resetsOn}.`
                : `${plan.limit - plan.used} dossier${plan.limit - plan.used > 1 ? "s" : ""} (CV + lettre) restant${plan.limit - plan.used > 1 ? "s" : ""} ce mois-ci. Recherche et suivi illimités.`}
            </span>
          </div>
          <span className="plan-dots" aria-label={`${plan.used} sur ${plan.limit} utilisés`}>
            {Array.from({ length: plan.limit }, (_, i) => (
              <span key={i} className={i < plan.used ? "is-used" : ""} />
            ))}
          </span>
        </div>
      )}

      {(!noProfile || tasks.length > 0 || extras.length > 0) && (
      <section aria-label="À faire aujourd’hui">
        <h2 className="section-title">À faire aujourd’hui</h2>
        {tasks.length || extras.length ? (
          <div className="todo-grid">
            {tasks.slice(0, 6).map((t) => (
              <button key={`${t.kind}-${t.job.id}`} className={`todo card is-${t.kind}`} onClick={() => ctx.openOffer(t.job)}>
                <span className="todo-icon">
                  {t.kind === "interview" ? <CalendarDays size={20} aria-hidden /> : t.kind === "follow-up" ? <BellRing size={20} aria-hidden /> : <Send size={20} aria-hidden />}
                </span>
                <span className="todo-text">
                  <strong>{t.label}</strong>
                  <span className="muted">
                    {t.job.title} · {t.job.company}
                    {t.when ? ` · ${new Date(t.when).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                  </span>
                </span>
                <ArrowRight size={18} aria-hidden />
              </button>
            ))}
            {extras.map((item) => (
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
            <CircleCheck aria-hidden /> Rien d’urgent. Ouvre une nouvelle offre pour avancer.
          </div>
        )}
      </section>
      )}

      {freshTop.length > 0 && (
        <section aria-label="Nouvelles offres">
          <div className="section-row">
            <h2 className="section-title">Nouvelles offres pour toi</h2>
            <button className="btn ghost small" onClick={() => go("jobs", "new")}>
              Toutes les nouvelles ({fresh.length})
            </button>
          </div>
          <div className="offers">
            {freshTop.map((job) => (
              <OfferCard key={job.id} job={job} kit={kits.get(job.id)} onOpen={ctx.openOffer} />
            ))}
          </div>
        </section>
      )}
      <h2 className="section-title">Ta recherche</h2>
      {!noProfile && (
        <div className="card cv-cta">
          <div>
            <strong>Ton CV</strong>
            <p className="muted small-text">Importé une fois en PDF : tous tes CV et lettres partent de lui, rien n’est inventé.</p>
          </div>
          <button className="btn secondary" onClick={() => go("settings")}>
            Importer ou mettre à jour
          </button>
        </div>
      )}

      {showStudentCard && (
        <section className="card refresh-card" aria-label="Mise à jour des offres">
          <div>
            <strong>Tes offres</strong>
            <p className="muted small-text">
              {last ? `Dernière mise à jour : ${timeAgo(last)}.` : "Pas encore de mise à jour."} Rien n’est jamais envoyé sans toi.
            </p>
          </div>
          <button className="btn secondary" disabled={Boolean(ctx.busy)} onClick={() => void pipeline.start()}>
            <Play size={16} aria-hidden /> Mettre à jour mes offres
          </button>
        </section>
      )}

      {!showStudentCard && (
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
              {steps.map((step, i) => {
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
              value={p ? ((Math.max(phaseIndex, 0) + (p.total ? p.done / p.total : 0)) / steps.length) * 100 : 0}
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
                      ? `Dernière recherche : ${timeAgo(last)}${status?.scheduledScan ? " · automatique sur le serveur" : status?.autoScan ? " · automatique à l’ouverture" : ""}`
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
            {isAdmin && status?.usage && (
              <p className="usage" aria-label="Utilisation aujourd’hui">
                Aujourd’hui :
                {(
                  [
                    ["scan", "recherches"],
                    ["analysis", "analyses"],
                    ["generation", "CV + lettres"],
                  ] as const
                ).map(([kind, label]) => {
                  const u = status.usage![kind];
                  if (!u.limit) return null;
                  return (
                    <span key={kind} className={u.used >= u.limit ? "full" : ""}>
                      <b>
                        {u.used}/{u.limit}
                      </b>{" "}
                      {label}
                    </span>
                  );
                })}
              </p>
            )}
            {isAdmin && (
              <p className="muted small-text">
                Ce que fait « Lancer la recherche » : cherche les nouvelles offres et calcule ton score
                {status?.plan?.plan === "free" ? ". Tu choisis ensuite les offres pour lesquelles écrire ton CV et ta lettre." : ", puis écrit CV + lettre pour celles ≥ 80."}{" "}
                <strong>Rien n’est jamais envoyé sans toi.</strong>
              </p>
            )}
          </>
        )}
      </section>
      )}

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
                <button className="btn secondary small" onClick={() => go("jobs", "all")}>
                  Voir
                </button>
              }
            >
              Ces annonces sont protégées : ouvre-les et colle leur texte pour les analyser.
            </Callout>
          )}
          {report.issues.length > 0 && !isAdmin && (
            <p className="muted small-text">Quelques offres n’ont pas pu être traitées cette fois. Réessaie dans quelques minutes.</p>
          )}
          {report.issues.length > 0 && isAdmin && (
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

    </>
  );
}

