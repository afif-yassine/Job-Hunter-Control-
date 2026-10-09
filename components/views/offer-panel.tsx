"use client";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  CheckCheck,
  CircleOff,
  ExternalLink,
  Euro,
  FileText,
  Globe,
  LoaderCircle,
  MapPin,
  Pencil,
  ShieldAlert,
  Sparkles,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { followUpDue, isSent, stageOf, type Stage } from "@/lib/journey";
import { DOCUMENT_KIND, platformsOf, REVIEW } from "@/lib/labels";
import type { DocumentRecord, Job, OfferSummary } from "@/lib/types";
import { aiScore, listScore } from "./closest";
import { offerAge, salaryOf, ScoreRing, StageChip } from "./offer-card";
import { summaryState } from "./summary-state";
import { LOCKED_NOTE, monthFullNote } from "@/components/panel-notes";
import { PRICING } from "@/components/pricing";
import { isUnlocked } from "@/components/unlock";
import type { Ctx } from "./types";

const FT_LICENCE = "https://francetravail.io/produits-partages/documentation/conditions-dutilisation-api/licence-offres-emploi";

/** "En bref": from this account's analysis, or shared by the first account that analysed the offer. */
export function summaryOf(job: Job): OfferSummary | null {
  const own = (job.score_breakdown as { summary?: OfferSummary } | undefined)?.summary;
  const s = own ?? job.offers?.summary ?? null;
  return s && (s.missions?.length || s.stack?.length || s.conditions) ? s : null;
}

type Insight = { verified_strengths?: string[]; gaps?: string[] };
function insightOf(job: Job): Insight | null {
  const raw = job.score_breakdown as Insight | undefined;
  return raw && (raw.verified_strengths?.length || raw.gaps?.length) ? raw : null;
}

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : null;
const dayTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null;

/** <input type="datetime-local"> value in local time. */
function localInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3 * 86_400_000);
  if (!iso) d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The latest version of each document of this offer. */
function latestDocs(documents: DocumentRecord[], jobId: string): DocumentRecord[] {
  const mine = documents.filter((d) => d.job_id === jobId);
  const replaced = new Set(mine.map((d) => d.based_on_document_id).filter(Boolean));
  const out = new Map<string, DocumentRecord>();
  for (const d of mine) if (!replaced.has(d.id) && !out.has(d.kind)) out.set(d.kind, d);
  return ["TAILORED_CV", "COVER_LETTER"].map((k) => out.get(k)).filter((d): d is DocumentRecord => Boolean(d));
}

/** Side panel (bottom sheet on phones): the offer in short, its journey and the next step. */
export function OfferPanel({ job, ctx, onClose }: { job: Job | null; ctx: Ctx; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!job) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [job, onClose]);

  return (
    <AnimatePresence>
      {job && (
        <motion.div className="panel-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.aside
            className="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            <PanelBody key={job.id} job={job} ctx={ctx} closeRef={closeRef} onClose={onClose} />
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PanelBody({ job, ctx, closeRef, onClose }: { job: Job; ctx: Ctx; closeRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const { act, busy, data, status } = ctx;
  const stage = stageOf(job);
  const working = busy === job.id;
  const disabled = Boolean(busy);
  const url = job.official_url || job.source_url;
  const summary = summaryOf(job);
  // Two named blocks: the free score ("compétences en commun") and, when it exists, the AI analysis.
  const freeScore = listScore(job);
  const analysisScore = aiScore(job);
  const insight = insightOf(job);
  const matchedCount = job.fit?.matched.length ?? 0;
  const askedCount = matchedCount + (job.fit?.missing.length ?? 0);
  const docs = latestDocs(data.documents, job.id);
  // Outside the student's selection (or refused by the server just now): readable, but no kit can be written.
  const [serverLocked, setServerLocked] = useState(false);
  const locked = serverLocked || !isUnlocked(job, ctx.unlock, docs.length > 0);
  const createKit = async () => {
    if ((await act.prepareKit(job)) === "locked") setServerLocked(true);
  };
  const salary = salaryOf(job);
  const platforms = platformsOf(job);
  const gone = Boolean(job.gone_reason) && !isSent(stage);
  const review = job.review_flag && !gone ? REVIEW[job.review_flag] : null;
  const missingText = job.status === "DISCOVERED" && !job.description;
  // The short summary is written quietly when the offer is opened: no toast, no lock on the other buttons.
  const [summarising, setSummarising] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  // The server refused the summary because the offer is closed for everybody. Once the student's own copy is
  // marked (and reloaded), `gone` takes over with the existing red box, so the message is never doubled.
  const [summaryGone, setSummaryGone] = useState(false);
  const knownGone = summaryGone && !gone;
  // A text too short for the reader never gets a summary, so the block must not promise one.
  const brief = summaryState({ hasSummary: Boolean(summary), status: job.status, description: job.description, summarising, failed: summaryFailed, knownGone });
  const shortText = brief === "short-text";
  // Only the paid or heavy actions wait for the summary (or stop for a closed offer); leaving or discarding the offer never does.
  const waiting = disabled || summarising || knownGone;
  const plan = status?.plan;
  // A comfort only (the server still decides): unknown plan or limit keeps the button active.
  const monthFull = plan && plan.limit !== null && plan.used >= plan.limit ? { limit: plan.limit, resetsOn: plan.resetsOn } : null;

  // "As-tu postulé ?" when the student comes back from the ad.
  const [askApplied, setAskApplied] = useState(false);
  const leftForAd = useRef(false);
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible" && leftForAd.current) {
        leftForAd.current = false;
        setAskApplied(true);
      }
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);

  const [interviewAt, setInterviewAt] = useState(localInput(job.interview_at));
  const [pickDate, setPickDate] = useState(false);
  const [notes, setNotes] = useState(job.notes ?? "");

  const move = (to: Stage, extra?: { interviewAt?: string | null }) => void act.moveStage(job, to, extra);

  // The short summary is what the student needs first: written on opening when it is missing.
  const canSummarise = !summary && job.status === "DISCOVERED" && Boolean(job.description) && !job.review_flag && !gone;
  const asked = useRef(false);
  const summarise = useCallback(async () => {
    setSummarising(true);
    setSummaryFailed(false);
    const result = await act.summarize(job);
    setSummarising(false);
    if (result === "failed") setSummaryFailed(true);
    if (result === "gone") setSummaryGone(true);
  }, [act, job]);
  useEffect(() => {
    if (!canSummarise || asked.current || busy) return;
    asked.current = true;
    void summarise();
  }, [canSummarise, busy, summarise]);

  return (
    <>
      <header className="panel-head">
        <div className="panel-head-row">
          <StageChip stage={stage} />
          <button ref={closeRef} type="button" className="iconbtn panel-close" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <h2 id="panel-title">{job.title}</h2>
        <p className="panel-company">{job.company}</p>
        <div className="panel-facts">
          <span>
            <MapPin size={15} aria-hidden /> {job.location || "Lieu non précisé"}
          </span>
          <span className={salary ? "" : "is-missing"}>
            <Euro size={15} aria-hidden /> {salary || "Salaire non précisé"}
          </span>
          {offerAge(job) && (
            <span>
              <CalendarDays size={15} aria-hidden /> Publiée {offerAge(job)}
            </span>
          )}
          <span>
            <Globe size={15} aria-hidden /> {platforms.join(", ")}
          </span>
          {job.contract_type && <span className="tag">{job.contract_type}</span>}
          {job.applicants ? (
            <span>
              <Users size={15} aria-hidden /> {job.applicants} candidats LeBonTaf
            </span>
          ) : null}
        </div>
      </header>

      <div className="panel-scroll">
        {gone && (
          <div className="reviewbox bad">
            <p>
              <CircleOff size={15} aria-hidden /> {job.gone_reason}
            </p>
            <div className="jobactions">
              <button className="btn secondary small" disabled={disabled} onClick={() => void act.availability(job, true)}>
                Elle est toujours en ligne
              </button>
              <button className="btn ghost small" disabled={disabled} onClick={() => move("dismissed")}>
                Écarter
              </button>
            </div>
          </div>
        )}
        {review && (
          <div className={`reviewbox ${job.review_flag === "SUSPECTED" ? "bad" : "warn"}`}>
            <p>
              <ShieldAlert size={15} aria-hidden /> {job.review_reason || review.label}
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
            </div>
          </div>
        )}

        <section className="panel-section">
          <div className="panel-score">
            <ScoreRing job={job} size={64} />
            <div>
              <strong>{freeScore !== null ? "Compétences en commun avec ton CV" : analysisScore !== null ? "Pas de score gratuit pour cette offre" : "Pas encore comparée"}</strong>
              {freeScore !== null ? (
                <p className="muted small-text">
                  {askedCount
                    ? `${matchedCount} sur ${askedCount} compétence${askedCount > 1 ? "s" : ""} demandée${askedCount > 1 ? "s" : ""} figure${matchedCount > 1 ? "nt" : ""} dans ton CV.`
                    : "L’offre ne liste pas encore de compétences à comparer."}
                </p>
              ) : analysisScore === null ? (
                <p className="muted small-text">Le score arrive dès que l’offre et ton CV sont lus.</p>
              ) : null}
            </div>
          </div>
          {job.fit && (
            <details className="why">
              <summary>Pourquoi ce score ?</summary>
              <p className="muted small-text">
                Comparaison gratuite des compétences demandées par l’offre avec celles que ton CV prouve.
              </p>
              <p className="muted small-text">Indicatif : ce score ne mesure pas tes chances d’être retenu(e).</p>
              {job.fit.matched.length ? (
                <>
                  <h4>Ce que tu as déjà</h4>
                  <div className="chips">
                    {job.fit.matched.map((s) => (
                      <span key={s} className="tag is-good">
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {job.fit.missing.length ? (
                <>
                  <h4>Demandé, absent de ton CV</h4>
                  <div className="chips">
                    {job.fit.missing.map((s) => (
                      <span key={s} className="tag is-gap">
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {!insight && job.description && !job.review_flag && !gone && (
                <button className="btn ghost small" onClick={() => void act.analyze(job)} disabled={waiting}>
                  <Sparkles size={15} aria-hidden /> Analyse approfondie par l’IA
                </button>
              )}
            </details>
          )}
          {analysisScore !== null && (
            <div className="panel-score">
              <ScoreRing job={job} size={64} kind="ai" />
              <div>
                <strong>Compatibilité avec ton CV (analyse IA)</strong>
                <p className="muted small-text">
                  {analysisScore >= 80 ? "Très proche de ton profil : fonce." : analysisScore >= 60 ? "Une bonne piste, avec quelques écarts." : "Assez loin de ton profil."}
                </p>
              </div>
            </div>
          )}
          {insight && (
            <details className="why">
              <summary>Pourquoi ce score ?</summary>
              <p className="muted small-text">Indicatif : ce score ne mesure pas tes chances d’être retenu(e).</p>
              {insight.verified_strengths?.length ? (
                <>
                  <h4>Ce qui colle</h4>
                  <ul className="plus">
                    {insight.verified_strengths.slice(0, 5).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {insight.gaps?.length ? (
                <>
                  <h4>Ce qui manque</h4>
                  <ul className="minus">
                    {insight.gaps.slice(0, 5).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </details>
          )}
        </section>

        <section className="panel-section">
          <h3>En bref</h3>
          {summary ? (
            <div className="brief">
              {summary.missions?.length ? (
                <ul>
                  {summary.missions.slice(0, 4).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              ) : null}
              {summary.stack?.length ? (
                <div className="chips">
                  {summary.stack.slice(0, 10).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {summary.conditions ? <p className="muted small-text">{summary.conditions}</p> : null}
            </div>
          ) : (
            brief === "loading" ? (
              <div className="brief-loading" role="status">
                <LoaderCircle size={16} className="spin" aria-hidden /> Résumé de l’offre en cours…
                <span className="skeleton" />
                <span className="skeleton is-short" />
              </div>
            ) : (
              <>
                <p className="muted small-text">
                  {missingText
                    ? "L’annonce n’a pas pu être lue automatiquement : colle son texte pour la résumer."
                    : shortText
                      ? "Le texte de cette annonce est trop court pour être résumé. Ouvre l’annonce d’origine, ou colle son texte complet."
                      : brief === "gone"
                        ? "Cette offre n’est plus disponible."
                        : brief === "failed"
                          ? "Résumé indisponible pour l’instant."
                          : "Le résumé (missions, outils, rythme) arrive dès que l’offre est lue, quelques minutes après son arrivée."}
                </p>
                {shortText && !gone && !job.review_flag && (
                  <button className="btn secondary small" disabled={disabled} onClick={() => act.pasteDescription(job)}>
                    Coller le texte de l’annonce
                  </button>
                )}
                {brief === "failed" && (
                  <button className="btn secondary small" disabled={waiting} onClick={() => void summarise()}>
                    Réessayer
                  </button>
                )}
              </>
            )
          )}
        </section>

        <section className="panel-section">
          <h3>Ton parcours</h3>
          <ol className="journey">
            <JourneyStep done={stage !== "new"} title="Offre vue" when={day(job.seen_at)} />
            <JourneyStep
              done={docs.length > 0}
              current={(stage === "new" || stage === "seen") && !gone}
              title="CV et lettre"
              when={docs.length ? `${docs.map((d) => DOCUMENT_KIND[d.kind] ?? d.kind).join(" et ")} prêts` : null}
            >
              {(stage === "new" || stage === "seen") && !gone && !review && (
                <div className="journey-actions">
                  {missingText ? (
                    <button className="btn" disabled={disabled} onClick={() => act.pasteDescription(job)}>
                      Coller le texte de l’annonce
                    </button>
                  ) : knownGone ? (
                    <p className="hint">Cette offre n’est plus disponible : pas de CV ni de lettre à créer.</p>
                  ) : locked ? (
                    // Said in the panel where the button would be, not in a toast hidden under it.
                    <div className="locked-note" role="note">
                      <strong>{LOCKED_NOTE.title}</strong>
                      <p className="muted small-text">{LOCKED_NOTE.text}</p>
                      {url && (
                        <a className="btn secondary" href={url} target="_blank" rel="noreferrer" onClick={() => (leftForAd.current = true)}>
                          <ExternalLink size={15} aria-hidden /> {LOCKED_NOTE.action}
                        </a>
                      )}
                    </div>
                  ) : ctx.hasProfile === false ? (
                    <>
                      <button
                        className="btn"
                        onClick={() => {
                          onClose();
                          ctx.go("settings");
                        }}
                      >
                        <FileText size={16} aria-hidden /> Importer mon CV d’abord
                      </button>
                      <span className="muted small-text">Ton CV sert de base à ton dossier : rien n’est écrit sans lui.</span>
                    </>
                  ) : monthFull ? (
                    <div className="locked-note" role="note">
                      <strong>{monthFullNote(monthFull.limit, monthFull.resetsOn).title}</strong>
                      <p className="muted small-text">{monthFullNote(monthFull.limit, monthFull.resetsOn).text}</p>
                      {ctx.pricing && (
                        <>
                          <p className="muted small-text">{PRICING.why}</p>
                          <a className="btn secondary" href="/tarifs">
                            {PRICING.panelLink}
                          </a>
                        </>
                      )}
                    </div>
                  ) : (
                    <button className="btn" disabled={waiting} onClick={() => void createKit()}>
                      {working ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Sparkles size={16} aria-hidden />} Créer mon CV et ma lettre
                    </button>
                  )}
                  {plan && plan.limit !== null && !monthFull && !locked && (
                    <span className={`plan-meter${plan.used >= plan.limit ? " is-full" : ""}`}>
                      Offre gratuite : {Math.max(plan.limit - plan.used, 0)} dossier{plan.limit - plan.used > 1 ? "s" : ""} restant
                      {plan.limit - plan.used > 1 ? "s" : ""} ce mois-ci
                    </span>
                  )}
                </div>
              )}
            </JourneyStep>
            {docs.length > 0 && (
              <li className="journey-docs">
                {docs.map((d) => (
                  <div key={d.id} className="doc-line">
                    <FileText size={16} aria-hidden />
                    <span>
                      <strong>{DOCUMENT_KIND[d.kind] ?? d.kind}</strong> <span className="muted small-text">v{d.version}</span>
                    </span>
                    <a className="btn secondary small" href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noreferrer">
                      Voir le PDF
                    </a>
                    <button className="btn ghost small" onClick={() => act.openDocument({ doc: d, mode: "edit" })}>
                      <Pencil size={14} aria-hidden /> Modifier
                    </button>
                    <button className="btn ghost small" disabled={disabled} onClick={() => act.openDocument({ doc: d, mode: "revise" })}>
                      <Sparkles size={14} aria-hidden /> Demander une modification
                    </button>
                  </div>
                ))}
              </li>
            )}
            <JourneyStep done={isSent(stage)} current={stage === "ready"} title="Candidature envoyée" when={isSent(stage) ? day(job.applied_at) : null}>
              {stage === "ready" && (
                <div className="journey-actions">
                  {gone ? (
                    <p className="hint">Cette offre n’est plus disponible : tu ne peux plus postuler dessus.</p>
                  ) : (
                    url && (
                      <a className="btn" href={url} target="_blank" rel="noreferrer" onClick={() => (leftForAd.current = true)}>
                        <ExternalLink size={15} aria-hidden /> Postuler sur le site
                      </a>
                    )
                  )}
                  <button className="btn secondary" disabled={disabled} onClick={() => move("applied")}>
                    <CheckCheck size={15} aria-hidden /> J’ai postulé
                  </button>
                </div>
              )}
              {stage === "applied" && followUpDue(job) && <p className="hint">Une semaine sans réponse : c’est le bon moment pour relancer poliment.</p>}
            </JourneyStep>
            <JourneyStep
              done={stage === "interview" || stage === "offer" || (stage === "rejected" && Boolean(job.interview_at))}
              current={stage === "applied"}
              title="Entretien"
              when={job.interview_at ? dayTime(job.interview_at) : null}
            >
              {(stage === "applied" || stage === "interview") && (
                <div className="journey-actions">
                  {pickDate || (stage === "interview" && !job.interview_at) ? (
                    <form
                      className="inlineform"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setPickDate(false);
                        move("interview", { interviewAt: interviewAt ? new Date(interviewAt).toISOString() : null });
                      }}
                    >
                      <label className="small-text">
                        Date et heure
                        <input type="datetime-local" value={interviewAt} onChange={(e) => setInterviewAt(e.target.value)} required />
                      </label>
                      <button className="btn small">Enregistrer</button>
                      <button type="button" className="btn ghost small" onClick={() => setPickDate(false)}>
                        Annuler
                      </button>
                    </form>
                  ) : stage === "applied" ? (
                    <button className="btn secondary" disabled={disabled} onClick={() => setPickDate(true)}>
                      J’ai un entretien
                    </button>
                  ) : (
                    <button className="linkbtn small-text" onClick={() => setPickDate(true)}>
                      Changer la date
                    </button>
                  )}
                </div>
              )}
            </JourneyStep>
            <JourneyStep
              done={stage === "offer" || stage === "rejected"}
              current={stage === "interview" || stage === "applied"}
              title="Réponse"
              when={stage === "offer" ? "Acceptée" : stage === "rejected" ? "Refusée" : null}
            >
              {(stage === "applied" || stage === "interview") && (
                <div className="journey-actions">
                  <button className="btn secondary small" disabled={disabled} onClick={() => move("offer")}>
                    Acceptée
                  </button>
                  <button className="btn ghost small" disabled={disabled} onClick={() => move("rejected")}>
                    Refusée
                  </button>
                </div>
              )}
              {stage === "offer" && <p className="hint is-good">Bravo ! Ton bon départ commence ici.</p>}
            </JourneyStep>
          </ol>
          <AnimatePresence>
            {askApplied && stage === "ready" && (
              <motion.div className="ask-applied" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <strong>Alors, tu as postulé ?</strong>
                <div className="journey-actions">
                  <button
                    className="btn small"
                    onClick={() => {
                      setAskApplied(false);
                      move("applied");
                    }}
                  >
                    Oui, c’est envoyé
                  </button>
                  <button className="btn ghost small" onClick={() => setAskApplied(false)}>
                    Pas encore
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {(stage === "applied" || stage === "interview" || stage === "offer" || stage === "rejected") && (
            <button className="linkbtn small-text" disabled={disabled} onClick={() => void act.undoStage(job)}>
              <Undo2 size={13} aria-hidden /> Revenir à l’étape d’avant
            </button>
          )}
        </section>

        <section className="panel-section">
          <h3>Tes notes</h3>
          <textarea
            className="notes"
            rows={3}
            maxLength={4000}
            value={notes}
            placeholder="Contact du recruteur, questions à poser, ressenti…"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (job.notes ?? "") && void act.saveNotes(job, notes)}
          />
        </section>

        <SourceCredits job={job} />
      </div>

      <footer className="panel-foot">
        {url && (
          <a className="btn secondary small" href={url} target="_blank" rel="noreferrer" onClick={() => stage === "ready" && (leftForAd.current = true)}>
            <ExternalLink size={14} aria-hidden /> Voir l’annonce
          </a>
        )}
        {stage === "dismissed" ? (
          <button className="btn ghost small" disabled={disabled} onClick={() => move("seen")}>
            Remettre dans mon suivi
          </button>
        ) : (
          !isSent(stage) && (
            <>
              <button className="btn ghost small" disabled={disabled} onClick={() => move("dismissed")}>
                Pas pour moi
              </button>
              {stage !== "ready" && (
                <button className="btn ghost small" disabled={disabled} onClick={() => move("applied")}>
                  J’ai déjà postulé
                </button>
              )}
              {!gone && (
                <button className="btn ghost small" disabled={disabled} onClick={() => void act.availability(job, false)}>
                  Plus disponible ?
                </button>
              )}
            </>
          )
        )}
      </footer>
    </>
  );
}

function JourneyStep({ done, current, title, when, children }: { done: boolean; current?: boolean; title: string; when?: string | null; children?: React.ReactNode }) {
  return (
    <li className={`journey-step${done ? " is-done" : ""}${current && !done ? " is-current" : ""}`}>
      <span className="journey-dot" aria-hidden="true" />
      <div className="journey-body">
        <div className="journey-title">
          <strong>{title}</strong>
          {when && <span className="muted small-text">{when}</span>}
          <span className="sr">{done ? " : fait" : current ? " : prochaine étape" : " : à venir"}</span>
        </div>
        {children}
      </div>
    </li>
  );
}

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
