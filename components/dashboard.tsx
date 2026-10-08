"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { Mark, Wordmark } from "@/components/jinnjob/logo";
import {
  Activity,
  CircleHelp,
  Ellipsis,
  FileText,
  House,
  LoaderCircle,
  LogOut,
  Search,
  Settings,
  SquareKanban,
  Map as MapIcon,
  ShieldCheck,
  Gauge,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { explainError, cleanRaw } from "@/lib/errors";
import { fingerprintOf } from "@/lib/scan/ingest";
import type { Job } from "@/lib/types";
import { DocumentDialog, type DocumentDialogState } from "@/components/document-tools";
import { openQuestionCount, QuestionsPanel } from "@/components/questions-panel";
import { usePipeline } from "@/components/use-pipeline";
import { useDashboardData, type Data } from "@/components/use-dashboard-data";
import { useSystemStatus, type SystemStatus } from "@/components/use-status";
import { useProfileState } from "@/components/use-profile";
import { createInflightGuard } from "@/components/in-flight";
import { Callout, Progress } from "@/components/ui";
import { ErrorBoundary } from "@/components/error-boundary";
import { RoadmapView } from "@/components/views/roadmap-view";
import { HomeView } from "@/components/views/home-view";
import { JobsView } from "@/components/views/jobs-view";
import { DocumentsView } from "@/components/views/documents-view";
import { TrackView } from "@/components/views/track-view";
import { OfferPanel } from "@/components/views/offer-panel";
import { stagePatch, stageOf, todayTasks, undoPatch, type Stage } from "@/lib/journey";
import { ActivityView } from "@/components/views/activity-view";
import { SettingsView } from "@/components/views/settings-view";
import { MoreView } from "@/components/views/more-view";
import { AdminView } from "@/components/views/admin-view";
import type { AdminOverview } from "@/lib/admin/overview";
import { PageHead } from "@/components/ui";
import type { Ctx, JobFilter, Tone, View } from "@/components/views/types";

/** The student space: four places, the rest lives in "Plus" and in each offer's panel. */
const NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Accueil", icon: House },
  { id: "jobs", label: "Offres", icon: Search },
  { id: "track", label: "Mon suivi", icon: SquareKanban },
  { id: "settings", label: "Réglages", icon: Settings },
];
const SECONDARY_NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "documents", label: "Mes documents", icon: FileText },
  { id: "questions", label: "Mes réponses", icon: CircleHelp },
];
const TABS: { id: View; label: string; icon: LucideIcon }[] = [
  ...NAV.slice(0, 3),
  { id: "more", label: "Plus", icon: Ellipsis },
];
const ADMIN_NAV = [
  { id: "activity" as View, label: "Activité", icon: Activity },
  { id: "admin" as View, label: "Espace admin", icon: Gauge },
];
const VIEWS = new Set<string>(["home", "jobs", "track", "documents", "questions", "more", "admin", "activity", "settings", "roadmap"]);
const MORE_VIEWS = new Set<View>(["more", "documents", "questions", "activity", "settings", "admin", "roadmap"]);

/** A pasted announcement shorter than this is never summarised by the shared reader (lib/offer-reader.ts, migration 20261007111753). */
const DESCRIPTION_MIN_CHARS = 120;

/** What the student hears after moving an offer. */
const MOVED: Record<Stage, string> = {
  new: "Remise dans les nouvelles offres.",
  seen: "Remise dans tes offres à préparer.",
  ready: "Dossier prêt.",
  applied: "Candidature notée comme envoyée. On te rappellera de relancer dans 7 jours.",
  interview: "Entretien noté. Bonne préparation !",
  offer: "Bravo ! Offre acceptée.",
  rejected: "C’est noté. La suivante sera la bonne.",
  dismissed: "Offre écartée : elle ne reviendra plus.",
};

/** Server error → one readable sentence; only the administrator reads platform details. */
function readableError(raw: unknown, admin: boolean): string {
  const text = cleanRaw(String(raw || "Erreur inconnue"));
  const e = explainError(text, admin ? "admin" : "student");
  return e ? `${e.title}${e.hint ? ` — ${e.hint}` : ""}` : text;
}

async function post(url: string, body: unknown = {}) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed = (await response.json().catch(() => ({
      error: `Réponse vide du serveur (HTTP ${response.status})`,
    }))) as Record<string, unknown>;
    return { ok: response.ok, body: parsed };
  } catch (error) {
    return {
      ok: false,
      body: { error: `Connexion impossible : ${error instanceof Error ? error.message : "réseau"}` } as Record<string, unknown>,
    };
  }
}

export type DemoState = { data: Data; status: SystemStatus; admin?: AdminOverview };

export function Dashboard({ userEmail = "", demo }: { userEmail?: string; demo?: DemoState }) {
  const { supabase, data, loading, error: loadError, reload, patchJob } = useDashboardData(demo?.data);
  const router = useRouter();
  const isDemo = Boolean(demo);
  const { status, failed: statusFailed, refresh: refreshStatus } = useSystemStatus(Boolean(supabase), demo?.status);
  const pipeline = usePipeline({ supabase, status, reload, refreshStatus });
  const { hasProfile, refresh: refreshProfile } = useProfileState(Boolean(supabase), isDemo);

  const [view, setView] = useState<View>("home");
  const [jobFilter, setJobFilter] = useState<JobFilter>("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const openJob = openId ? (data.jobs.find((j) => j.id === openId) ?? null) : null;
  // The last move of each offer, so "Revenir à l’étape d’avant" restores it.
  const history = useRef(new Map<string, Partial<Job>>());
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const [docDialog, setDocDialog] = useState<DocumentDialogState>(null);
  const [descJob, setDescJob] = useState<Job | null>(null);
  const [descText, setDescText] = useState("");
  const addModal = useRef<HTMLDialogElement>(null);
  const descModal = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Restore the tab from the address (#jobs) so a refresh keeps the place.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.location.hash.slice(1);
      const hash = raw === "applications" ? "track" : raw;
      // The admin pages live in their own space now.
      if (hash === "admin" && !isDemo) return router.push("/admin");
      if (VIEWS.has(hash)) setView(hash as View);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isDemo, router]);

  const notify = useCallback((text: string, tone: Tone = "info") => {
    window.clearTimeout(toastTimer.current);
    setToast(text ? { text, tone } : null);
    // An error stays a little longer to be read, but it closes by itself too.
    if (text) toastTimer.current = window.setTimeout(() => setToast(null), tone === "bad" ? 12000 : 7000);
  }, []);
  const isAdmin = status?.isAdmin === true;
  const readable = useCallback((raw: unknown) => readableError(raw, isAdmin), [isAdmin]);

  // Nothing fails silently: any error the page did not handle is shown.
  useEffect(() => {
    const show = (message: string) => notify(`Erreur inattendue : ${message}`, "bad");
    const onError = (e: ErrorEvent) => show(e.message || "erreur JavaScript");
    const onRejection = (e: PromiseRejectionEvent) =>
      show(e.reason instanceof Error ? e.reason.message : String(e.reason ?? "promesse rejetée"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [notify]);

  const go = useCallback((next: View, filter?: JobFilter) => {
    if (next === "admin" && !isDemo) {
      router.push("/admin");
      return;
    }
    setView(next);
    if (filter) setJobFilter(filter);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  }, [isDemo, router]);

  const locked = pipeline.running ? "pipeline" : busy;

  const run = useCallback(
    async (id: string, work: () => Promise<void>) => {
      setBusy(id);
      try {
        await work();
      } finally {
        setBusy("");
        await reload();
      }
    },
    [reload],
  );

  // Writing the kit of an offer runs once at a time, even for two clicks in the same tick (see components/in-flight.ts).
  const inflight = useRef(createInflightGuard());
  const once = useCallback((key: string, work: () => Promise<void>) => inflight.current.run(key, work).then(() => undefined), []);

  const act: Ctx["act"] = useMemo(
    () => ({
      analyze: (job) =>
        run(job.id, async () => {
          notify(`Analyse de « ${job.company} » en cours…`);
          const r = await post(`/api/jobs/${job.id}/analyze`);
          if (!r.ok) return notify(readable(r.body.error), "bad");
          notify(`${job.company} : compatibilité ${r.body.total}/100.`, "good");
        }),
      summarize: async (job) => {
        // Opening an offer is not a request: no toast, and no `busy` lock that would freeze the panel buttons.
        const r = await post(`/api/jobs/${job.id}/analyze`);
        if (r.ok) await reload();
        return r.ok;
      },
      generate: (job) =>
        once(`kit:${job.id}`, () => run(job.id, async () => {
          notify(`Rédaction du CV et de la lettre pour « ${job.company} »…`);
          const r = await post(`/api/jobs/${job.id}/generate`);
          if (!r.ok) return notify(readable(r.body.error), "bad");
          const stats = (r.body.questionStats as { asked?: number }) || {};
          notify(
            `Documents prêts${stats.asked ? ` · ${stats.asked} question(s) à valider` : ""}.`,
            "good",
          );
        })),
      review: (job, action, platform) =>
        run(job.id, async () => {
          const r = await post(`/api/jobs/${job.id}/review`, { action, platform });
          notify(r.ok ? String(r.body.message || "C’est noté.") : readable(r.body.error), r.ok ? "good" : "bad");
        }),
      availability: (job, available) =>
        run(job.id, async () => {
          const r = await post(`/api/jobs/${job.id}/availability`, { available });
          notify(r.ok ? String(r.body.message || "C’est noté.") : readable(r.body.error), r.ok ? "good" : "bad");
        }),
      approve: (doc) =>
        run(doc.id, async () => {
          const r = await post(`/api/documents/${doc.id}/approve`);
          notify(r.ok ? "Document approuvé." : readable(r.body.error), r.ok ? "good" : "bad");
        }),
      upload: (doc) =>
        run(doc.id, async () => {
          // The platform's Drive folder is for the administrator; the route refuses anybody else.
          if (!isAdmin) return;
          notify("Envoi vers Google Drive…");
          const r = await post(`/api/documents/${doc.id}/drive`);
          notify(r.ok ? "Document envoyé sur Google Drive." : readable(r.body.error), r.ok ? "good" : "bad");
        }),
      prepare: (applicationId) =>
        run(applicationId, async () => {
          notify("Lecture du formulaire de candidature… (jusqu’à 1 minute)");
          const r = await post("/api/worker/dispatch", { applicationId, action: "prepare" });
          if (!r.ok) return notify(readable(r.body.error), "bad");
          const fields = (r.body.fields as unknown[] | undefined)?.length ?? 0;
          const questions = (r.body.questions as unknown[] | undefined)?.length ?? 0;
          notify(
            `Formulaire lu : ${fields} champ(s)${questions ? `, ${questions} question(s) à traiter` : ""}. Rien n’a été envoyé.`,
            "good",
          );
        }),
      pasteDescription: (job) => {
        setDescJob(job);
        setDescText("");
        descModal.current?.showModal();
      },
      addJob: () => addModal.current?.showModal(),
      markRead: async (id) => {
        if (!supabase) return;
        await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
        await reload();
      },
      markAllRead: async () => {
        if (!supabase) return;
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .is("read_at", null);
        await reload();
      },
      openDocument: (state) => setDocDialog(state),
      prepareKit: (job) =>
        once(`kit:${job.id}`, () => run(job.id, async () => {
          if (job.status === "DISCOVERED") {
            notify(`Lecture de l’offre « ${job.company} »…`);
            const a = await post(`/api/jobs/${job.id}/analyze`);
            if (!a.ok) return notify(readable(a.body.error), "bad");
          }
          notify(`Rédaction de ton CV et de ta lettre pour « ${job.company} »… (environ 20 secondes)`);
          const r = await post(`/api/jobs/${job.id}/generate`);
          void refreshStatus();
          if (!r.ok) return notify(readable(r.body.error), "bad");
          notify("Ton dossier est prêt : relis ton CV et ta lettre, puis postule.", "good");
        })),
      moveStage: async (job, stage, extra) => {
        const patch = stagePatch(stage, job, extra);
        history.current.set(job.id, {
          stage: job.stage ?? stageOf(job),
          status: job.status,
          applied_at: job.applied_at ?? null,
          interview_at: job.interview_at ?? null,
        });
        patchJob(job.id, patch as Partial<Job>);
        if (!supabase) return;
        const { error } = await supabase.from("jobs").update(patch).eq("id", job.id);
        if (error) {
          notify(readable(error.message), "bad");
          await reload();
          return;
        }
        notify(MOVED[stage], "good");
      },
      undoStage: async (job) => {
        const saved = history.current.get(job.id);
        const kit = data.documents.some((d) => d.job_id === job.id);
        const patch = saved ?? undoPatch(job, kit);
        if (!patch) return;
        history.current.delete(job.id);
        patchJob(job.id, patch as Partial<Job>);
        if (!supabase) return;
        const { error } = await supabase.from("jobs").update(patch).eq("id", job.id);
        notify(error ? readable(error.message) : "C’est annulé.", error ? "bad" : "info");
        if (error) await reload();
      },
      saveNotes: async (job, notes) => {
        patchJob(job.id, { notes });
        if (!supabase) return;
        const { error } = await supabase.from("jobs").update({ notes: notes.trim() || null }).eq("id", job.id);
        notify(error ? readable(error.message) : "Notes enregistrées.", error ? "bad" : "info");
      },
    }),
    [notify, readable, isAdmin, reload, run, once, supabase, patchJob, refreshStatus, data.documents],
  );

  const closeOffer = useCallback(() => setOpenId(null), []);

  /** Opening an offer marks it as seen: it joins "Mon suivi". */
  const openOffer = useCallback(
    (job: Job) => {
      setOpenId(job.id);
      if (stageOf(job) !== "new") return;
      const patch = stagePatch("seen", job);
      patchJob(job.id, patch as Partial<Job>);
      if (supabase) void supabase.from("jobs").update(patch).eq("id", job.id);
    },
    [patchJob, supabase],
  );

  async function saveDescription() {
    if (!supabase || !descJob || descText.trim().length < DESCRIPTION_MIN_CHARS) return;
    const { error } = await supabase
      .from("jobs")
      .update({ description: descText.trim(), last_checked_at: null })
      .eq("id", descJob.id);
    descModal.current?.close();
    setDescJob(null);
    setDescText("");
    notify(error ? error.message : "Description enregistrée : tu peux analyser l’offre.", error ? "bad" : "good");
    await reload();
  }

  async function addJob(form: FormData) {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const company = String(form.get("company") || "").trim();
    const title = String(form.get("title") || "").trim();
    const location = String(form.get("location") || "").trim();
    const url = String(form.get("official_url") || "").trim();
    const description = String(form.get("description") || "").trim();
    if (!description && !url) {
      notify("Ajoute le lien de l’offre ou colle sa description.", "bad");
      return;
    }
    const { error } = await supabase.from("jobs").insert({
      user_id: user.id,
      company,
      title,
      contract_type: String(form.get("contract_type") || ""),
      location,
      description: description || null,
      official_url: url || null,
      source_url: url || null,
      source_platform: "manual",
      fingerprint: fingerprintOf({ company, title, location }),
      status: "DISCOVERED",
    });
    if (error) {
      notify(error.code === "23505" ? "Cette offre existe déjà." : error.message, "bad");
      return;
    }
    addModal.current?.close();
    notify("Offre ajoutée. Lance l’analyse depuis sa carte.", "good");
    go("jobs", "all");
    await reload();
  }

  const ctx: Ctx = {
    data,
    supabase,
    status,
    statusFailed,
    refreshStatus,
    pipeline,
    busy: locked,
    userEmail,
    go,
    notify,
    reload,
    hasProfile,
    refreshProfile,
    jobFilter,
    setJobFilter,
    openOffer,
    act,
    adminDemo: demo?.admin,
  };
  const nav = NAV;
  const subNav = [...SECONDARY_NAV, { id: "roadmap" as View, label: "Feuille de route", icon: MapIcon }, ...(status?.isAdmin ? ADMIN_NAV : [])];
  const tasks = todayTasks(data.jobs).length;

  const unread = data.notifications.filter((n) => !n.read_at).length;
  const openQuestions = openQuestionCount(data.questions);
  const sourceAlerts = data.notifications.filter((n) => !n.read_at && n.notification_type === "SOURCE_ALERT").length;
  const badge = (id: View) =>
    id === "questions"
      ? openQuestions
      : id === "track" || id === "home"
        ? id === "track"
          ? tasks
          : 0
        : id === "more"
          ? openQuestions
          : id === "activity"
            ? unread
            : id === "admin"
              ? sourceAlerts
              : 0;
  const activeTab: View = MORE_VIEWS.has(view) ? "more" : view;

  const p = pipeline.progress;
  // A free account never writes documents or reads forms by itself: its search has two steps.
  const phases = status?.plan?.plan === "free" ? (["scan", "analyze"] as const) : (["scan", "analyze", "generate", "prepare"] as const);
  const phaseAt = p ? Math.min(Math.max(phases.findIndex((x) => x === p.phase), 0), phases.length - 1) : 0;
  const percent = p ? ((phaseAt + (p.total ? p.done / p.total : 0)) / phases.length) * 100 : 0;

  return (
    <MotionConfig reducedMotion="user">
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="brand-logo" role="img" aria-label="LeBonTaf">
            <span className="lbt-logo">
              <Mark size={38} busy={pipeline.running} />
              <Wordmark size={28} dark />
            </span>
          </span>
        </div>
        <p className="brand-tag">Ton alternance. Ton stage. Ton bon départ.</p>
        <nav aria-label="Navigation principale">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "navlink active" : "navlink"}
              onClick={() => go(id)}
              aria-current={view === id ? "page" : undefined}
            >
              {view === id && <motion.span layoutId="navpill" className="navpill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Icon size={18} aria-hidden />
              <span>{label}</span>
              {badge(id) > 0 && <b className="badge">{badge(id)}</b>}
            </button>
          ))}
        </nav>
        <nav className="subnav" aria-label="Autres pages">
          {subNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "navlink small active" : "navlink small"}
              onClick={() => go(id)}
              aria-current={view === id ? "page" : undefined}
            >
              {view === id && <motion.span layoutId="navpill" className="navpill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Icon size={16} aria-hidden />
              <span>{label}</span>
              {badge(id) > 0 && <b className="badge">{badge(id)}</b>}
            </button>
          ))}
        </nav>
        <div className="sidefoot">
          <span className="chip good">
            <ShieldCheck size={13} aria-hidden /> Jamais d’envoi automatique
          </span>
          {userEmail && <span className="muted small-text">{userEmail}</span>}
          {userEmail && (
            <form action={logout}>
              <button className="btn ghost small">
                <LogOut size={14} aria-hidden /> Déconnexion
              </button>
            </form>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="brand-logo" role="img" aria-label="LeBonTaf">
            <span className="lbt-logo">
              <Mark size={32} busy={pipeline.running} />
              <Wordmark size={24} />
            </span>
          </span>
          <span className="chip good">
            <ShieldCheck size={13} aria-hidden /> Aucun envoi auto
          </span>
        </header>

        {pipeline.running && (
          <div className="runbar" role="status">
            <LoaderCircle size={16} className="spin" aria-hidden />
            <div className="runbar-text">
              <strong>{p?.label || "Recherche en cours…"}</strong>
              <Progress value={percent} />
            </div>
            <button className="btn ghost small" onClick={pipeline.cancel}>
              Arrêter
            </button>
          </div>
        )}

        <main className="content">
          {statusFailed && !status && view !== "settings" && (
            <div style={{ marginBottom: 16 }}>
              <Callout tone="warn" title="On n’a pas pu vérifier l’état de ton espace">
                Certaines fonctions peuvent ne pas répondre. Recharge la page ; si ça continue, réessaie dans quelques minutes.
              </Callout>
            </div>
          )}
          {loadError && (
            <div className="callout bad" style={{ marginBottom: 16 }}>
              <div className="callout-body">
                <strong>Impossible de charger les données</strong>
                <div>{loadError}</div>
              </div>
            </div>
          )}
          <ErrorBoundary key={view} name={view}>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
          {loading ? (
            <div className="empty">
              <LoaderCircle className="spin" aria-hidden /> Chargement…
            </div>
          ) : view === "home" ? (
            <HomeView ctx={ctx} />
          ) : view === "jobs" ? (
            <JobsView ctx={ctx} />
          ) : view === "documents" ? (
            <DocumentsView ctx={ctx} />
          ) : view === "questions" ? (
            <>
              <PageHead
                title="Questions"
                subtitle="Réponds une fois : ta réponse est mémorisée pour les prochaines candidatures."
              />
              <QuestionsPanel rows={data.questions} supabase={supabase} reload={reload} notify={(t) => notify(t, "info")} />
            </>
          ) : view === "track" ? (
            <TrackView ctx={ctx} />
          ) : view === "activity" ? (
            <ActivityView ctx={ctx} />
          ) : view === "settings" ? (
            <SettingsView ctx={ctx} />
          ) : view === "admin" && status?.isAdmin ? (
            <AdminView ctx={ctx} />
          ) : view === "roadmap" ? (
            <RoadmapView />
          ) : (
            <MoreView ctx={ctx} badge={badge} />
          )}
          </motion.div>
          </ErrorBoundary>
        </main>
      </div>

      <nav className="tabbar" aria-label="Navigation mobile">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={activeTab === id ? "tab active" : "tab"}
            onClick={() => go(id)}
            aria-current={activeTab === id ? "page" : undefined}
          >
            {activeTab === id && <motion.span layoutId="tabpill" className="tabpill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="tabicon">
              <Icon size={22} aria-hidden />
              {badge(id) > 0 && <b className="badge">{badge(id)}</b>}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          <span>{toast.text}</span>
          <button className="iconbtn" aria-label="Fermer" onClick={() => notify("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <OfferPanel job={openJob} ctx={ctx} onClose={closeOffer} />

      <DocumentDialog
        state={docDialog}
        onClose={() => setDocDialog(null)}
        onDone={async (text) => {
          notify(text, "good");
          await reload();
        }}
      />

      <dialog ref={descModal} onClose={() => setDescJob(null)}>
        <div className="form">
          <div className="wide">
            <h2>Coller la description</h2>
            <p className="muted">
              {descJob ? `${descJob.company} · ${descJob.title}` : ""} — copie le texte de l’annonce
              (missions, profil, contrat) : c’est ce que l’IA lit pour calculer ton score.
            </p>
          </div>
          <label className="wide">
            Texte de l’annonce
            <textarea rows={10} value={descText} onChange={(e) => setDescText(e.target.value)} />
          </label>
          <div className="wide toolbar end">
            <button type="button" className="btn secondary" onClick={() => descModal.current?.close()}>
              Annuler
            </button>
            <button type="button" className="btn" disabled={descText.trim().length < DESCRIPTION_MIN_CHARS} onClick={() => void saveDescription()}>
              {descText.trim().length < DESCRIPTION_MIN_CHARS
                ? `Encore ${DESCRIPTION_MIN_CHARS - descText.trim().length} caractères pour pouvoir résumer l’offre`
                : "Enregistrer"}
            </button>
          </div>
        </div>
      </dialog>

      <dialog ref={addModal}>
        <form action={addJob} className="form">
          <div className="wide">
            <h2>Ajouter une offre</h2>
            <p className="muted">
              Colle le lien de l’annonce : l’assistant la lit tout seul. Sinon colle son texte.
            </p>
          </div>
          <label className="wide">
            Lien de l’offre
            <input name="official_url" type="url" placeholder="https://…" />
          </label>
          <label>
            Entreprise
            <input name="company" required />
          </label>
          <label>
            Poste
            <input name="title" required />
          </label>
          <label>
            Contrat
            <select name="contract_type" defaultValue="Alternance">
              <option>Alternance</option>
              <option>Stage</option>
              <option>CDI</option>
              <option>CDD</option>
            </select>
          </label>
          <label>
            Lieu
            <input name="location" defaultValue="Paris" />
          </label>
          <label className="wide">
            Description (facultatif si tu as mis le lien)
            <textarea name="description" rows={6} />
          </label>
          <div className="wide toolbar end">
            <button type="button" className="btn secondary" onClick={() => addModal.current?.close()}>
              Annuler
            </button>
            <button className="btn">Ajouter</button>
          </div>
        </form>
      </dialog>
    </div>
    </MotionConfig>
  );
}
