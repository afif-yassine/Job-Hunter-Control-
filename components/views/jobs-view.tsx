"use client";
import { useMemo, useState } from "react";
import { ExternalLink, LoaderCircle, Plus, Search } from "lucide-react";
import { Chip, Empty, PageHead, ScoreBadge } from "@/components/ui";
import { jobStatus, sourceLabel, timeAgo } from "@/lib/labels";
import type { Job } from "@/lib/types";
import type { Ctx, JobFilter } from "./types";

const FILTERS: { id: JobFilter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "best", label: "Très bonnes" },
  { id: "todo", label: "À traiter" },
  { id: "missing", label: "À compléter" },
  { id: "ready", label: "Dossier prêt" },
];

const isMissing = (j: Job) => j.status === "DISCOVERED" && !j.description;
const isReady = (j: Job) => j.status === "WAITING_APPROVAL" || j.status === "PREPARED";
const isTodo = (j: Job) => (j.status === "DISCOVERED" && Boolean(j.description)) || j.status === "ANALYZED";

const MATCH: Record<JobFilter, (j: Job) => boolean> = {
  all: () => true,
  best: (j) => (j.match_score ?? 0) >= 80,
  todo: isTodo,
  missing: isMissing,
  ready: isReady,
};

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
        subtitle="Toutes les offres trouvées, du meilleur score au plus récent."
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
  if (isMissing(job))
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
        <Chip tone={status.tone}>{status.label}</Chip>
        {job.contract_type && <Chip>{job.contract_type}</Chip>}
        <Chip>{sourceLabel(job.source_platform, job.source_url)}</Chip>
        {age && <span className="muted small-text">{age}</span>}
      </div>
      <div className="jobactions">
        {primary}
        {url && (
          <a className="btn secondary" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} aria-hidden /> Voir l’annonce
          </a>
        )}
        {job.status === "DISCOVERED" && job.description && (
          <button className="btn ghost" disabled={disabled} onClick={() => act.pasteDescription(job)}>
            Remplacer le texte
          </button>
        )}
      </div>
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
