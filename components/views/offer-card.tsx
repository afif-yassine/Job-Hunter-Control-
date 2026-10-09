"use client";
import { CalendarDays, Euro, Globe, MapPin, Users } from "lucide-react";
import { aiScore, listScore } from "./closest";
import { milestones, stageOf, STAGE, type Stage } from "@/lib/journey";
import { platformsOf, timeAgo } from "@/lib/labels";
import type { Job } from "@/lib/types";

/** When the offer was published (or found, when the source gives no date). */
export function offerAge(job: Job): string | null {
  if (job.publication_date) return timeAgo(`${job.publication_date}T12:00:00`);
  return job.created_at ? timeAgo(job.created_at) : null;
}

export function salaryOf(job: Job): string | null {
  return job.offers?.salary ?? null;
}

/**
 * The score ring. Lists and cards always show the FREE score ("compétences en commun"); only the offer
 * panel shows the AI analysis, in its own block, with kind="ai". One quantity per screen area, each named.
 */
export function ScoreRing({ job, size = 54, kind = "free" }: { job: Job; size?: number; kind?: "free" | "ai" }) {
  const score = kind === "ai" ? aiScore(job) : listScore(job);
  if (score === null) {
    const title =
      kind === "ai"
        ? "Pas d’analyse IA pour cette offre"
        : aiScore(job) !== null
          ? "Pas de score gratuit pour cette offre"
          : "Pas encore comparée à ton CV";
    return (
      <span className="ring is-none" style={{ width: size, height: size }} title={title}>
        <b>—</b>
        <small>score</small>
      </span>
    );
  }
  const tone = score >= 80 ? "good" : score >= 60 ? "mid" : "low";
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span className={`ring is-${tone}`} style={{ width: size, height: size }} title={kind === "ai" ? `Compatibilité avec ton CV (analyse IA) : ${score}/100` : `Compétences en commun avec ton CV : ${score}/100 (comparaison gratuite, indicative)`}>
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r={r} className="ring-track" />
        <circle cx="27" cy="27" r={r} className="ring-value" strokeDasharray={`${(c * score) / 100} ${c}`} />
      </svg>
      <b>{score}</b>
      <small>/100</small>
    </span>
  );
}

export function StageChip({ stage }: { stage: Stage }) {
  return <span className={`stage-chip is-${stage}`}>{STAGE[stage].label}</span>;
}

/** The five milestones of the offer, as dots with words. */
export function Milestones({ stage, kit }: { stage: Stage; kit?: { cv: boolean; letter: boolean } }) {
  const steps = milestones(stage, kit);
  return (
    <ol className="milestones" aria-label="Avancement">
      {steps.map((s) => (
        <li key={s.id} className={s.done ? "is-done" : ""}>
          <span className="ms-dot" aria-hidden="true" />
          <span className="ms-label">
            {s.label}
            <span className="sr"> : {s.done ? "fait" : "pas encore"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One offer in a list: everything that matters before opening it. */
export function OfferCard({
  job,
  kit,
  rank,
  onOpen,
}: {
  job: Job;
  kit?: { cv: boolean; letter: boolean };
  /** Position in the day's selection (1 = best score), shown as a badge. */
  rank?: number;
  onOpen: (job: Job) => void;
}) {
  const stage = stageOf(job);
  const platforms = platformsOf(job);
  const salary = salaryOf(job);
  const age = offerAge(job);
  const gone = Boolean(job.gone_reason) && stage !== "applied" && stage !== "interview";
  return (
    <button type="button" className={`offer card is-${stage}${gone ? " is-gone" : ""}`} onClick={() => onOpen(job)} aria-label={`${job.title}, ${job.company}`}>
      <span className="offer-top">
        <span className="offer-titles">
          {rank ? <span className="rank-badge">#{rank}</span> : null}
          {stage === "new" && <span className="new-dot">Nouvelle</span>}
          <strong className="offer-title">{job.title}</strong>
          <span className="offer-company">{job.company}</span>
        </span>
        <ScoreRing job={job} />
      </span>
      <span className="offer-facts">
        <span>
          <MapPin size={14} aria-hidden /> {job.location || "Lieu non précisé"}
        </span>
        <span className={salary ? "" : "is-missing"}>
          <Euro size={14} aria-hidden /> {salary || "Salaire non précisé"}
        </span>
        {age && (
          <span>
            <CalendarDays size={14} aria-hidden /> {age}
          </span>
        )}
        <span>
          <Globe size={14} aria-hidden /> {platforms[0]}
          {platforms.length > 1 ? ` +${platforms.length - 1}` : ""}
        </span>
        {job.applicants ? (
          <span>
            <Users size={14} aria-hidden /> {job.applicants} candidats LeBonTaf
          </span>
        ) : null}
      </span>
      <span className="offer-tags">
        {job.contract_type && <span className="tag">{job.contract_type.split(" · ")[0]}</span>}
        {job.review_flag && !gone && <span className="tag is-warn">À vérifier</span>}
        {gone && <span className="tag is-bad">Plus disponible</span>}
      </span>
      <span className="offer-foot">
        <Milestones stage={stage} kit={kit} />
        <StageChip stage={stage} />
      </span>
    </button>
  );
}
