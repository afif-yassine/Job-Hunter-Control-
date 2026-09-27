"use client";
import { useMemo, useState } from "react";
import { CheckCheck, ExternalLink, LoaderCircle, Plus, Search, ShieldAlert } from "lucide-react";
import { Chip, Empty, PageHead, ScoreBadge } from "@/components/ui";
import { REVIEW, jobStatus, platformsOf, timeAgo } from "@/lib/labels";
import type { Job } from "@/lib/types";
import type { Ctx, JobFilter } from "./types";

const FILTERS: { id: JobFilter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "best", label: "Très bonnes" },
  { id: "todo", label: "À traiter" },
  { id: "review", label: "À vérifier" },
  { id: "missing", label: "À compléter" },
  { id: "ready", label: "Dossier prêt" },
  { id: "applied", label: "Déjà postulé" },
];

const APPLIED = new Set(["SUBMITTED", "CONFIRMED", "INTERVIEW", "REJECTED", "APPLYING"]);
const isHidden = (j: Job) => j.status === "SKIPPED";
const toReview = (j: Job) => Boolean(j.review_flag) && !isHidden(j);
const isApplied = (j: Job) => APPLIED.has(j.status);
const active = (j: Job) => !toReview(j) && !isHidden(j) && !isApplied(j);
const isMissing = (j: Job) => active(j) && j.status === "DISCOVERED" && !j.description;
const isReady = (j: Job) => active(j) && (j.status === "WAITING_APPROVAL" || j.status === "PREPARED");
const isTodo = (j: Job) => active(j) && ((j.status === "DISCOVERED" && Boolean(j.description)) || j.status === "ANALYZED");

const MATCH: Record<JobFilter, (j: Job) => boolean> = {
  all: (j) => !isHidden(j),
  best: (j) => active(j) && (j.match_score ?? 0) >= 80,
  todo: isTodo,
  review: toReview,
  missing: isMissing,
  ready: isReady,
  applied: isApplied,
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const PLATFORMS = ["LinkedIn", "Indeed", "Welcome to the Jungle", "HelloWork", "APEC", "Site de l’entreprise", "Autre"];

type Insight = { verified_strengths?: string[]; gaps?: string[]; cv_summary?: string };

function insight(job: Job): Insight | null {
  const raw = job.score_breakdown as Insight | undefined;
  if (!raw || (!raw.verified_strengths?.length && !raw.gaps?.length)) return null;
  return raw;
}

export function JobsView({ ctx }: { ctx: Ctx }) {
  const { data, jobFilter, setJobFilter, act, busy } = ctx;
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () =>
      Object.fromEntries(FILTERS.map((f) => [f.id, data.jobs.filter(MATCH[f.id]).length])) as Record<
        JobFilter,
        number
      >,
    [data.jobs],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data.jobs.filter(MATCH[jobFilter]).filter((j) =>
      q ? `${j.title} ${j.company} ${j.location || ""}`.toLowerCase().includes(q) : true,
    );
    return jobFilter === "best" ? [...list].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)) : list;
  }, [data.jobs, jobFilter, query]);

  return (
    <>
      <PageHead
        title="Offres"
        subtitle="Toutes les offres trouvées, regroupées : une offre publiée sur plusieurs sites n’apparaît qu’une fois."
        actions={
          <button className="btn" onClick={act.addJob}>
            <Plus size={16} aria-hidden /> Ajouter une offre
          </button>
        }
      />

      <div className="filters" role="tablist" aria-label="Filtrer les offres">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={jobFilter === f.id}
            className={jobFilter === f.id ? "pill active" : "pill"}
            onClick={() => setJobFilter(f.id)}
          >
            {f.label} <span className="count">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <label className="search">
        <Search size={16} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un poste, une entreprise, une ville…"
          aria-label="Chercher dans les offres"
        />
      </label>

      {rows.length === 0 ? (
        data.jobs.length === 0 ? (
          <Empty
            title="Aucune offre pour l’instant"
            text="Lance une recherche depuis l’accueil, ou ajoute une offre à la main."
            action={
              <button className="btn" onClick={() => ctx.go("home")}>
                Aller à l’accueil
              </button>
            }
          />
        ) : jobFilter === "review" ? (
          <Empty title="Rien à vérifier" text="Les offres suspectes ou en double probable apparaîtront ici avant qu’on dépense quoi que ce soit dessus." />
        ) : (
          <Empty title="Aucune offre dans cette liste" text="Change de filtre ou de recherche." />
        )
      ) : (
        <div className="cards">
          {rows.map((job) => (
            <JobCard key={job.id} job={job} ctx={ctx} working={busy === job.id} />
          ))}
        </div>
      )}
    </>
  );
}

function JobCard({ job, ctx, working }: { job: Job; ctx: Ctx; working: boolean }) {
  const { act, busy, go } = ctx;
  const status = jobStatus(job.status);
  const url = job.official_url || job.source_url;
  const why = insight(job);
  const disabled = Boolean(busy);

  let primary: React.ReactNode = null;
  if (toReview(job) || isApplied(job) || isHidden(job)) primary = null;
  else if (isMissing(job))
    primary = (
      <button className="btn" disabled={disabled} onClick={() => act.pasteDescription(job)}>
        Coller la description
      </button>
    );
  else if (job.status === "DISCOVERED")
    primary = (
      <button className="btn" disabled={disabled} onClick={() => void act.analyze(job)}>
        {working ? <LoaderCircle size={16} className="spin" aria-hidden /> : null} Analyser
      </button>
    );
  else if (job.status === "ANALYZED")
    primary = (
      <button className="btn" disabled={disabled} onClick={() => void act.generate(job)}>
        {working ? <LoaderCircle size={16} className="spin" aria-hidden /> : null} Créer CV et lettre
      </button>
    );
  else if (isReady(job))
    primary = (
      <button className="btn" onClick={() => go("documents")}>
        Voir les documents
      </button>
    );

  const platforms = platformsOf(job);
  const review = job.review_flag ? REVIEW[job.review_flag] : null;
  const age = job.publication_date ? timeAgo(`${job.publication_date}T12:00:00`) : job.created_at ? timeAgo(job.created_at) : null;

  return (
    <article className={`jobcard card ${(job.match_score ?? 0) >= 80 ? "top" : ""}`}>
      <div className="jobhead">
        <div className="jobtitle">
          <h3>{job.title}</h3>
          <p className="muted">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
        </div>
        <ScoreBadge score={job.match_score} />
      </div>
      <div className="chips">
        {review ? <Chip tone={review.tone}>{review.label}</Chip> : <Chip tone={status.tone}>{status.label}</Chip>}
        {job.contract_type && <Chip>{job.contract_type}</Chip>}
        <Chip>{platforms.length > 1 ? `Vu sur ${platforms.length} sites` : platforms[0]}</Chip>
        {age && <span className="muted small-text">{age}</span>}
      </div>
      <div className="jobactions">
        {primary}
        {url && (
          <a className="btn secondary" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} aria-hidden /> Voir l’annonce
          </a>
        )}
        {active(job) && job.status === "DISCOVERED" && job.description && (
          <button className="btn ghost" disabled={disabled} onClick={() => act.pasteDescription(job)}>
            Remplacer le texte
          </button>
        )}
      </div>
      {review && (
        <div className={`reviewbox ${job.review_flag === "SUSPECTED" ? "bad" : "warn"}`}>
          <p>
            <ShieldAlert size={15} aria-hidden /> {job.review_reason || review.label}
          </p>
          <p className="muted small-text">
            {job.review_flag === "SUSPECTED"
              ? "Rien n’a été dépensé sur cette offre. Vérifie l’entreprise avant de continuer."
              : "Rien n’a été dépensé sur cette offre tant que tu n’as pas décidé."}
          </p>
          <div className="jobactions">
            {job.review_flag === "PROBABLE_DUPLICATE" && job.duplicate_of && (
              <button className="btn small" disabled={disabled} onClick={() => void act.review(job, "merge")}>
                C’est la même offre
              </button>
            )}
            {job.review_flag === "ALREADY_APPLIED" && (
              <button className="btn small" disabled={disabled} onClick={() => void act.review(job, "applied_elsewhere")}>
                Oui, déjà postulé
              </button>
            )}
            <button className="btn secondary small" disabled={disabled} onClick={() => void act.review(job, "keep")}>
              {job.review_flag === "SUSPECTED" ? "Offre fiable, continuer" : "Offre différente, garder"}
            </button>
            <button className="btn ghost small" disabled={disabled} onClick={() => void act.review(job, "dismiss")}>
              Écarter
            </button>
          </div>
        </div>
      )}
      {active(job) && <AppliedElsewhere job={job} ctx={ctx} disabled={disabled} />}
      {platforms.length > 1 && (
        <details className="why">
          <summary>Vu sur {platforms.join(", ")}</summary>
          <ul className="links">
            {(job.job_sources ?? []).map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {hostOf(s.url)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {isMissing(job) && (
        <p className="muted small-text">
          Cette annonce n’a pas pu être lue automatiquement (souvent protégée). Ouvre-la, copie son texte, colle-le ici.
        </p>
      )}
      {why && (
        <details className="why">
          <summary>Pourquoi ce score ?</summary>
          {why.verified_strengths?.length ? (
            <>
              <h4>Ce qui colle</h4>
              <ul className="plus">
                {why.verified_strengths.slice(0, 5).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          ) : null}
          {why.gaps?.length ? (
            <>
              <h4>Ce qui manque</h4>
              <ul className="minus">
                {why.gaps.slice(0, 5).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          ) : null}
        </details>
      )}
    </article>
  );
}

/** "I already applied to this offer elsewhere": remembered so it never comes back. */
function AppliedElsewhere({ job, ctx, disabled }: { job: Job; ctx: Ctx; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  if (!open)
    return (
      <button className="linkbtn small-text" disabled={disabled} onClick={() => setOpen(true)}>
        <CheckCheck size={13} aria-hidden /> Déjà postulé ailleurs ?
      </button>
    );
  return (
    <div className="inlineform">
      <label className="small-text">
        Où ?{" "}
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <button
        className="btn small"
        disabled={disabled}
        onClick={() => {
          setOpen(false);
          void ctx.act.review(job, "applied_elsewhere", platform);
        }}
      >
        Confirmer
      </button>
      <button className="btn ghost small" onClick={() => setOpen(false)}>
        Annuler
      </button>
    </div>
  );
}
