"use client";
import { useState } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Callout, Chip } from "@/components/ui";
import { category } from "@/lib/scan/categories";
import type { ImportedProfile } from "@/lib/profile-import";
import { categoriesFailedMessage, CV_MAX_BYTES, CV_SAVED_NOTE, profileSavedMessage, readFailedMessage } from "@/components/profile-card";
import { timeAgo } from "@/lib/labels";
import type { Ctx } from "@/components/views/types";

type ImportAnswer = { draft: ImportedProfile; problems: string[]; suggestions: string[]; filename: string };

const period = (start: string | null, end: string | null) => [start, end ?? (start ? "aujourd’hui" : null)].filter(Boolean).join(" → ");

/**
 * The CV import, shared by Réglages and the sign-up journey: choose a PDF, check what was read, save.
 * `onSaved` is called once the profile is saved (not for a failure). `showNextStep` adds the "Voir mes offres"
 * button of Réglages. A reading failure stays on the screen with a way to retry.
 */
export function ProfileImportFlow({
  ctx,
  onCategories,
  onSaved,
  showNextStep = false,
}: {
  ctx: Ctx;
  onCategories: () => void;
  onSaved?: () => void;
  showNextStep?: boolean;
}) {
  const { notify, reload } = ctx;
  const [readError, setReadError] = useState("");
  // The saved CV is read once for the whole dashboard (components/use-profile.ts), not again here.
  const summary = ctx.profileSummary;
  const [answer, setAnswer] = useState<ImportAnswer | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "read" | "save">("");
  /** The profile was just saved: the next step is the offers. */
  const [justSaved, setJustSaved] = useState(false);

  async function read(file: File) {
    setReadError("");
    if (file.size > CV_MAX_BYTES) return setReadError(readFailedMessage(file));
    setBusy("read");
    setJustSaved(false);
    notify("Lecture de ton CV… (jusqu’à 30 secondes)");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/profile/import", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setAnswer(body as ImportAnswer);
      setPicked((body as ImportAnswer).suggestions);
    } catch (e) {
      setReadError(readFailedMessage(file, e instanceof Error ? e.message : undefined));
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!answer) return;
    setBusy("save");
    // 1. The profile itself. Only a failure here keeps the draft open: nothing was saved.
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft: answer.draft, filename: answer.filename }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Enregistrement impossible", "bad");
      setBusy("");
      return;
    }
    // The profile is saved: close the draft now, whatever happens to the suggested jobs below.
    const wanted = picked;
    setAnswer(null);
    setJustSaved(true);
    try {
      await ctx.refreshProfile();
      // 2. The suggested job categories, ticked in the search too. A failure here is not a failure to save the CV.
      if (!wanted.length) {
        notify(profileSavedMessage({ picked: 0 }), "good");
      } else {
        const current = await fetch("/api/settings").then((r) => r.json());
        const categories = [...new Set([...(current.prefs?.categories ?? []), ...wanted])];
        const put = await fetch("/api/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prefs: { ...current.prefs, categories } }),
        });
        const saved = await put.json().catch(() => ({}));
        if (!put.ok) throw new Error(saved.error || "Métiers non enregistrés");
        onCategories();
        await reload();
        notify(profileSavedMessage({ picked: wanted.length }), "good");
      }
    } catch {
      notify(categoriesFailedMessage(), "info");
    } finally {
      setBusy("");
      // Called last, once the suggested jobs are ticked too, so the next screen reads them.
      onSaved?.();
    }
  }

  const d = answer?.draft;
  return (
    <div className="card form">
      <p className="muted wide">
        Dépose ton CV une seule fois : l’IA en tire ton profil (expériences, formations, projets, compétences) et chaque CV ou
        lettre adapté part de là. Rien n’est inventé, et tu vérifies avant d’enregistrer. Le PDF n’est pas conservé.
      </p>
      {summary === undefined ? (
        ctx.demo ? (
          <p className="muted">Mode démonstration : le profil n’est pas lu.</p>
        ) : ctx.profileFailed ? (
          <Callout tone="warn" title="Ton profil n’a pas pu être lu">
            Recharge la page. Rien n’a été modifié.
          </Callout>
        ) : (
          <p className="muted">Chargement…</p>
        )
      ) : summary ? (
        <>
          <p className="wide">
            <strong>{summary.full_name}</strong> · {summary.experience} expérience(s), {summary.education} formation(s),{" "}
            {summary.projects} projet(s), {summary.skills} compétence(s)
            {summary.updated_at ? <span className="muted"> · mis à jour {timeAgo(summary.updated_at)}</span> : null}
          </p>
          <p className="wide muted small-text">
            {summary.source ? `CV importé : « ${summary.source} ». ` : ""}
            {CV_SAVED_NOTE}
          </p>
        </>
      ) : (
        <Callout tone="info" title="Aucun profil encore">
          Sans profil, l’appli ne peut ni noter les offres ni écrire tes CV.
        </Callout>
      )}
      {readError && (
        <Callout tone="bad" title="Ton CV n’a pas été lu">
          {readError}
        </Callout>
      )}
      {justSaved && showNextStep && (
        <div className="wide toolbar">
          <strong>Profil enregistré.</strong>
          <button className="btn" onClick={() => ctx.go("jobs", "new")}>
            Voir mes offres
          </button>
        </div>
      )}
      <label className="wide upload">
        {readError ? "Réessayer avec un autre fichier (PDF, 5 Mo max)" : summary ? "Remplacer par un nouveau CV (PDF, 5 Mo max)" : "Importer mon CV (PDF, 5 Mo max)"}
        <input
          type="file"
          accept="application/pdf"
          disabled={Boolean(busy)}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void read(f);
          }}
        />
      </label>
      {busy === "read" && (
        <p className="muted">
          <LoaderCircle size={14} className="spin" aria-hidden /> Lecture du CV…
        </p>
      )}
      {d && answer && (
        <div className="wide import-review">
          <h3>Vérifie ce qui a été lu dans « {answer.filename} »</h3>
          {answer.problems.map((p) => (
            <Callout key={p} tone="bad" title="À vérifier">
              {p}
            </Callout>
          ))}
          <p>
            <strong>{d.identity.full_name ?? "Nom manquant"}</strong>
            {[d.identity.location, d.identity.email, d.identity.phone].filter(Boolean).map((x) => ` · ${x}`)}
          </p>
          {d.profile.experience.length > 0 && (
            <>
              <h4>Expériences</h4>
              <ul>
                {d.profile.experience.map((e, i) => (
                  <li key={i}>
                    {e.title} — {e.organization} <span className="muted">{period(e.start, e.end)}</span>
                    {e.facts.length > 0 && <span className="muted"> · {e.facts.length} réalisation(s)</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.profile.education.length > 0 && (
            <>
              <h4>Formation</h4>
              <ul>
                {d.profile.education.map((e, i) => (
                  <li key={i}>
                    {e.degree} — {e.institution} <span className="muted">{period(e.start, e.end)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.profile.projects.length > 0 && (
            <>
              <h4>Projets</h4>
              <ul>
                {d.profile.projects.map((p, i) => (
                  <li key={i}>
                    {p.name}
                    {p.technologies.length ? <span className="muted"> · {p.technologies.join(", ")}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          )}
          {Object.keys(d.profile.skills).length > 0 && (
            <>
              <h4>Compétences</h4>
              <div className="chips">
                {Object.values(d.profile.skills)
                  .flat()
                  .slice(0, 40)
                  .map((x) => (
                    <Chip key={x}>{x}</Chip>
                  ))}
              </div>
            </>
          )}
          {answer.suggestions.length > 0 && (
            <>
              <h4>Métiers qui correspondent à ton CV</h4>
              <div className="chips">
                {answer.suggestions.map((id) => {
                  const on = picked.includes(id);
                  return (
                    <label key={id} className={on ? "pill active" : "pill"}>
                      <input
                        type="checkbox"
                        className="sr"
                        checked={on}
                        onChange={() => setPicked(on ? picked.filter((x) => x !== id) : [...picked, id])}
                      />
                      {category(id)?.label ?? id}
                    </label>
                  );
                })}
              </div>
              <small className="muted">Cochés = ajoutés à ta recherche (Réglages &gt; Ce que tu cherches).</small>
            </>
          )}
          <div className="jobactions">
            <button className="btn" disabled={Boolean(busy) || !d.identity.full_name} onClick={() => void save()}>
              {busy === "save" ? <LoaderCircle size={16} className="spin" aria-hidden /> : <CircleCheck size={16} aria-hidden />}{" "}
              Enregistrer ce profil
            </button>
            <button className="btn ghost" disabled={Boolean(busy)} onClick={() => setAnswer(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
