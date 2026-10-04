"use client";
import { useMemo, useState } from "react";
import { CheckCheck, CircleOff, ExternalLink, LoaderCircle, Plus, Search, ShieldAlert } from "lucide-react";
import { Chip, Empty, PageHead, ScoreBadge } from "@/components/ui";
import { CATEGORIES, categorize, contractKind, type ContractKind } from "@/lib/scan/categories";
import { REVIEW, jobStatus, platformsOf, timeAgo } from "@/lib/labels";
import type { Job, OfferSummary } from "@/lib/types";
import type { Ctx, JobFilter } from "./types";

const FILTERS: { id: JobFilter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "best", label: "Très bonnes" },
  { id: "todo", label: "À traiter" },
  { id: "review", label: "À vérifier" },
  { id: "missing", label: "À compléter" },
  { id: "ready", label: "Dossier prêt" },
  { id: "applied", label: "Déjà postulé" },
  { id: "gone", label: "Plus disponibles" },
];

const APPLIED = new Set(["SUBMITTED", "CONFIRMED", "INTERVIEW", "REJECTED", "APPLYING"]);
const isHidden = (j: Job) => j.status === "SKIPPED";
const isApplied = (j: Job) => APPLIED.has(j.status);
/** Withdrawn, not seen for 3 weeks, or reported: nothing more is spent on it. */
const isGone = (j: Job) => Boolean(j.gone_reason) && !isHidden(j) && !isApplied(j);
const toReview = (j: Job) => Boolean(j.review_flag) && !isHidden(j) && !isGone(j);
const active = (j: Job) => !toReview(j) && !isHidden(j) && !isApplied(j) && !isGone(j);
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
  gone: isGone,
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

/** "En bref": from this account's analysis, or shared by the first account that analysed the offer. */
function summaryOf(job: Job): OfferSummary | null {
  const own = (job.score_breakdown as { summary?: OfferSummary } | undefined)?.summary;
  const s = own ?? job.offers?.summary ?? null;
  return s && (s.missions?.length || s.stack?.length || s.conditions) ? s : null;
}

function insight(job: Job): Insight | null {
  const raw = job.score_breakdown as Insight | undefined;
  if (!raw || (!raw.verified_strengths?.length && !raw.gaps?.length)) return null;
  return raw;
}

const CONTRACT_LABEL: Record<ContractKind, string> = { alternance: "Alternance", stage: "Stage", cdd: "CDD", cdi: "CDI", autre: "Autre" };

export function JobsView({ ctx }: { ctx: Ctx }) {
  const { data, jobFilter, setJobFilter, act, busy } = ctx;
  const [query, setQuery] = useState("");
  const [metier, setMetier] = useState("");
  const [contract, setContract] = useState("");

  // Category and contract of every offer, computed once per list.
  const facets = useMemo(
    () => new Map(data.jobs.map((j) => [j.id, { cats: categorize({ title: j.title, romeCode: j.rome_code }), kind: contractKind(j) }])),
    [data.jobs],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(FILTERS.map((f) => [f.id, data.jobs.filter(MATCH[f.id]).length])) as Record<
        JobFilter,
        number
      >,
    [data.jobs],
  );

  const inTab = useMemo(() => data.jobs.filter(MATCH[jobFilter]), [data.jobs, jobFilter]);
  const metierCounts = useMemo(() => {
    const n = new Map<string, number>();
    for (const j of inTab) for (const c of facets.get(j.id)?.cats ?? []) n.set(c, (n.get(c) ?? 0) + 1);
    return n;
  }, [inTab, facets]);
  const contractCounts = useMemo(() => {
    const n = new Map<string, number>();
    for (const j of inTab) {
      const k = facets.get(j.id)?.kind ?? "autre";
      n.set(k, (n.get(k) ?? 0) + 1);
    }
    return n;
  }, [inTab, facets]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inTab
      .filter((j) => (q ? `${j.title} ${j.company} ${j.location || ""}`.toLowerCase().includes(q) : true))
      .filter((j) => !metier || (facets.get(j.id)?.cats ?? []).includes(metier as never))
      .filter((j) => !contract || facets.get(j.id)?.kind === contract);
    return jobFilter === "best" ? [...list].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0)) : list;
  }, [inTab, jobFilter, query, metier, contract, facets]);

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

      <div className="facets">
        <label>
          Métier
          <select value={metier} onChange={(e) => setMetier(e.target.value)}>
            <option value="">Tous ({inTab.length})</option>
            {CATEGORIES.filter((c) => metierCounts.get(c.id)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({metierCounts.get(c.id)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Contrat
          <select value={contract} onChange={(e) => setContract(e.target.value)}>
            <option value="">Tous</option>
            {(Object.keys(CONTRACT_LABEL) as ContractKind[])
              .filter((k) => contractCounts.get(k))
              .map((k) => (
                <option key={k} value={k}>
                  {CONTRACT_LABEL[k]} ({contractCounts.get(k)})
                </option>
              ))}
          </select>
        </label>
        {(metier || contract) && (
          <button className="linkbtn small-text" onClick={() => (setMetier(""), setContract(""))}>
            Effacer les filtres
          </button>
        )}
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
        ) : jobFilter === "gone" ? (
          <Empty
            title="Aucune offre retirée"
            text="Les offres retirées par l’entreprise, plus vues depuis 3 semaines ou signalées apparaîtront ici. Rien n’est dépensé dessus."
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

const FT_LICENCE = "https://francetravail.io/produits-partages/documentation/conditions-dutilisation-api/licence-offres-emploi";

/** Credits the sources' terms require next to each offer. */
function SourceCredits({ job }: { job: Job }) {
  const sources = new Set([job.source_platform ?? "", ...(job.job_sources ?? []).map((s) => s.platform ?? "")]);
  const ft = [...sources].some((s) => s === "francetravail" || s.startsWith("lba:francetravail"));
  const adzuna = sources.has("adzuna");
  if (!ft && !adzuna) return null;
  const updated = job.publication_date ? new Date(`${job.publication_date}T12:00:00`).toLocaleDateString("fr-FR") : null;
  return (
    <p className="credits small-text muted">
      {ft && (
        <>
          Source : France Travail{updated ? ` · publiée le ${updated}` : ""} ·{" "}
          <a href={FT_LICENCE} target="_blank" rel="noreferrer">
            licence de réutilisation
          </a>
        </>
      )}
      {ft && adzuna && " · "}
      {adzuna && (
        <a href="https://www.adzuna.fr" target="_blank" rel="noreferrer">
          Jobs by Adzuna
        </a>
      )}
    </p>
  );
}

function JobCard({ job, ctx, working }: { job: Job; ctx: Ctx; working: boolean }) {
  const { act, busy, go } = ctx;
  const status = jobStatus(job.status);
  const url = job.official_url || job.source_url;
  const why = insight(job);
  const disabled = Boolean(busy);

  let primary: React.ReactNode = null;
  if (toReview(job) || isApplied(job) || isHidden(job) || isGone(job)) primary = null;
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
        {isGone(job) ? (
          <Chip tone="bad">Plus disponible</Chip>
        ) : review ? (
          <Chip tone={review.tone}>{review.label}</Chip>
        ) : (
          <Chip tone={status.tone}>{status.label}</Chip>
        )}
        {job.contract_type && <Chip>{job.contract_type}</Chip>}
        <Chip>{platforms.length > 1 ? `Vu sur ${platforms.length} sites` : platforms[0]}</Chip>
        {age && <span className="muted small-text">{age}</span>}
      </div>
      {summaryOf(job) && <Brief summary={summaryOf(job)!} />}
      <SourceCredits job={job} />
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
      {isGone(job) && (
        <div className="reviewbox bad">
          <p>
            <CircleOff size={15} aria-hidden /> {job.gone_reason}
          </p>
          <div className="jobactions">
            <button className="btn secondary small" disabled={disabled} onClick={() => void act.availability(job, true)}>
              Elle est toujours en ligne
            </button>
            <button className="btn ghost small" disabled={disabled} onClick={() => void act.review(job, "dismiss")}>
              Écarter
            </button>
          </div>
        </div>
      )}
      {review && !isGone(job) && (
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
      {active(job) && (
        <div className="cardlinks">
          <AppliedElsewhere job={job} ctx={ctx} disabled={disabled} />
          <button className="linkbtn small-text" disabled={disabled} onClick={() => void act.availability(job, false)}>
            <CircleOff size={13} aria-hidden /> Offre plus disponible ?
          </button>
        </div>
      )}
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
      {job.market_note && <p className="muted small-text">📊 {job.market_note}</p>}
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

function Brief({ summary }: { summary: OfferSummary }) {
  return (
    <div className="brief">
      <strong className="small-text">En bref</strong>
      {summary.missions?.length ? (
        <ul>
          {summary.missions.slice(0, 3).map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      ) : null}
      {summary.stack?.length ? (
        <div className="chips">
          {summary.stack.slice(0, 8).map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      ) : null}
      {summary.conditions ? <p className="muted small-text">{summary.conditions}</p> : null}
    </div>
  );
}
