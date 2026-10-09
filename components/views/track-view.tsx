"use client";
import { useMemo, useState } from "react";
import { BellRing, CalendarDays } from "lucide-react";
import { Empty, PageHead } from "@/components/ui";
import { followUpDue, kitsByJob, stageOf, TRACK } from "@/lib/journey";
import { Milestones, ScoreRing } from "./offer-card";
import type { Ctx } from "./types";

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;

/** "Mon suivi": one column per step, every offer the student is working on. */
export function TrackView({ ctx }: { ctx: Ctx }) {
  const { data, openOffer } = ctx;
  const kits = useMemo(() => kitsByJob(data.documents), [data.documents]);
  const [tab, setTab] = useState(TRACK[0].id);
  const [showDismissed, setShowDismissed] = useState(false);

  const columns = useMemo(
    () =>
      TRACK.map((col) => ({
        ...col,
        jobs: data.jobs
          .filter((j) => col.stages.includes(stageOf(j)))
          .sort((a, b) => Date.parse(b.stage_at ?? b.created_at ?? "") - Date.parse(a.stage_at ?? a.created_at ?? "")),
      })),
    [data.jobs],
  );
  const dismissed = data.jobs.filter((j) => stageOf(j) === "dismissed");
  const total = columns.reduce((n, c) => n + c.jobs.length, 0);

  return (
    <>
      <PageHead title="Mon suivi" subtitle="Chaque offre que tu as ouverte, de la préparation jusqu’à la réponse. Clique une carte pour avancer." />
      {/* At the top, where an offer put aside can be found again. */}
      {dismissed.length > 0 && (
        <div className="track-dismissed">
          <button className="linkbtn small-text" onClick={() => setShowDismissed((v) => !v)}>
            {showDismissed ? "Masquer" : "Voir"} {dismissed.length > 1 ? `les ${dismissed.length} offres écartées` : "l’offre écartée"}
          </button>
          {showDismissed && (
            <div className="card list">
              {dismissed.map((job) => (
                <button key={job.id} className="row" onClick={() => openOffer(job)}>
                  <span className="row-main">
                    <strong>{job.title}</strong>
                    <span className="muted">{job.company}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {total === 0 ? (
        <Empty
          title="Rien à suivre pour l’instant"
          text="Ouvre une offre qui te plaît dans « Offres » : elle arrive ici, et tu la suis jusqu’à l’entretien."
          action={
            <button className="btn" onClick={() => ctx.go("jobs")}>
              Voir les offres
            </button>
          }
        />
      ) : (
        <>
          <div className="track-tabs" role="tablist" aria-label="Étapes">
            {columns.map((c) => (
              <button key={c.id} role="tab" aria-selected={tab === c.id} className={tab === c.id ? "pill active" : "pill"} onClick={() => setTab(c.id)}>
                {c.label} <span className="count">{c.jobs.length}</span>
              </button>
            ))}
          </div>
          <div className="track">
            {columns.map((c) => (
              <section key={c.id} className={`track-col${tab === c.id ? " is-active" : ""}`} aria-label={c.label}>
                <header className="track-head">
                  <strong>{c.label}</strong>
                  <span className="count">{c.jobs.length}</span>
                </header>
                {c.jobs.length === 0 ? (
                  <p className="track-empty">{c.empty}</p>
                ) : (
                  c.jobs.map((job) => {
                    const stage = stageOf(job);
                    const due = followUpDue(job);
                    // Same rule as the offer card: a sent application is followed whatever happens to the ad.
                    const gone = Boolean(job.gone_reason) && stage !== "applied" && stage !== "interview";
                    return (
                      <button key={job.id} type="button" className="track-card" onClick={() => openOffer(job)}>
                        <span className="track-card-top">
                          <span>
                            <strong>{job.title}</strong>
                            <span className="muted small-text">
                              {job.company}
                              {job.location ? ` · ${job.location}` : ""}
                            </span>
                          </span>
                          <ScoreRing job={job} size={40} />
                        </span>
                        {stage === "interview" && job.interview_at && (
                          <span className="track-flag is-good">
                            <CalendarDays size={13} aria-hidden /> Entretien le {when(job.interview_at)}
                          </span>
                        )}
                        {due && (
                          <span className="track-flag is-warn">
                            <BellRing size={13} aria-hidden /> Relance conseillée
                          </span>
                        )}
                        {stage === "offer" && <span className="track-flag is-good">Acceptée</span>}
                        {stage === "rejected" && <span className="track-flag is-bad">Refusée</span>}
                        {gone && <span className="track-flag is-bad">Plus disponible</span>}
                        <Milestones stage={stage} kit={kits.get(job.id)} />
                      </button>
                    );
                  })
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
