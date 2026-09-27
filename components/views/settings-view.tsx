"use client";
import { useEffect, useState } from "react";
import { CircleCheck, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { Callout, Chip, PageHead } from "@/components/ui";
import { PROVIDERS, type ProviderDef } from "@/lib/providers";
import type { ProviderStatus } from "@/lib/integrations";
import { DEFAULT_PREFS, MAX_TARGETS, type ScanPrefs } from "@/lib/scan/config";
import { parseAtsTarget } from "@/lib/scan/sources/ats";
import { timeAgo } from "@/lib/labels";
import type { SystemStatus } from "@/components/use-status";
import type { Ctx } from "./types";

export function SettingsView({ ctx }: { ctx: Ctx }) {
  const { status, statusFailed } = ctx;
  return (
    <>
      <PageHead title="Réglages" subtitle="Connecte tes sources d’offres et choisis ce que l’assistant cherche." />
      {statusFailed && !status && (
        <Callout tone="bad" title="Impossible de lire l’état des connexions">
          Recharge la page. Si ça continue, vérifie que tu es bien connecté.
        </Callout>
      )}
      <SourcesSection ctx={ctx} />
      <SearchSection ctx={ctx} />
      <SystemSection status={status} ctx={ctx} />
    </>
  );
}

/* ------------------------------------------------------------------ Sources */

function SourcesSection({ ctx }: { ctx: Ctx }) {
  const { status } = ctx;
  const main = PROVIDERS.filter((p) => !p.advanced);
  const advanced = PROVIDERS.filter((p) => p.advanced);
  const byId = (id: string) => status?.providers.find((p) => p.id === id);
  const anyConfigured = Boolean(status?.scanConfigured);

  return (
    <section className="settings-section">
      <h2 className="section-title">1 · Où chercher les offres</h2>
      <p className="muted">
        LinkedIn, Indeed et les autres interdisent qu’un robot les parcoure directement. On passe donc par des services
        officiels qui les regroupent. Il suffit d’en connecter <strong>un seul</strong> pour chercher sur tout internet.
      </p>
      {status && !status.integrationsSecret && (
        <Callout tone="warn" title="Chiffrement non activé">
          Pour enregistrer une clé ici, il faut la variable <code>INTEGRATIONS_SECRET</code> dans Vercel (une longue phrase
          au hasard). Sans elle, ajoute directement les clés dans Vercel.
        </Callout>
      )}
      {!anyConfigured && status && (
        <Callout tone="info" title="Commence par JSearch">
          C’est la source la plus large (elle lit Google Emplois, donc LinkedIn, Indeed, Welcome to the Jungle, Hellowork…).
        </Callout>
      )}
      <div className="cards">
        {main.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} state={byId(provider.id)} ctx={ctx} />
        ))}
      </div>
      {advanced.length > 0 && (
        <details className="why">
          <summary>Sources avancées</summary>
          <div className="cards" style={{ marginTop: 12 }}>
            {advanced.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} state={byId(provider.id)} ctx={ctx} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function ProviderCard({
  provider,
  state,
  ctx,
}: {
  provider: ProviderDef;
  state: ProviderStatus | undefined;
  ctx: Ctx;
}) {
  const { status, refreshStatus, notify } = ctx;
  const [values, setValues] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<"" | "save" | "test" | "delete">("");
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const configured = Boolean(state?.configured);
  const canSave = Boolean(status?.integrationsSecret);
  const filled = provider.fields.every((f) => values[f.key]?.trim());

  async function call(kind: "save" | "test" | "delete") {
    setWorking(kind);
    setTest(null);
    try {
      if (kind === "save") {
        const response = await fetch("/api/integrations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider: provider.id, values }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Enregistrement impossible");
        setValues({});
        await refreshStatus();
        notify("Clé enregistrée (chiffrée). Teste-la avec le bouton « Tester ».", "good");
      } else if (kind === "delete") {
        const response = await fetch(`/api/integrations?provider=${provider.id}`, { method: "DELETE" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Suppression impossible");
        await refreshStatus();
        notify("Clé supprimée.", "info");
      } else {
        const response = await fetch("/api/integrations/test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider: provider.id }),
        });
        const body = await response.json().catch(() => ({}));
        setTest(
          body.ok
            ? {
                ok: true,
                text: `Ça marche : ${body.count} offre${body.count > 1 ? "s" : ""} trouvée${body.count > 1 ? "s" : ""}${body.sample?.length ? ` (ex. ${body.sample[0]})` : ""}.`,
              }
            : { ok: false, text: body.error || "Le test a échoué." },
        );
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erreur", "bad");
    } finally {
      setWorking("");
    }
  }

  return (
    <article className={`card source ${configured ? "on" : ""}`}>
      <header className="source-head">
        <div>
          <h3>{provider.name}</h3>
          <p className="muted">{provider.covers}</p>
        </div>
        {configured ? (
          <Chip tone="good">
            <CircleCheck size={12} aria-hidden /> Connectée
          </Chip>
        ) : provider.recommended ? (
          <Chip tone="info">Recommandée</Chip>
        ) : (
          <Chip>À connecter</Chip>
        )}
      </header>
      <p className="muted small-text">
        {provider.free} · {provider.effort}
        {state?.origin === "env" && " · configurée dans Vercel"}
        {state?.origin === "app" && state.hint && ` · clé ${state.hint}`}
      </p>
      {state?.needsReset && (
        <Callout tone="warn" title="Clé illisible">
          Le secret de chiffrement a changé : saisis la clé à nouveau.
        </Callout>
      )}
      <details className="why" open={!configured && provider.recommended}>
        <summary>{configured ? "Modifier la clé" : "Comment la connecter"}</summary>
        <ol className="howto">
          {provider.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <a className="btn secondary small" href={provider.url} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden /> {provider.urlLabel}
        </a>
        <form
          className="keyform"
          onSubmit={(e) => {
            e.preventDefault();
            if (filled && canSave) void call("save");
          }}
        >
          {provider.fields.map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                placeholder={field.placeholder || (configured ? "Laisse vide pour garder l’actuelle" : "Colle ici")}
                value={values[field.key] ?? ""}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              />
            </label>
          ))}
          <div className="toolbar">
            <button className="btn" disabled={!filled || !canSave || Boolean(working)}>
              {working === "save" ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </details>
      {configured && (
        <div className="toolbar">
          <button className="btn secondary" disabled={Boolean(working)} onClick={() => void call("test")}>
            {working === "test" && <LoaderCircle size={15} className="spin" aria-hidden />} Tester
          </button>
          {state?.origin === "app" && (
            <button className="btn ghost" disabled={Boolean(working)} onClick={() => void call("delete")}>
              Supprimer la clé
            </button>
          )}
        </div>
      )}
      {test && (
        <p className={test.ok ? "ok-text" : "error-text"} role="status">
          {test.text}
        </p>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------- Search */

const CONTRACTS = [
  ["alternance", "Alternance"],
  ["stage", "Stage"],
  ["cdi", "CDI"],
  ["cdd", "CDD"],
] as const;

const split = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

function SearchSection({ ctx }: { ctx: Ctx }) {
  const { notify, status, refreshStatus } = ctx;
  const [prefs, setPrefs] = useState<ScanPrefs>(DEFAULT_PREFS);
  const [keywords, setKeywords] = useState(DEFAULT_PREFS.keywords.join(", "));
  const [departments, setDepartments] = useState(DEFAULT_PREFS.departments.join(", "));
  const [targets, setTargets] = useState("");
  const [auto, setAuto] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setPrefs(body.prefs);
        setKeywords(body.prefs.keywords.join(", "));
        setDepartments(body.prefs.departments.join(", "));
        setTargets((body.prefs.targets ?? []).join("\n"));
        setAuto(body.autoScan !== false);
        setLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prefs: {
            ...prefs,
            keywords: split(keywords),
            departments: split(departments),
            targets: targets.split(/\n+/).map((t) => t.trim()).filter(Boolean),
          },
          autoScan: auto,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Enregistrement impossible");
      setPrefs(body.prefs);
      setKeywords(body.prefs.keywords.join(", "));
      setDepartments(body.prefs.departments.join(", "));
      setTargets((body.prefs.targets ?? []).join("\n"));
      await refreshStatus();
      notify("Recherche enregistrée. Elle sera utilisée au prochain lancement.", "good");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erreur", "bad");
    } finally {
      setSaving(false);
    }
  }

  const lines = targets.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const unknown = lines.filter((line) => !parseAtsTarget(line));

  const toggle = (value: string) =>
    setPrefs({
      ...prefs,
      contracts: prefs.contracts.includes(value) ? prefs.contracts.filter((c) => c !== value) : [...prefs.contracts, value],
    });

  return (
    <section className="settings-section">
      <h2 className="section-title">2 · Ce que tu cherches</h2>
      <form
        className="card form searchform"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset className="wide">
          <legend>Type de contrat</legend>
          <div className="chips">
            {CONTRACTS.map(([id, label]) => (
              <label key={id} className={prefs.contracts.includes(id) ? "pill active" : "pill"}>
                <input
                  type="checkbox"
                  className="sr"
                  checked={prefs.contracts.includes(id)}
                  onChange={() => toggle(id)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="wide">
          Métiers ou mots-clés
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="développeur, intelligence artificielle, data" />
          <small className="muted">Sépare-les par des virgules (8 maximum).</small>
        </label>
        <label>
          Ville
          <input value={prefs.city} onChange={(e) => setPrefs({ ...prefs, city: e.target.value })} />
        </label>
        <label>
          Départements (France Travail)
          <input value={departments} onChange={(e) => setDepartments(e.target.value)} placeholder="75, 92, 93" />
        </label>
        <label>
          Offres publiées depuis
          <select value={prefs.maxAgeDays} onChange={(e) => setPrefs({ ...prefs, maxAgeDays: Number(e.target.value) })}>
            {[7, 14, 30, 60].map((d) => (
              <option key={d} value={d}>
                {d} jours
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Entreprises à surveiller directement (facultatif)
          <textarea
            className="targets"
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            placeholder={"https://jobs.lever.co/mistral\nhttps://boards.greenhouse.io/doctolib\nhttps://jobs.ashbyhq.com/qonto"}
          />
          <small className="muted">
            Colle le lien de la page carrière d’une entreprise (une par ligne, {MAX_TARGETS} maximum). Pris en charge :
            Greenhouse, Lever, Ashby, SmartRecruiters, Workable. Leurs offres sont lues à la source, sans clé, souvent avant
            LinkedIn ou Indeed.
          </small>
          {unknown.length > 0 && (
            <small className="warn-text">
              Non reconnu{unknown.length > 1 ? "s" : ""} (ignoré{unknown.length > 1 ? "s" : ""} à l’enregistrement) :{" "}
              {unknown.slice(0, 3).join(", ")}
            </small>
          )}
        </label>
        <label className="check switch wide">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          {status?.scheduledScan
            ? "Recherche automatique sur le serveur, même appli fermée (au plus toutes les 12 h)"
            : "Chercher automatiquement à l’ouverture de l’appli (au plus toutes les 12 h)"}
        </label>
        <div className="wide toolbar">
          <button className="btn" disabled={saving || !loaded}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {status?.lastScanAt && <span className="muted small-text">Dernière recherche : {timeAgo(status.lastScanAt)}</span>}
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------- System */

function SystemSection({ status, ctx }: { status: SystemStatus | null; ctx: Ctx }) {
  if (!status)
    return (
      <section className="settings-section">
        <h2 className="section-title">3 · Connexions</h2>
        <p className="muted">
          <LoaderCircle size={14} className="spin" aria-hidden /> Vérification…
        </p>
      </section>
    );
  const worker = !status.worker
    ? { tone: "bad" as const, label: "Non configuré", hint: "WORKER_BASE_URL et WORKER_SHARED_SECRET dans Vercel" }
    : !status.workerOnline
      ? { tone: "bad" as const, label: "Hors ligne", hint: "Le service Railway ne répond pas" }
      : status.workerBrowserReady === false
        ? { tone: "warn" as const, label: "Navigateur absent", hint: "Redéploie le worker Railway (Dockerfile.worker)" }
        : { tone: "good" as const, label: "Prêt", hint: "" };
  const rows: { name: string; text: string; tone: "good" | "bad" | "warn"; label: string; hint?: string }[] = [
    {
      name: "IA Gemini",
      text: "Scores, CV et lettres",
      tone: status.gemini ? "good" : "bad",
      label: status.gemini ? "Prête" : "Clé manquante",
      hint: status.gemini ? "" : "GEMINI_API_KEY dans Vercel",
    },
    {
      name: "Google Drive",
      text: "Sauvegarde des documents approuvés",
      tone: status.drive ? "good" : "warn",
      label: status.drive ? "Connecté" : "Non configuré",
      hint: status.drive ? "" : "Facultatif",
    },
    { name: "Worker Playwright", text: "Lecture des formulaires de candidature", ...worker },
  ];
  return (
    <section className="settings-section">
      <h2 className="section-title">3 · Connexions</h2>
      <div className="card list">
        {rows.map((row) => (
          <div key={row.name} className="row static">
            <span className="row-main">
              <strong>{row.name}</strong>
              <span className="muted">
                {row.text}
                {row.hint ? ` · ${row.hint}` : ""}
              </span>
            </span>
            <Chip tone={row.tone}>{row.label}</Chip>
          </div>
        ))}
        <div className="row static">
          <span className="row-main">
            <strong>
              <ShieldCheck size={15} aria-hidden /> Mode sécurisé
            </strong>
            <span className="muted">
              {status.applicationMode} — l’assistant prépare tout mais n’envoie jamais une candidature. CAPTCHA, mot de passe
              ou question légale = pause.
            </span>
          </span>
          <Chip tone={status.safeMode ? "good" : "bad"}>{status.safeMode ? "Actif" : "Refusé"}</Chip>
        </div>
      </div>
      <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => void ctx.refreshStatus()}>
        Revérifier
      </button>
    </section>
  );
}
