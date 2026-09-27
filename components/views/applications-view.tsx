"use client";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { Chip, Empty, PageHead } from "@/components/ui";
import { cleanRaw, explainError } from "@/lib/errors";
import { applicationStatus, timeAgo } from "@/lib/labels";
import { runSummary } from "@/lib/run-summary";
import type { Ctx } from "./types";

export function ApplicationsView({ ctx }: { ctx: Ctx }) {
  const { data, act, busy } = ctx;
  const jobs = new Map(data.jobs.map((j) => [j.id, j]));

  if (!data.apps.length)
    return (
      <>
        <PageHead title="Candidatures" subtitle="Les dossiers prêts à envoyer, avec l’état de leur formulaire." />
        <Empty
          title="Aucune candidature pour l’instant"
          text="Une candidature est créée dès que les documents d’une offre sont rédigés."
          action={
            <button className="btn" onClick={() => ctx.go("jobs", "todo")}>
              Voir les offres à traiter
            </button>
          }
        />
      </>
    );

  return (
    <>
      <PageHead
        title="Candidatures"
        subtitle="« Lire le formulaire » ouvre la page de candidature et repère les champs. Rien n’est jamais envoyé."
      />
      <div className="cards">
        {data.apps.map((app) => {
          const status = applicationStatus(app.status);
          const job = app.job_id ? jobs.get(app.job_id) : undefined;
          const url = job?.official_url || job?.source_url;
          const lastRun = data.runs.find(
            (r) => r.run_type.startsWith("PLAYWRIGHT") && r.counters?.applicationId === app.id,
          );
          const problem = lastRun?.status === "FAILED" ? explainError(cleanRaw(lastRun.error_message || "")) : null;
          const working = busy === app.id;
          return (
            <article key={app.id} className="card jobcard">
              <div className="jobhead">
                <div className="jobtitle">
                  <h3>{app.jobs?.title || "Offre"}</h3>
                  <p className="muted">{app.jobs?.company || "—"}</p>
                </div>
                <Chip tone={status.tone}>{status.label}</Chip>
              </div>
              {lastRun && (
                <p className={problem ? "error-text" : "muted"}>
                  {problem ? (
                    <>
                      <strong>{problem.title}.</strong> {problem.hint}
                    </>
                  ) : (
                    <>
                      Dernière lecture {timeAgo(lastRun.created_at)} · {runSummary(lastRun)}
                    </>
                  )}
                </p>
              )}
              <div className="jobactions">
                <button className="btn" disabled={Boolean(busy)} onClick={() => void act.prepare(app.id)}>
                  {working && <LoaderCircle size={16} className="spin" aria-hidden />}
                  {lastRun ? (problem ? "Réessayer" : "Relire le formulaire") : "Lire le formulaire"}
                </button>
                {url && (
                  <a className="btn secondary" href={url} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} aria-hidden /> Postuler sur le site
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
