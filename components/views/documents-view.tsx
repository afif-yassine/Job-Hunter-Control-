"use client";
import { CloudUpload, Code2, ExternalLink, FileText, Pencil, Sparkles } from "lucide-react";
import { Chip, Empty, PageHead, Soon } from "@/components/ui";
import { DOCUMENT_KIND } from "@/lib/labels";
import type { DocumentRecord } from "@/lib/types";
import type { Ctx } from "./types";

type Group = { key: string; company: string; title: string; docs: DocumentRecord[] };

/**
 * Opens the LaTeX source in Overleaf (free online LaTeX editor) so it can be
 * edited and compiled there. Only on the user's click; nothing is sent otherwise.
 */
async function openInOverleaf(doc: DocumentRecord, notify: Ctx["notify"]) {
  // Opened now (during the click) so the browser does not block it as a pop-up.
  const tab = window.open("", "overleaf");
  try {
    const response = await fetch(`/api/documents/${doc.id}/latex?inline=1`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = await response.text();
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.overleaf.com/docs";
    form.target = "overleaf";
    const fields: Record<string, string> = {
      encoded_snip: encodeURIComponent(source),
      snip_name: doc.filename.replace(/\.pdf$/i, ".tex"),
      engine: "pdflatex",
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
  } catch (error) {
    tab?.close();
    notify(`Impossible de préparer le fichier LaTeX (${error instanceof Error ? error.message : "erreur"}).`, "bad");
  }
}

export function DocumentsView({ ctx }: { ctx: Ctx }) {
  const { data, busy } = ctx;
  const replacedBy = new Map<string, DocumentRecord>();
  for (const d of data.documents) if (d.based_on_document_id) replacedBy.set(d.based_on_document_id, d);

  const groups: Group[] = [];
  const index = new Map<string, Group>();
  for (const d of data.documents) {
    const key = d.job_id || d.id;
    let g = index.get(key);
    if (!g) {
      g = { key, company: d.jobs?.company || "Sans offre", title: d.jobs?.title || "", docs: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.docs.push(d);
  }

  if (!data.documents.length)
    return (
      <>
        <PageHead title="Documents" subtitle="Tes CV et lettres, créés pour les offres que tu as choisies." />
        <Empty
          title="Aucun document pour l’instant"
          text="Ouvre une offre qui te plaît et clique « Créer mon CV et ma lettre » : tes documents arrivent ici."
          action={
            <button className="btn" onClick={() => ctx.go("jobs", "new")}>
              Voir les offres
            </button>
          }
        />
      </>
    );

  return (
    <>
      <PageHead
        title="Documents"
        subtitle={
          ctx.status?.isAdmin
            ? "Relis, modifie si besoin, puis approuve. L’envoi vers Drive se fait après approbation."
            : "Relis tes CV et lettres, modifie-les si besoin, puis postule sur le site de l’offre."
        }
      />
      <Soon id="versions" />
      <div className="cards">
        {groups.map((group) => {
          const current = group.docs.filter((d) => !replacedBy.has(d.id));
          const old = group.docs.filter((d) => replacedBy.has(d.id));
          return (
            <section key={group.key} className="card docgroup">
              <header>
                <h3>{group.company}</h3>
                {group.title && <p className="muted">{group.title}</p>}
              </header>
              {current.map((d) => (
                <DocRow key={d.id} doc={d} ctx={ctx} working={busy === d.id} />
              ))}
              {old.length > 0 && (
                <details className="why">
                  <summary>
                    {old.length} ancienne{old.length > 1 ? "s" : ""} version{old.length > 1 ? "s" : ""}
                  </summary>
                  {old.map((d) => (
                    <div key={d.id} className="docrow old">
                      <span className="muted">
                        {DOCUMENT_KIND[d.kind] || d.kind} · v{d.version}
                      </span>
                      <a className="btn ghost small" href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noreferrer">
                        Aperçu
                      </a>
                    </div>
                  ))}
                </details>
              )}
            </section>
          );
        })}
      </div>
      <p className="muted small-text" style={{ marginTop: 12 }}>
        <FileText size={13} aria-hidden /> Astuce : « Demander à l’IA » applique une consigne (ex. « plus court », « reformule
        le résumé ») ; « Modifier » te laisse tout retoucher toi-même
        {ctx.status?.isAdmin ? " ; « LaTeX » donne le code source à éditer (Overleaf ou ton éditeur)." : "."}
      </p>
    </>
  );
}

function DocRow({ doc, ctx, working }: { doc: DocumentRecord; ctx: Ctx; working: boolean }) {
  const { act, busy } = ctx;
  const disabled = Boolean(busy);
  // Approval and the Drive folder belong to the platform administrator; a student keeps and reads documents here.
  const admin = ctx.status?.isAdmin === true;
  const state = doc.storage_path
    ? { tone: "good" as const, label: "Sur Drive" }
    : doc.approved
      ? { tone: "info" as const, label: "Approuvé" }
      : { tone: "warn" as const, label: "À valider" };
  return (
    <div className="docrow">
      <div className="docinfo">
        <strong>{DOCUMENT_KIND[doc.kind] || doc.kind}</strong>
        <Chip>v{doc.version}</Chip>
        {admin && <Chip tone={state.tone}>{state.label}</Chip>}
      </div>
      <div className="docactions">
        <a className="btn secondary small" href={`/api/documents/${doc.id}/pdf`} target="_blank" rel="noreferrer">
          <ExternalLink size={14} aria-hidden /> Aperçu PDF
        </a>
        <button className="btn secondary small" disabled={disabled} onClick={() => act.openDocument({ doc, mode: "revise" })}>
          <Sparkles size={14} aria-hidden /> Demander à l’IA
        </button>
        <button className="btn secondary small" disabled={disabled} onClick={() => act.openDocument({ doc, mode: "edit" })}>
          <Pencil size={14} aria-hidden /> Modifier
        </button>
        <details className="more">
          <summary className="btn ghost small">
            <Code2 size={14} aria-hidden /> {admin ? "LaTeX" : "Options avancées"}
          </summary>
          <div className="menu">
            {!admin && <small className="muted">Pour retoucher ton CV avec LaTeX (utilisateurs avancés).</small>}
            <button className="btn secondary small" onClick={() => void openInOverleaf(doc, ctx.notify)}>
              Éditer dans Overleaf
            </button>
            <a className="btn secondary small" href={`/api/documents/${doc.id}/latex`}>
              Télécharger le .tex
            </a>
          </div>
        </details>
        {admin && !doc.approved && (
          <button className="btn small" disabled={disabled} onClick={() => void act.approve(doc)}>
            {working ? "…" : "Approuver"}
          </button>
        )}
        {admin && doc.approved && !doc.storage_path && (
          <button className="btn small" disabled={disabled} onClick={() => void act.upload(doc)}>
            <CloudUpload size={14} aria-hidden /> {working ? "Envoi…" : "Envoyer sur Drive"}
          </button>
        )}
        {admin && doc.storage_path && (
          <a className="btn secondary small" href={doc.storage_path} target="_blank" rel="noreferrer">
            Ouvrir sur Drive
          </a>
        )}
      </div>
    </div>
  );
}
