"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BriefcaseBusiness,
  CircleHelp,
  Ellipsis,
  FileText,
  House,
  LoaderCircle,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Gauge,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { explainError, cleanRaw } from "@/lib/errors";
import { fingerprintOf } from "@/lib/scan/ingest";
import type { DocumentRecord, Job } from "@/lib/types";
import { DocumentDialog, type DocumentDialogState } from "@/components/document-tools";
import { openQuestionCount, QuestionsPanel } from "@/components/questions-panel";
import { usePipeline } from "@/components/use-pipeline";
import { useDashboardData, type Data } from "@/components/use-dashboard-data";
import { useSystemStatus, type SystemStatus } from "@/components/use-status";
import { Callout, Progress } from "@/components/ui";
import { ErrorBoundary } from "@/components/error-boundary";
import { RoadmapView } from "@/components/views/roadmap-view";
import { HomeView } from "@/components/views/home-view";
import { JobsView } from "@/components/views/jobs-view";
import { DocumentsView } from "@/components/views/documents-view";
import { ApplicationsView } from "@/components/views/applications-view";
import { ActivityView } from "@/components/views/activity-view";
import { SettingsView } from "@/components/views/settings-view";
import { MoreView } from "@/components/views/more-view";
import { AdminView } from "@/components/views/admin-view";
import type { AdminOverview } from "@/lib/admin/overview";
import { PageHead } from "@/components/ui";
import type { Ctx, JobFilter, Tone, View } from "@/components/views/types";

const NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Accueil", icon: House },
  { id: "jobs", label: "Offres", icon: Search },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "questions", label: "Questions", icon: CircleHelp },
  { id: "applications", label: "Candidatures", icon: BriefcaseBusiness },
  { id: "activity", label: "Activité", icon: Activity },
  { id: "settings", label: "Réglages", icon: Settings },
];
const TABS: { id: View; label: string; icon: LucideIcon }[] = [
  ...NAV.slice(0, 4),
  { id: "more", label: "Plus", icon: Ellipsis },
];
const ADMIN_NAV = { id: "admin" as View, label: "Admin", icon: Gauge };
const VIEWS = new Set<string>([...NAV.map((n) => n.id), "more", "admin", "applications", "activity", "settings", "roadmap"]);
const MORE_VIEWS = new Set<View>(["more", "applications", "activity", "settings", "admin", "roadmap"]);

/** Server error → one readable sentence. */
function readable(raw: unknown): string {
  const text = cleanRaw(String(raw || "Erreur inconnue"));
  const e = explainError(text);
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
  const { supabase, data, loading, error: loadError, reload } = useDashboardData(demo?.data);
  const { status, failed: statusFailed, refresh: refreshStatus } = useSystemStatus(Boolean(supabase), demo?.status);
  const pipeline = usePipeline({ supabase, status, reload, refreshStatus });

  const [view, setView] = useState<View>("home");
  const [jobFilter, setJobFilter] = useState<JobFilter>("all");
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
      const hash = window.location.hash.slice(1);
      if (VIEWS.has(hash)) setView(hash as View);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const notify = useCallback((text: string, tone: Tone = "info") => {
    window.clearTimeout(toastTimer.current);
    setToast(text ? { text, tone } : null);
    if (text && tone !== "bad") toastTimer.current = window.setTimeout(() => setToast(null), 7000);
  }, []);

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
    setView(next);
    if (filter) setJobFilter(filter);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  }, []);

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

  const act: Ctx["act"] = useMemo(
    () => ({
      analyze: (job) =>
        run(job.id, async () => {
          notify(`Analyse de « ${job.company} » en cours…`);
          const r = await post(`/api/jobs/${job.id}/analyze`);
          if (!r.ok) return notify(readable(r.body.error), "bad");
          notify(`${job.company} : compatibilité ${r.body.total}/100.`, "good");
        }),
      generate: (job) =>
        run(job.id, async () => {
          notify(`Rédaction du CV et de la lettre pour « ${job.company} »…`);
          const r = await post(`/api/jobs/${job.id}/generate`);
          if (!r.ok) return notify(readable(r.body.error), "bad");
          const stats = (r.body.questionStats as { asked?: number }) || {};
          notify(
            `Documents prêts${stats.asked ? ` · ${stats.asked} question(s) à valider` : ""}.`,
            "good",
          );
        }),
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
    }),
    [notify, reload, run, supabase],
  );

  async function saveDescription() {
    if (!supabase || !descJob || descText.trim().length < 50) return;
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
    jobFilter,
    setJobFilter,
    act,
    adminDemo: demo?.admin,
  };
  const nav = status?.isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  const replaced = new Set(data.documents.map((d) => d.based_on_document_id).filter(Boolean));
  const toApprove = data.documents.filter((d: DocumentRecord) => !d.approved && !replaced.has(d.id)).length;
  const unread = data.notifications.filter((n) => !n.read_at).length;
  const openQuestions = openQuestionCount(data.questions);
  const sourceAlerts = data.notifications.filter((n) => !n.read_at && n.notification_type === "SOURCE_ALERT").length;
  const badge = (id: View) =>
    id === "questions"
      ? openQuestions
      : id === "documents"
        ? toApprove
        : id === "activity" || id === "more"
          ? unread
          : id === "admin"
            ? sourceAlerts
            : 0;
  const activeTab: View = MORE_VIEWS.has(view) ? "more" : view;

  const p = pipeline.progress;
  const phases = ["scan", "analyze", "generate", "prepare"] as const;
  const percent = p
    ? ((phases.indexOf(p.phase) + (p.total ? p.done / p.total : 0)) / phases.length) * 100
    : 0;

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="mark">JH</div>
          <div>
            <strong>Job Hunter</strong>
            <span className="muted">Ton assistant candidatures</span>
          </div>
        </div>
        <nav aria-label="Navigation principale">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "navlink active" : "navlink"}
              onClick={() => go(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={18} aria-hidden />
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
          <div className="brand">
            <div className="mark">JH</div>
            <strong>Job Hunter</strong>
          </div>
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
              <Callout tone="warn" title="État des connexions illisible">
                Le serveur n’a pas répondu à /api/status : les sources et l’IA peuvent ne pas fonctionner. Recharge la page ;
                si ça continue, regarde les journaux Vercel.
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
          ) : view === "applications" ? (
            <ApplicationsView ctx={ctx} />
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
            <button type="button" className="btn" disabled={descText.trim().length < 50} onClick={() => void saveDescription()}>
              Enregistrer
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
  );
}
