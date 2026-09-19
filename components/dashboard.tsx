"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Bell,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Play,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  AgentRun,
  Application,
  DocumentRecord,
  Job,
  Question,
  NotificationRecord,
} from "@/lib/types";
import { logout } from "@/app/login/actions";
import { QuestionsPanel, openQuestionCount } from "@/components/questions-panel";
import { DocumentDialog, type DocumentDialogState } from "@/components/document-tools";
type SystemStatus = {
  applicationMode: string;
  safeMode: boolean;
  explicitModeVariable: boolean;
  gemini: boolean;
  drive: boolean;
  worker: boolean;
  scanSources: { franceTravail: boolean; gmailAlerts: boolean; webhook: boolean };
  scheduledScan: boolean;
};
const ERROR_MESSAGE =
  /Erreur|impossible|absent|introuvable|Ajoutez|refus|injoignable|non configur|pas encore|invalide|Aucune source/i;

export function Dashboard({ userEmail = "" }: { userEmail?: string }) {
  const [tab, setTab] = useState("jobs"),
    [jobs, setJobs] = useState<Job[]>([]),
    [apps, setApps] = useState<Application[]>([]),
    [questions, setQuestions] = useState<Question[]>([]),
    [documents, setDocuments] = useState<DocumentRecord[]>([]),
    [notifications, setNotifications] = useState<NotificationRecord[]>([]),
    [runs, setRuns] = useState<AgentRun[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [docDialog, setDocDialog] = useState<DocumentDialogState>(null),
    [descJob, setDescJob] = useState<Job | null>(null),
    [descText, setDescText] = useState(""),
    [status, setStatus] = useState<SystemStatus | null>(null);
  const modal = useRef<HTMLDialogElement>(null),
    descModal = useRef<HTMLDialogElement>(null),
    supabase = useMemo(() => createClient(), []);
  async function load() {
    setLoading(true);
    if (!supabase) {
      setMessage("Variables Supabase absentes.");
      setLoading(false);
      return;
    }
    const [j, a, q, d, r, n] = await Promise.all([
      supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("applications")
        .select("*,jobs(company,title)")
        .order("created_at", { ascending: false }),
      supabase
        .from("application_questions")
        .select("*,applications(jobs(company,title))")
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("*,jobs(company,title)")
        .order("created_at", { ascending: false }),
      supabase
        .from("agent_runs")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    let questionRows = q.data as Question[] | null;
    if (q.error) {
      // The join is only a nicety: fall back to the plain table if it fails.
      const plain = await supabase
        .from("application_questions")
        .select("*")
        .order("created_at", { ascending: false });
      questionRows = plain.data as Question[] | null;
    }
    setJobs(j.data || []);
    setApps((a.data || []) as Application[]);
    setQuestions(questionRows || []);
    setDocuments((d.data || []) as DocumentRecord[]);
    setRuns((r.data || []) as AgentRun[]);
    setNotifications((n.data || []) as NotificationRecord[]);
    setLoading(false);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    if (!supabase) return () => window.clearTimeout(timer);
    const channel = supabase
      .channel("job-hunter-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void load())
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // The Supabase client is stable for the lifetime of this dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Scores every complete DISCOVERED offer, then prepares documents for >= 80. */
  async function processPending(): Promise<string> {
    if (!supabase) return "";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "";
    const { data: pendingRows } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "DISCOVERED")
      .not("description", "is", null);
    const pending = ((pendingRows || []) as Job[]).filter((job) => job.description);
    if (!pending.length) return "Aucune nouvelle offre complète à traiter.";
    let analyzed = 0,
      prepared = 0,
      failed = 0;
    const errors: string[] = [];
    for (const job of pending) {
      try {
        setMessage(`Analyse Gemini ${analyzed + 1}/${pending.length} · ${job.company}`);
        const analysisResponse = await fetch(`/api/jobs/${job.id}/analyze`, { method: "POST" });
        const analysis = await analysisResponse
          .json()
          .catch(() => ({ error: `Réponse vide du serveur (${analysisResponse.status})` }));
        if (!analysisResponse.ok) throw new Error(analysis.error || "Analyse impossible");
        analyzed += 1;
        if (analysis.total >= 80) {
          const generationResponse = await fetch(`/api/jobs/${job.id}/generate`, { method: "POST" });
          const generation = await generationResponse.json();
          if (!generationResponse.ok) throw new Error(generation.error || "Génération impossible");
          prepared += 1;
          const stats = generation.questionStats || {};
          await supabase.from("notifications").insert({
            user_id: user.id,
            notification_type: "DOCUMENTS_READY",
            title: `${job.company} · documents prêts`,
            message: `${generation.documents?.length || 0} document(s) généré(s), ${stats.asked ?? generation.questions?.length ?? 0} question(s) à valider${stats.autoAnswered ? `, ${stats.autoAnswered} reprise(s) de ta mémoire` : ""}.`,
            action_url: job.official_url || job.source_url,
            delivery_channels: ["dashboard"],
          });
        }
      } catch (e) {
        failed += 1;
        if (e instanceof Error && errors.length < 2) errors.push(`${job.company} : ${e.message}`);
      }
    }
    return `Pipeline terminé : ${analyzed} analysée(s), ${prepared} préparée(s), ${failed} échec(s).${errors.length ? ` Erreur : ${errors.join(" ; ")}` : ""}`;
  }
  async function runSmartPipeline() {
    setBusy("pipeline");
    try {
      setMessage(await processPending());
    } finally {
      setBusy("");
    }
    await load();
  }
  async function scanOffers() {
    setBusy("scan");
    setMessage("");
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Scan impossible");
      let text: string = body.message || "Scan terminé.";
      await load();
      if (body.inserted > body.needsDescription) {
        // New offers with a full description: score them right away.
        setMessage(`${text} Analyse des nouvelles offres…`);
        text += ` ${await processPending()}`;
      }
      setMessage(text);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scan impossible.");
    } finally {
      setBusy("");
      await load();
    }
  }
  async function saveDescription() {
    if (!supabase || !descJob || descText.trim().length < 50) return;
    const { error } = await supabase
      .from("jobs")
      .update({ description: descText.trim() })
      .eq("id", descJob.id);
    setMessage(error ? `Erreur : ${error.message}` : "Description enregistrée : tu peux analyser l’offre.");
    descModal.current?.close();
    setDescJob(null);
    setDescText("");
    await load();
  }
  async function markNotificationRead(id: string) {
    if (!supabase) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    await load();
  }
  async function addJob(form: FormData) {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const company = String(form.get("company")),
      title = String(form.get("title"));
    const { error } = await supabase.from("jobs").insert({
      user_id: user.id,
      company,
      title,
      contract_type: form.get("contract_type"),
      location: form.get("location"),
      description: form.get("description"),
      official_url: form.get("official_url") || null,
      source_url: form.get("official_url") || null,
      fingerprint: `${company}|${title}|${form.get("location")}`.toLowerCase(),
      status: "DISCOVERED",
    });
    setMessage(error ? error.message : "Offre enregistrée.");
    if (!error) {
      modal.current?.close();
      await load();
    }
  }
  async function action(label: string, url: string) {
    setBusy(label);
    setMessage("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Action impossible");
      setMessage(
        label === "analyze"
          ? `Analyse terminée : ${body.total}/100.`
          : label === "generate"
            ? `${body.documents?.length || 0} document(s) créé(s), ${body.questions?.length || 0} question(s) bloquante(s).`
            : "Action terminée.",
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy("");
    }
  }
  async function prepare(applicationId: string) {
    setBusy(applicationId);
    try {
      const r = await fetch("/api/worker/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId, action: "prepare" }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Worker indisponible");
      setMessage(
        `Inspection terminée : ${body.fields?.length || 0} champ(s), ${body.questions?.length || 0} blocage(s).`,
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    if (tab !== "settings") return;
    void fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setStatus(body))
      .catch(() => setStatus(null));
  }, [tab]);
  const high = jobs.filter((j) => (j.match_score || 0) >= 80).length;
  const unread = notifications.filter((n) => !n.read_at).length;
  return (
    <main className="shell">
      <header className="top">
        <div className="brand">
          <div className="mark">JH</div>
          <div>
            <div className="eyebrow">AI Agent Hunter</div>
            <h1>Job Hunter Control</h1>
            <div className="muted">Pipeline sécurisé de Yassine</div>
          </div>
        </div>
        <div className="toolbar">
          <span className="muted">{userEmail}</span>
          <span className="mode">
            <ShieldCheck size={14} /> PREPARE_ONLY
          </span>
          {userEmail && (
            <form action={logout}>
              <button className="btn secondary">Déconnexion</button>
            </form>
          )}
        </div>
      </header>
      <section className="grid">
        <Metric label="Offres" value={jobs.length} />
        <Metric label="Score ≥ 80" value={high} />
        <Metric label="À traiter" value={jobs.filter((j) => j.status === "DISCOVERED").length} />
        <Metric label="Documents" value={documents.length} />
        <Metric label="Blocages" value={openQuestionCount(questions)} />
      </section>
      <section className="layout">
        <nav className="card nav">
          {[
            ["jobs", LayoutDashboard, "Offres"],
            ["applications", BriefcaseBusiness, "Candidatures"],
            ["documents", FileText, "Documents"],
            ["notifications", Bell, `Notifications${unread ? ` (${unread})` : ""}`],
            ["questions", HelpCircle, "Questions"],
            ["runs", Play, "Exécutions"],
            ["settings", Settings, "Réglages"],
          ].map(([id, Icon, label]) => (
            <button
              key={String(id)}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(String(id));
                setMessage("");
              }}
            >
              <Icon size={16} /> {String(label)}
            </button>
          ))}
        </nav>
        <div className="card">
          {message && (
            <p
              className={ERROR_MESSAGE.test(message) ? "error" : "alert"}
            >
              {message}
            </p>
          )}
          <div className="panel-head">
            <div>
              <h2>
                {
                  (
                    {
                      jobs: "Pipeline des offres",
                      applications: "Candidatures",
                      documents: "Documents générés",
                      notifications: "Centre de notifications",
                      questions: "Questions à valider",
                      runs: "Journal d’exécution",
                      settings: "Configuration",
                    } as Record<string, string>
                  )[tab]
                }
              </h2>
              <p className="muted">
                Analyse, génération et préparation contrôlées. La soumission
                reste désactivée.
              </p>
            </div>
            {tab === "jobs" && (
              <div className="toolbar">
                <button className="btn smart" disabled={Boolean(busy)} onClick={() => void runSmartPipeline()}>
                  {busy === "pipeline" ? "Pipeline en cours…" : "Lancer le pipeline intelligent"}
                </button>
                <button className="btn" disabled={Boolean(busy)} onClick={() => void scanOffers()}>
                  {busy === "scan" ? "Scan en cours…" : "Scanner les offres maintenant"}
                </button>
                <button className="btn secondary" onClick={() => void load()}>
                  Actualiser
                </button>
                <button
                  className="btn"
                  onClick={() => modal.current?.showModal()}
                >
                  Ajouter une offre
                </button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="empty">Chargement…</div>
          ) : tab === "jobs" ? (
            <Jobs
              jobs={jobs}
              busy={busy}
              action={action}
              addDescription={(job) => {
                setDescJob(job);
                setDescText("");
                descModal.current?.showModal();
              }}
            />
          ) : tab === "applications" ? (
            <Applications rows={apps} busy={busy} prepare={prepare} />
          ) : tab === "documents" ? (
            <Documents
              rows={documents}
              busy={busy}
              approve={(id) => action(id, `/api/documents/${id}/approve`)}
              upload={(id) => action(id, `/api/documents/${id}/drive`)}
              revise={(doc) => setDocDialog({ doc, mode: "revise" })}
              edit={(doc) => setDocDialog({ doc, mode: "edit" })}
            />
          ) : tab === "notifications" ? (
            <Notifications rows={notifications} markRead={markNotificationRead} />
          ) : tab === "questions" ? (
            <QuestionsPanel
              rows={questions}
              supabase={supabase}
              reload={load}
              notify={setMessage}
            />
          ) : tab === "runs" ? (
            <Runs rows={runs} />
          ) : (
            <SettingsPanel configured={Boolean(supabase)} status={status} />
          )}
        </div>
      </section>
      <DocumentDialog
        state={docDialog}
        onClose={() => setDocDialog(null)}
        onDone={async (text) => {
          setMessage(text);
          await load();
        }}
      />
      <dialog ref={descModal} onClose={() => setDescJob(null)}>
        <div className="form">
          <div className="wide">
            <h2>Description de l’offre</h2>
            <p className="muted">
              {descJob ? `${descJob.company} · ${descJob.title}` : ""} — colle le texte complet de
              l’annonce (missions, profil, contrat) pour activer l’analyse Gemini.
            </p>
          </div>
          <label className="wide">
            Description complète
            <textarea rows={12} value={descText} onChange={(e) => setDescText(e.target.value)} />
          </label>
          <div className="wide toolbar">
            <button type="button" className="btn secondary" onClick={() => descModal.current?.close()}>
              Annuler
            </button>
            <button
              type="button"
              className="btn"
              disabled={descText.trim().length < 50}
              onClick={() => void saveDescription()}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </dialog>
      <dialog ref={modal}>
        <form action={addJob} className="form">
          <div className="wide">
            <h2>Nouvelle offre</h2>
            <p className="muted">
              Collez la description complète pour activer l’analyse Gemini.
            </p>
          </div>
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
            <select name="contract_type">
              <option>Alternance</option>
              <option>Stage</option>
              <option>CDI</option>
            </select>
          </label>
          <label>
            Lieu
            <input name="location" defaultValue="Paris" />
          </label>
          <label className="wide">
            URL officielle
            <input name="official_url" type="url" />
          </label>
          <label className="wide">
            Description complète
            <textarea name="description" rows={10} required />
          </label>
          <div className="wide toolbar">
            <button
              type="button"
              className="btn secondary"
              onClick={() => modal.current?.close()}
            >
              Annuler
            </button>
            <button className="btn">Enregistrer</button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="muted">{label}</div>
      <div className="metric">{value}</div>
    </div>
  );
}
function Jobs({
  jobs,
  busy,
  action,
  addDescription,
}: {
  jobs: Job[];
  busy: string;
  action: (l: string, u: string) => Promise<void>;
  addDescription: (job: Job) => void;
}) {
  return jobs.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Entreprise / poste</th>
            <th>Score</th>
            <th>Source</th>
            <th>Statut</th>
            <th>Commandes</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <strong>{j.company}</strong>
                <br />
                <span className="muted">
                  {j.title} · {j.location || "—"}
                </span>
              </td>
              <td className="score">{j.match_score ?? "—"}</td>
              <td>{j.source_url ? <a href={j.source_url} target="_blank">Ouvrir</a> : "Manuelle"}</td>
              <td>
                <span className={`status ${j.status.toLowerCase()}`}>
                  {j.status}
                </span>
              </td>
              <td>
                <div className="toolbar">
                  {!j.description && (
                    <button
                      className="btn secondary small"
                      disabled={Boolean(busy)}
                      onClick={() => addDescription(j)}
                    >
                      Coller la description
                    </button>
                  )}
                  <button
                    className="btn small"
                    disabled={Boolean(busy) || !j.description}
                    onClick={() =>
                      action("analyze", `/api/jobs/${j.id}/analyze`)
                    }
                  >
                    Analyser
                  </button>
                  <button
                    className="btn secondary small"
                    disabled={Boolean(busy) || j.status !== "ANALYZED"}
                    onClick={() =>
                      action("generate", `/api/jobs/${j.id}/generate`)
                    }
                  >
                    Générer CV/lettre
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="Aucune offre. Ajoutez une offre et sa description." />
  );
}
function Notifications({ rows, markRead }: { rows: NotificationRecord[]; markRead: (id: string) => Promise<void> }) {
  return rows.length ? (
    <div className="feed">
      {rows.map((n) => (
        <article className={`notice ${n.read_at ? "read" : "unread"}`} key={n.id}>
          <div>
            <span className="eyebrow">{n.notification_type}</span>
            <h3>{n.title}</h3>
            <p>{n.message}</p>
            <span className="muted">{new Date(n.created_at).toLocaleString("fr-FR")}</span>
          </div>
          <div className="toolbar">
            {n.action_url && <a className="btn secondary small" href={n.action_url} target="_blank">Ouvrir</a>}
            {!n.read_at && <button className="btn small" onClick={() => void markRead(n.id)}>Marquer lu</button>}
          </div>
        </article>
      ))}
    </div>
  ) : <Empty text="Aucune notification." />;
}
function Applications({
  rows,
  busy,
  prepare,
}: {
  rows: Application[];
  busy: string;
  prepare: (id: string) => Promise<void>;
}) {
  return rows.length ? (
    <table>
      <thead>
        <tr>
          <th>Entreprise / poste</th>
          <th>Statut</th>
          <th>Commande</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td>
              {a.jobs?.company || "—"}
              <br />
              <span className="muted">{a.jobs?.title}</span>
            </td>
            <td>
              <span className="status">{a.status}</span>
            </td>
            <td>
              <button
                className="btn small"
                disabled={Boolean(busy)}
                onClick={() => prepare(a.id)}
              >
                Inspecter avec Playwright
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <Empty text="Aucune candidature préparée." />
  );
}
function Documents({
  rows,
  busy,
  approve,
  upload,
  revise,
  edit,
}: {
  rows: DocumentRecord[];
  busy: string;
  approve: (id: string) => Promise<void>;
  upload: (id: string) => Promise<void>;
  revise: (doc: DocumentRecord) => void;
  edit: (doc: DocumentRecord) => void;
}) {
  // A document is "replaced" once a newer version was created from it.
  const replacedBy = new Map<string, DocumentRecord>();
  for (const d of rows)
    if (d.based_on_document_id) replacedBy.set(d.based_on_document_id, d);
  return rows.length ? (
    <table>
      <thead>
        <tr>
          <th>Document</th>
          <th>Version</th>
          <th>État</th>
          <th>Commandes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => {
          const newer = replacedBy.get(d.id);
          return (
            <tr key={d.id} className={newer ? "replaced" : ""}>
              <td>
                <strong>{d.filename}</strong>
                <br />
                <span className="muted">
                  {d.jobs?.company} · {d.kind}
                </span>
              </td>
              <td>v{d.version}</td>
              <td>
                {newer ? (
                  `Remplacé par v${newer.version}`
                ) : d.storage_path ? (
                  <a href={d.storage_path} target="_blank">
                    Drive
                  </a>
                ) : d.approved ? (
                  "Approuvé"
                ) : (
                  "Brouillon"
                )}
              </td>
              <td>
                <div className="toolbar">
                  <a
                    className="btn secondary small"
                    href={`/api/documents/${d.id}/pdf`}
                    target="_blank"
                  >
                    Aperçu PDF
                  </a>
                  {!newer && (
                    <>
                      <button
                        className="btn secondary small"
                        disabled={Boolean(busy)}
                        onClick={() => revise(d)}
                      >
                        Demander une modification
                      </button>
                      <button
                        className="btn secondary small"
                        disabled={Boolean(busy)}
                        onClick={() => edit(d)}
                      >
                        Modifier moi-même
                      </button>
                    </>
                  )}
                  {!newer && !d.approved && (
                    <button
                      className="btn small"
                      disabled={Boolean(busy)}
                      onClick={() => approve(d.id)}
                    >
                      Approuver
                    </button>
                  )}
                  {!newer && d.approved && !d.storage_path && (
                    <button
                      className="btn small"
                      disabled={Boolean(busy)}
                      onClick={() => upload(d.id)}
                    >
                      Envoyer vers Drive
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : (
    <Empty text="Aucun document généré." />
  );
}
function Runs({ rows }: { rows: AgentRun[] }) {
  return rows.length ? (
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Statut</th>
          <th>Date</th>
          <th>Détail</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.run_type}</td>
            <td>
              <span className="status">{r.status}</span>
            </td>
            <td>{new Date(r.created_at).toLocaleString("fr-FR")}</td>
            <td>{r.error_message || JSON.stringify(r.counters)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <Empty text="Aucune exécution enregistrée." />
  );
}
function Flag({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <p>
      {label} : <strong className={ok ? "ok" : "error"}>{ok ? "connecté" : "non configuré"}</strong>
      {!ok && hint && <span className="muted"> — {hint}</span>}
    </p>
  );
}
function SettingsPanel({
  configured,
  status,
}: {
  configured: boolean;
  status: SystemStatus | null;
}) {
  return (
    <div>
      <p className="alert">
        PREPARE_ONLY : jamais de clic final. CAPTCHA, MFA, consentement légal ou
        donnée inconnue provoquent une pause.
      </p>
      <p>
        Supabase : <strong>{configured ? "configuré" : "absent"}</strong>
      </p>
      {!status ? (
        <p className="muted">Chargement de l’état des connexions…</p>
      ) : (
        <>
          <p>
            Mode : <strong>{status.applicationMode}</strong>
            {!status.explicitModeVariable && (
              <span className="muted"> (par défaut ; APPLICATION_MODE n’est pas défini dans Vercel)</span>
            )}
          </p>
          <Flag ok={status.gemini} label="Gemini (analyse + CV)" hint="GEMINI_API_KEY" />
          <Flag ok={status.drive} label="Google Drive" hint="GOOGLE_SERVICE_ACCOUNT_JSON + IDs de dossiers" />
          <Flag ok={status.worker} label="Playwright (Railway)" hint="WORKER_BASE_URL + WORKER_SHARED_SECRET" />
          <Flag ok={status.scanSources.franceTravail} label="Scan · France Travail" hint="FRANCE_TRAVAIL_CLIENT_ID / _SECRET" />
          <Flag ok={status.scanSources.gmailAlerts} label="Scan · alertes e-mail (LinkedIn, Indeed, Hellowork…)" hint="GMAIL_CLIENT_ID / _SECRET / GMAIL_REFRESH_TOKEN" />
          <Flag ok={status.scanSources.webhook} label="Scan · scanner externe" hint="SCAN_WEBHOOK_URL (optionnel)" />
          <Flag ok={status.scheduledScan} label="Scan automatique quotidien" hint="CRON_SECRET + SCAN_USER_ID + SUPABASE_SERVICE_ROLE_KEY (optionnel)" />
        </>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
