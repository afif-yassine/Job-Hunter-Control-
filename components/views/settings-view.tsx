"use client";
import { useState } from "react";
import { CircleCheck, Download, ExternalLink, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { Callout, Chip, PageHead } from "@/components/ui";
import { PROVIDERS, type ProviderDef } from "@/lib/providers";
import type { ProviderStatus } from "@/lib/integrations";
import { MAX_TARGETS } from "@/lib/scan/config";
import { ProfileImportFlow } from "@/components/profile-import-flow";
import { SearchBasics, useSearchPrefs } from "@/components/search-fields";
import type { DiscoveredTarget } from "@/lib/scan/discover";
import { ATS_LABEL, boardUrl, parseAtsTarget } from "@/lib/scan/sources/ats";
import { timeAgo } from "@/lib/labels";
import type { SystemStatus } from "@/components/use-status";
import type { Ctx } from "./types";
import { DELETE_CONFIRMATION } from "@/lib/account";

export function SettingsView({ ctx }: { ctx: Ctx }) {
  const { status, statusFailed } = ctx;
  // Bumped when the CV import ticks job categories: the search form reloads.
  const [searchVersion, setSearchVersion] = useState(0);
  return (
    <>
      <PageHead title="Réglages" subtitle="Ton CV, les métiers que tu cherches et ton compte." />
      {statusFailed && !status && (
        <Callout tone="bad" title="Impossible de lire l’état des connexions">
          Recharge la page. Si ça continue, vérifie que tu es bien connecté.
        </Callout>
      )}
      <ProfileSection ctx={ctx} onCategories={() => setSearchVersion((v) => v + 1)} />
      <SearchSection key={searchVersion} ctx={ctx} />
      {/* Offer sources and technical connections: the administrator's business, not the student's. */}
      {status?.isAdmin && <SourcesSection ctx={ctx} />}
      {status?.isAdmin && <SystemSection status={status} ctx={ctx} />}
      {ctx.supabase && <AccountSection ctx={ctx} />}
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
      <h2 className="section-title">Admin · Où chercher les offres</h2>
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

/** "jsearch:linkedin" → "LinkedIn (JSearch)", "francetravail" → "France Travail"… */
function sourceLabel(via: string): string {
  const [kind, detail] = via.split(":");
  const known: Record<string, string> = {
    linkedin: "LinkedIn",
    indeed: "Indeed",
    welcometothejungle: "Welcome to the Jungle",
    hellowork: "HelloWork",
    glassdoor: "Glassdoor",
    apec: "APEC",
    adzuna: "Adzuna",
    jooble: "Jooble",
  };
  const nice = (w: string) => known[w] ?? (w ? w[0].toUpperCase() + w.slice(1) : w);
  if (kind === "jsearch") return detail ? `${nice(detail)} (JSearch)` : "JSearch";
  if (kind === "francetravail") return "France Travail";
  if (kind === "gmail") return "une alerte e-mail";
  return nice(kind || "une offre");
}

/** "https://jobs.lever.co/acme/1234-…/apply" → "jobs.lever.co/acme/…" */
function shortLink(link: string): string {
  try {
    const u = new URL(link);
    const parts = u.pathname.split("/").filter(Boolean);
    return `${u.hostname.replace(/^www\./, "")}/${parts[0] ?? ""}${parts.length > 1 || u.search ? "/…" : ""}`;
  } catch {
    return link.slice(0, 40);
  }
}
function SearchSection({ ctx }: { ctx: Ctx }) {
  const { notify, status } = ctx;
  // A student with a daily selection: the platform collects the offers, his own search calls no job site any more.
  const selection = ctx.unlock.kind === "locking";
  // The fields are shared with the sign-up journey (components/search-fields.tsx); the advanced ones stay here.
  const s = useSearchPrefs(ctx);
  const { prefs, setPrefs, departments, setDepartments, targets, setTargets, discovered, setDiscovered, auto, setAuto, loaded, saving } = s;

  const lines = targets.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const unknown = lines.filter((line) => !parseAtsTarget(line));

  async function unfollow(item: DiscoveredTarget) {
    const response = await fetch("/api/settings/discovered", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: item.key }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return notify(body.error || "Impossible de retirer cette entreprise.", "bad");
    setDiscovered(body.discovered ?? []);
    notify(`${item.company} ne sera plus suivie.`, "good");
  }

  return (
    <section className="settings-section">
      <h2 className="section-title">2 · Ce que tu cherches</h2>
      <form
        className="card form searchform"
        onSubmit={(e) => {
          e.preventDefault();
          void s.save();
        }}
      >
        <SearchBasics s={s} />
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
            placeholder={"https://job-boards.greenhouse.io/doctolib\nhttps://jobs.lever.co/blablacar\nhttps://jobs.ashbyhq.com/qonto"}
          />
          <small className="muted">
            Colle le lien de la page carrière d’une entreprise (une par ligne, {MAX_TARGETS} maximum). Pris en charge :
            Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee.{" "}
            {selection
              ? "Ces entreprises sont ajoutées à la collecte de la plateforme ; leurs offres t’arrivent par ta sélection du jour si elles correspondent à ton CV."
              : "Leurs offres sont lues à la source, sans clé, souvent avant LinkedIn ou Indeed."}
          </small>
          {unknown.length > 0 && (
            <small className="warn-text">
              Non reconnu{unknown.length > 1 ? "s" : ""} (ignoré{unknown.length > 1 ? "s" : ""} à l’enregistrement) :{" "}
              {unknown.slice(0, 3).join(", ")}
            </small>
          )}
        </label>
        {!selection && (
        <div className="wide discovered">
          <div className="discovered-head">
            <strong>Entreprises trouvées automatiquement ({discovered.length})</strong>
            <small className="muted">
              Quand une offre trouvée par JSearch, France Travail, Adzuna… a un lien de candidature hébergé par une plateforme
              de recrutement, l’appli reconnaît l’entreprise à l’adresse du lien — par exemple{" "}
              <code>jobs.lever.co/<b>entreprise</b></code> = Lever, <code>boards.greenhouse.io/<b>entreprise</b></code> =
              Greenhouse, <code>jobs.ashbyhq.com/<b>entreprise</b></code> = Ashby — puis lit toutes ses offres directement à
              chaque recherche.
            </small>
          </div>
          {discovered.length === 0 ? (
            <small className="muted">
              Aucune pour l’instant : la liste se remplit toute seule au fil des recherches.
            </small>
          ) : (
            <ul className="discovered-list">
              {discovered.map((item) => {
                const target = parseAtsTarget(item.key);
                if (!target) return null;
                return (
                  <li key={item.key}>
                    <div>
                      <a href={boardUrl(target)} target="_blank" rel="noreferrer">
                        {item.company} <ExternalLink size={12} aria-hidden />
                      </a>
                      <Chip tone="neutral">{ATS_LABEL[target.ats]}</Chip>
                      <small className="muted">
                        repérée via {sourceLabel(item.via)} · {timeAgo(item.firstSeen)}
                        {item.link && (
                          <>
                            {" · lien : "}
                            <span className="discovered-link">{shortLink(item.link)}</span>
                          </>
                        )}
                      </small>
                    </div>
                    <button type="button" className="btn secondary small" onClick={() => void unfollow(item)}>
                      Ne plus suivre
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )}
        <label className="check switch wide">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          {selection
            ? "Ta sélection se prépare chaque jour, même appli fermée"
            : status?.scheduledScan
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
        <h2 className="section-title">Admin · Connexions</h2>
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
      name: status.aiProvider === "gateway" ? "IA Gateway" : "IA Gemini",
      text: "Lecture des offres, CV et lettres",
      tone: (status.aiConfigured ?? status.gemini) ? "good" : "bad",
      label: (status.aiConfigured ?? status.gemini) ? "Configurée" : "Clé manquante",
      hint: (status.aiConfigured ?? status.gemini) ? "" : "Configure le fournisseur IA dans Vercel",
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
      <h2 className="section-title">Admin · Connexions</h2>
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

/* ------------------------------------------------------------------ Profile (CV) */

/** Your CV, read once: every CV and letter is written from it, nothing else. */
function ProfileSection({ ctx, onCategories }: { ctx: Ctx; onCategories: () => void }) {
  return (
    <section className="settings-section">
      <h2 className="section-title">1 · Ton CV</h2>
      <ProfileImportFlow ctx={ctx} onCategories={onCategories} showNextStep />
    </section>
  );
}


/* ------------------------------------------------------------------ Account (RGPD) */

const PROVIDER_LABEL: Record<string, string> = { google: "Google", email: "lien par e-mail" };

/** Your account: how you sign in, download everything, delete everything. */
function AccountSection({ ctx }: { ctx: Ctx }) {
  // Read once for the whole dashboard (components/use-account.ts), so the menu and this card show the same address.
  const info = ctx.account;
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState("");

  async function remove() {
    setWorking(true);
    setProblem("");
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: typed.trim() }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error || "La suppression a échoué.");
      // A full reload on purpose: drops every bit of state of the deleted account.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "La suppression a échoué.");
      setWorking(false);
    }
  }

  const since = info?.createdAt ? new Date(info.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;
  const via = info?.providers.map((p) => PROVIDER_LABEL[p] ?? p).join(" et ");

  return (
    <section className="settings-section">
      <h2 className="section-title">3 · Ton compte</h2>
      <div className="card list">
        <div className="row static">
          <span className="row-main">
            <strong>{ctx.userEmail || "Ton compte"}</strong>
            <span className="muted">
              {[via ? `Connexion par ${via}` : null, since ? `compte créé le ${since}` : null].filter(Boolean).join(" · ") || "…"}
            </span>
          </span>
        </div>
        <div className="row static">
          <span className="row-main">
            <strong>Télécharger mes données</strong>
            <span className="muted">Ton profil, tes offres, tes candidatures et tes documents, dans un fichier JSON.</span>
          </span>
          <a className="btn secondary small" href="/api/account/export" download>
            <Download size={15} aria-hidden /> Télécharger
          </a>
        </div>
        <div className="row static">
          <span className="row-main">
            <strong>Supprimer mon compte</strong>
            <span className="muted">Efface immédiatement et définitivement ton compte et tout ce qu’il contient.</span>
          </span>
          {!asking && (
            <button type="button" className="btn ghost small danger-text" onClick={() => setAsking(true)}>
              <Trash2 size={15} aria-hidden /> Supprimer
            </button>
          )}
        </div>
        {asking && (
          <div className="row static" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <Callout tone="bad" title="Action définitive">
              Ton CV, tes offres, tes candidatures et tes documents seront effacés. Pense à télécharger tes données avant. Pour
              confirmer, écris <strong>{DELETE_CONFIRMATION}</strong>.
            </Callout>
            <input
              className="account-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label={`Écris ${DELETE_CONFIRMATION} pour confirmer`}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            {problem && <p className="muted" role="alert">{problem}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn danger" disabled={typed.trim() !== DELETE_CONFIRMATION || working} onClick={() => void remove()}>
                {working ? <LoaderCircle size={15} className="spin" aria-hidden /> : <Trash2 size={15} aria-hidden />} Supprimer définitivement
              </button>
              <button type="button" className="btn ghost" disabled={working} onClick={() => { setAsking(false); setTyped(""); setProblem(""); }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 13.5 }}>
        <a href="/confidentialite" target="_blank" rel="noreferrer">Confidentialité</a> ·{" "}
        <a href="/conditions" target="_blank" rel="noreferrer">Conditions</a> ·{" "}
        <a href="/mentions-legales" target="_blank" rel="noreferrer">Mentions légales</a>
      </p>
    </section>
  );
}
