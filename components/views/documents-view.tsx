"use client";
import { CloudUpload, ExternalLink, FileText, Pencil, Sparkles } from "lucide-react";
import { Chip, Empty, PageHead } from "@/components/ui";
import { DOCUMENT_KIND } from "@/lib/labels";
import type { DocumentRecord } from "@/lib/types";
import type { Ctx } from "./types";

type Group = { key: string; company: string; title: string; docs: DocumentRecord[] };

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
        <PageHead title="Documents" subtitle="Tes CV et lettres, adaptés à chaque offre." />
        <Empty
          title="Aucun document pour l’instant"
          text="Ils sont créés automatiquement pour les offres notées 80 ou plus. Tu peux aussi les créer depuis une offre analysée."
          action={
            <button className="btn" onClick={() => ctx.go("jobs", "todo")}>
              Voir les offres à traiter
            </button>
          }
        />
      </>
    );

  return (
    <>
      <PageHead title="Documents" subtitle="Relis, modifie si besoin, puis approuve. L’envoi vers Drive se fait après approbation." />
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
        <FileText size={13} aria-hidden /> Astuce : « Demander à l’IA » applique une consigne (ex. « plus court », « change le
        design ») ; « Modifier » te laisse tout retoucher toi-même.
      </p>
    </>
  );
}

function DocRow({ doc, ctx, working }: { doc: DocumentRecord; ctx: Ctx; working: boolean }) {
  const { act, busy } = ctx;
  const disabled = Boolean(busy);
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
        <Chip tone={state.tone}>{state.label}</Chip>
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
        {!doc.approved && (
          <button className="btn small" disabled={disabled} onClick={() => void act.approve(doc)}>
            {working ? "…" : "Approuver"}
          </button>
        )}
        {doc.approved && !doc.storage_path && (
          <button className="btn small" disabled={disabled} onClick={() => void act.upload(doc)}>
            <CloudUpload size={14} aria-hidden /> {working ? "Envoi…" : "Envoyer sur Drive"}
          </button>
        )}
        {doc.storage_path && (
          <a className="btn secondary small" href={doc.storage_path} target="_blank" rel="noreferrer">
            Ouvrir sur Drive
          </a>
        )}
      </div>
    </div>
  );
}
