"use client";
import { useEffect, useRef, useState } from "react";
import type { DocumentRecord } from "@/lib/types";
import {
  ACCENTS,
  ACCENT_LABELS,
  ACCENT_RGB,
  DENSITIES,
  DENSITY_LABELS,
  TEMPLATES,
  TEMPLATE_LABELS,
  normalizeDesign,
  type Design,
} from "@/lib/design";

type Block = { heading: string; bullets: string[] };
type CvContent = {
  title: string;
  summary: string;
  experience: Block[];
  projects: Block[];
  skills: string[];
  education: string[];
  languages: string;
};

export type DocumentDialogState = {
  doc: DocumentRecord;
  mode: "revise" | "edit";
} | null;

const SUGGESTIONS = [
  "Raccourcis pour tenir sur une page",
  "Mets davantage en avant mes projets IA / Python",
  "Ton plus direct et moins scolaire",
  "Reformule le résumé en 2 phrases",
];

function blocksToText(items: Block[] = []) {
  return items
    .map((i) => [i.heading, ...(i.bullets || []).map((b) => `- ${b}`)].join("\n"))
    .join("\n\n");
}
function textToBlocks(text: string): Block[] {
  return text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines) => ({
      heading: lines[0].replace(/^[-•]\s*/, ""),
      bullets: lines.slice(1).map((l) => l.replace(/^[-•]\s*/, "")),
    }));
}
function lines(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}
function readJson<T>(text: string | null | undefined, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(text || "{}") };
  } catch {
    return fallback;
  }
}

export function DocumentDialog({
  state,
  onClose,
  onDone,
}: {
  state: DocumentDialogState;
  onClose: () => void;
  onDone: (message: string) => Promise<void> | void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [letter, setLetter] = useState("");
  const [design, setDesign] = useState<Design>(normalizeDesign(null));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [cv, setCv] = useState({
    title: "",
    summary: "",
    experience: "",
    projects: "",
    skills: "",
    education: "",
    languages: "",
  });

  const doc = state?.doc ?? null;
  const mode = state?.mode ?? null;
  const isLetter = doc?.kind === "COVER_LETTER";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (state && !dialog.open) dialog.showModal();
    if (!state && dialog.open) dialog.close();
  }, [state]);

  useEffect(() => {
    if (!doc) return;
    const t = window.setTimeout(() => {
      setError("");
      setInstruction("");
      setPreviewUrl(null);
      setDesign(
        normalizeDesign(readJson<{ design?: unknown }>(doc.content_text, {}).design),
      );
      if (doc.kind === "COVER_LETTER") {
        setLetter(readJson<{ letter: string }>(doc.content_text, { letter: "" }).letter);
      } else {
        const c = readJson<CvContent>(doc.content_text, {
          title: "",
          summary: "",
          experience: [],
          projects: [],
          skills: [],
          education: [],
          languages: "",
        });
        setCv({
          title: c.title,
          summary: c.summary,
          experience: blocksToText(c.experience),
          projects: blocksToText(c.projects),
          skills: (c.skills || []).join(", "),
          education: (c.education || []).join("\n"),
          languages: c.languages,
        });
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [doc]);

  function buildContent() {
    return isLetter
      ? { letter: letter.trim(), design }
      : {
          title: cv.title.trim() || "CV ciblé",
          summary: cv.summary.trim(),
          experience: textToBlocks(cv.experience),
          projects: textToBlocks(cv.projects),
          skills: cv.skills.split(",").map((s) => s.trim()).filter(Boolean),
          education: lines(cv.education),
          languages: cv.languages.trim(),
          design,
        };
  }

  // Object URLs are released when replaced / when the dialog closes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function preview() {
    if (!doc) return;
    setPreviewing(true);
    setError("");
    try {
      const r = await fetch(`/api/documents/${doc.id}/pdf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: buildContent() }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || "Aperçu impossible");
      }
      setPreviewUrl(URL.createObjectURL(await r.blob()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPreviewing(false);
    }
  }

  async function submit() {
    if (!doc) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "revise") {
        const r = await fetch(`/api/documents/${doc.id}/revise`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Révision impossible");
        await onDone(
          `Nouvelle version créée (v${body.document?.version}). ${body.summary}${body.questions ? ` ${body.questions} question(s) à valider.` : ""}`,
        );
      } else {
        const content = buildContent();
        const r = await fetch(`/api/documents/${doc.id}/edit`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Enregistrement impossible");
        await onDone(
          body.newVersion
            ? `Nouvelle version brouillon créée (v${body.document?.version}) : le document approuvé n’est pas modifié.`
            : "Modifications enregistrées. Ouvre l’aperçu PDF pour vérifier.",
        );
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} className="docdialog">
      {doc && (
        <div className="form">
          <div className="wide">
            <h2>
              {mode === "revise" ? "Demander une modification" : "Modifier moi-même"}
            </h2>
            <p className="muted">
              {doc.filename} · v{doc.version}
              {mode === "revise"
                ? " — l’IA crée une nouvelle version et garde l’ancienne. Elle n’ajoute aucun fait absent de ton profil vérifié."
                : doc.approved || doc.storage_path
                  ? " — ce document est approuvé : ta modification créera une nouvelle version brouillon."
                  : " — brouillon modifié directement."}
            </p>
          </div>

          {mode === "revise" ? (
            <>
              <div className="wide chips">
                {SUGGESTIONS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className="btn secondary small"
                    onClick={() => setInstruction(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <label className="wide">
                Ce que tu veux changer
                <textarea
                  rows={5}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ex. : mets Python et les projets IA en premier, enlève le projet X, raccourcis la lettre… Pour le design : « version sobre », « en bleu marine », « plus aéré »."
                />
              </label>
            </>
          ) : isLetter ? (
            <>
            <DesignPicker design={design} onChange={setDesign} />
            <label className="wide">
              Lettre <span className="muted">(une ligne vide entre deux paragraphes)</span>
              <textarea rows={16} value={letter} onChange={(e) => setLetter(e.target.value)} />
            </label>
            </>
          ) : (
            <>
              <DesignPicker design={design} onChange={setDesign} />
              <label className="wide">
                Titre du CV
                <input value={cv.title} onChange={(e) => setCv({ ...cv, title: e.target.value })} />
              </label>
              <label className="wide">
                Profil / résumé
                <textarea rows={3} value={cv.summary} onChange={(e) => setCv({ ...cv, summary: e.target.value })} />
              </label>
              <label className="wide">
                Expériences <span className="muted">(titre sur la 1re ligne, puis « - » par puce ; ligne vide entre deux blocs)</span>
                <textarea rows={8} value={cv.experience} onChange={(e) => setCv({ ...cv, experience: e.target.value })} />
              </label>
              <label className="wide">
                Projets
                <textarea rows={8} value={cv.projects} onChange={(e) => setCv({ ...cv, projects: e.target.value })} />
              </label>
              <label className="wide">
                Compétences <span className="muted">(séparées par des virgules)</span>
                <textarea rows={2} value={cv.skills} onChange={(e) => setCv({ ...cv, skills: e.target.value })} />
              </label>
              <label className="wide">
                Formation <span className="muted">(une ligne par diplôme)</span>
                <textarea rows={3} value={cv.education} onChange={(e) => setCv({ ...cv, education: e.target.value })} />
              </label>
              <label className="wide">
                Langues
                <input value={cv.languages} onChange={(e) => setCv({ ...cv, languages: e.target.value })} />
              </label>
            </>
          )}

          {mode === "edit" && previewUrl && (
            <iframe
              className="wide pdfpreview"
              title="Aperçu du PDF"
              src={previewUrl}
            />
          )}
          {error && <p className="wide error">{error}</p>}
          <div className="wide toolbar">
            {mode === "edit" && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => void preview()}
                disabled={busy || previewing}
              >
                {previewing ? "Aperçu…" : "Prévisualiser"}
              </button>
            )}
            <button type="button" className="btn secondary" onClick={onClose} disabled={busy}>
              Annuler
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void submit()}
              disabled={busy || (mode === "revise" && instruction.trim().length < 3)}
            >
              {busy
                ? mode === "revise"
                  ? "Révision en cours…"
                  : "Enregistrement…"
                : mode === "revise"
                  ? "Générer la nouvelle version"
                  : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

function DesignPicker({
  design,
  onChange,
}: {
  design: Design;
  onChange: (next: Design) => void;
}) {
  return (
    <fieldset className="wide designpick">
      <legend>Design du PDF</legend>
      <label>
        Modèle
        <select
          value={design.template}
          onChange={(e) => onChange({ ...design, template: e.target.value as Design["template"] })}
        >
          {TEMPLATES.map((t) => (
            <option key={t} value={t}>
              {TEMPLATE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Densité
        <select
          value={design.density}
          onChange={(e) => onChange({ ...design, density: e.target.value as Design["density"] })}
        >
          {DENSITIES.map((d) => (
            <option key={d} value={d}>
              {DENSITY_LABELS[d]}
            </option>
          ))}
        </select>
      </label>
      <div className="swatches" role="radiogroup" aria-label="Couleur">
        <span className="muted">Couleur</span>
        {ACCENTS.map((a) => {
          const [r, g, b] = ACCENT_RGB[a];
          return (
            <button
              type="button"
              key={a}
              role="radio"
              aria-checked={design.accent === a}
              aria-label={ACCENT_LABELS[a]}
              title={ACCENT_LABELS[a]}
              className={design.accent === a ? "swatch on" : "swatch"}
              style={{ background: `rgb(${r},${g},${b})` }}
              onClick={() => onChange({ ...design, accent: a })}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
