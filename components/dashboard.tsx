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
    [message, setMessage] = useState("");
  const modal = useRef<HTMLDialogElement>(null),
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
        .select("*")
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
    setJobs(j.data || []);
    setApps((a.data || []) as Application[]);
    setQuestions(q.data || []);
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
  async function runSmartPipeline() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const pending = jobs.filter((job) => job.status === "DISCOVERED" && job.description);
    if (!pending.length) {
      setMessage("Aucune nouvelle offre complète à traiter.");
      return;
    }
    setBusy("pipeline");
    let analyzed = 0, prepared = 0, failed = 0;
    for (const job of pending) {
      try {
        setMessage(`Analyse Gemini ${analyzed + 1}/${pending.length} · ${job.company}`);
        const analysisResponse = await fetch(`/api/jobs/${job.id}/analyze`, { method: "POST" });
        const analysis = await analysisResponse.json().catch(() => ({ error: `Réponse vide du serveur (${analysisResponse.status})` }));
        if (!analysisResponse.ok) throw new Error(analysis.error || "Analyse impossible");
        analyzed += 1;
        if (analysis.total >= 80) {
          const generationResponse = await fetch(`/api/jobs/${job.id}/generate`, { method: "POST" });
          const generation = await generationResponse.json();
          if (!generationResponse.ok) throw new Error(generation.error || "Génération impossible");
          prepared += 1;
          if (supabase) await supabase.from("notifications").insert({
            user_id: user.id,
            notification_type: "DOCUMENTS_READY",
            title: `${job.company} · documents prêts`,
            message: `${generation.documents?.length || 0} document(s) généré(s), ${generation.questions?.length || 0} question(s) à vérifier.`,
            action_url: job.official_url || job.source_url,
            delivery_channels: ["dashboard"],
          });
        }
      } catch {
        failed += 1;
      }
    }
    setBusy("");
    setMessage(`Pipeline terminé : ${analyzed} analysée(s), ${prepared} préparée(s), ${failed} échec(s).`);
    await load();
  }
  async function scanOffers() {
    setBusy("scan");
    setMessage("");
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Scan impossible");
      setMessage(body.message || "Scan lancé. Les nouvelles offres apparaîtront automatiquement.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scan impossible.");
    } finally {
      setBusy("");
    }
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
        <Metric
          label="Blocages"
          value={questions.filter((q) => q.blocking && !q.approved).length}
        />
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
              onClick={() => setTab(String(id))}
            >
              <Icon size={16} /> {String(label)}
            </button>
          ))}
        </nav>
        <div className="card">
          {message && (
            <p
              className={
                /Erreur|impossible|absent|introuvable|Ajoutez/.test(message)
                  ? "error"
                  : "alert"
              }
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
            <Jobs jobs={jobs} busy={busy} action={action} />
          ) : tab === "applications" ? (
            <Applications rows={apps} busy={busy} prepare={prepare} />
          ) : tab === "documents" ? (
            <Documents
              rows={documents}
              busy={busy}
              approve={(id) => action(id, `/api/documents/${id}/approve`)}
              upload={(id) => action(id, `/api/documents/${id}/drive`)}
            />
          ) : tab === "notifications" ? (
            <Notifications rows={notifications} markRead={markNotificationRead} />
          ) : tab === "questions" ? (
            <Questions rows={questions} />
          ) : tab === "runs" ? (
            <Runs rows={runs} />
          ) : (
            <SettingsPanel configured={Boolean(supabase)} />
          )}
        </div>
      </section>
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
}: {
  jobs: Job[];
  busy: string;
  action: (l: string, u: string) => Promise<void>;
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
}: {
  rows: DocumentRecord[];
  busy: string;
  approve: (id: string) => Promise<void>;
  upload: (id: string) => Promise<void>;
}) {
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
        {rows.map((d) => (
          <tr key={d.id}>
            <td>
              <strong>{d.filename}</strong>
              <br />
              <span className="muted">
                {d.jobs?.company} · {d.kind}
              </span>
            </td>
            <td>v{d.version}</td>
            <td>
              {d.storage_path ? (
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
                {!d.approved && (
                  <button
                    className="btn small"
                    disabled={Boolean(busy)}
                    onClick={() => approve(d.id)}
                  >
                    Approuver
                  </button>
                )}
                {d.approved && !d.storage_path && (
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
        ))}
      </tbody>
    </table>
  ) : (
    <Empty text="Aucun document généré." />
  );
}
function Questions({ rows }: { rows: Question[] }) {
  return rows.length ? (
    <table>
      <thead>
        <tr>
          <th>Question</th>
          <th>Catégorie</th>
          <th>Réponse</th>
          <th>État</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((q) => (
          <tr key={q.id}>
            <td>{q.question}</td>
            <td>{q.category}</td>
            <td>{q.answer || "À confirmer"}</td>
            <td>
              <span className="status">
                {q.approved ? "APPROUVÉE" : "BLOQUANTE"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <Empty text="Aucune question en attente." />
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
