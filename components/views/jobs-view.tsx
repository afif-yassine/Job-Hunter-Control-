"use client";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Empty, PageHead } from "@/components/ui";
import { CATEGORIES, categorize, contractKind, type ContractKind } from "@/lib/scan/categories";
import { isSent, kitsByJob, stageOf } from "@/lib/journey";
import type { Job } from "@/lib/types";
import { OfferCard } from "./offer-card";
import type { Ctx, JobFilter } from "./types";

const FILTERS: { id: JobFilter; label: string }[] = [
  { id: "new", label: "Nouvelles" },
  { id: "all", label: "Toutes" },
  { id: "best", label: "Proches de mon CV" },
  { id: "review", label: "À vérifier" },
  { id: "gone", label: "Plus disponibles" },
];

const isDismissed = (j: Job) => stageOf(j) === "dismissed";
/** Withdrawn, not seen for 3 weeks, or reported: nothing more is spent on it. */
const isGone = (j: Job) => Boolean(j.gone_reason) && !isDismissed(j) && !isSent(stageOf(j));
const toReview = (j: Job) => Boolean(j.review_flag) && !isDismissed(j) && !isGone(j);
const isOpen = (j: Job) => !isDismissed(j) && !isGone(j) && !toReview(j);

const CONTRACT_LABEL: Record<ContractKind, string> = { alternance: "Alternance", stage: "Stage", cdd: "CDD", cdi: "CDI", autre: "Autre" };

export function JobsView({ ctx }: { ctx: Ctx }) {
  const { data, jobFilter, setJobFilter, act, openOffer } = ctx;
  const [query, setQuery] = useState("");
  const [metier, setMetier] = useState("");
  const [contract, setContract] = useState("");
  const [sort, setSort] = useState<"recent" | "score" | "profile">("recent");
  const kits = useMemo(() => kitsByJob(data.documents), [data.documents]);

  // The closest offers to the profile (top 25 by embeddings, or a high AI score).
  const closest = useMemo(
    () =>
      new Set(
        [...data.jobs]
          .filter((j) => typeof j.similarity === "number")
          .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
          .slice(0, 25)
          .map((j) => j.id),
      ),
    [data.jobs],
  );
  const hasSimilarity = closest.size > 0;

  const match = useMemo<Record<JobFilter, (j: Job) => boolean>>(
    () => ({
      new: (j) => isOpen(j) && stageOf(j) === "new",
      all: (j) => !isDismissed(j),
      best: (j) => isOpen(j) && (closest.has(j.id) || (j.match_score ?? 0) >= 80),
      review: toReview,
      gone: isGone,
    }),
    [closest],
  );

  const facets = useMemo(
    () => new Map(data.jobs.map((j) => [j.id, { cats: categorize({ title: j.title, romeCode: j.rome_code }), kind: contractKind(j) }])),
    [data.jobs],
  );
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, data.jobs.filter(match[f.id]).length])) as Record<JobFilter, number>,
    [data.jobs, match],
  );
  const inTab = useMemo(() => data.jobs.filter(match[jobFilter]), [data.jobs, jobFilter, match]);
  const metierCounts = useMemo(() => {
    const n = new Map<string, number>();
    for (const j of inTab) for (const c of facets.get(j.id)?.cats ?? []) n.set(c, (n.get(c) ?? 0) + 1);
    return n;
  }, [inTab, facets]);
  const contractCounts = useMemo(() => {
    const n = new Map<string, number>();
    for (const j of inTab) {
      const k = facets.get(j.id)?.kind ?? "autre";
      n.set(k, (n.get(k) ?? 0) + 1);
    }
    return n;
  }, [inTab, facets]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inTab
      .filter((j) => (q ? `${j.title} ${j.company} ${j.location || ""}`.toLowerCase().includes(q) : true))
      .filter((j) => !metier || (facets.get(j.id)?.cats ?? []).includes(metier as never))
      .filter((j) => !contract || facets.get(j.id)?.kind === contract);
    if (sort === "profile" || (jobFilter === "best" && sort === "recent")) return [...list].sort((a, b) => (b.similarity ?? -1) - (a.similarity ?? -1));
    if (sort === "score") return [...list].sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
    return list;
  }, [inTab, jobFilter, query, metier, contract, facets, sort]);

  // Long lists render in pages so the phone stays fast.
  const [shown, setShown] = useState(30);
  const visible = rows.slice(0, shown);

  return (
    <>
      <PageHead
        title="Offres"
        subtitle="Clique une offre pour lire l’essentiel et préparer ta candidature. Celles que tu ouvres arrivent dans « Mon suivi »."
        actions={
          <button className="btn secondary" onClick={act.addJob}>
            <Plus size={16} aria-hidden /> Ajouter une offre
          </button>
        }
      />

      <div className="filters" role="tablist" aria-label="Filtrer les offres">
        {FILTERS.filter((f) => f.id === "new" || f.id === "all" || counts[f.id] > 0).map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={jobFilter === f.id}
            className={jobFilter === f.id ? "pill active" : "pill"}
            onClick={() => (setJobFilter(f.id), setShown(30))}
          >
            {f.label} <span className="count">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="facets">
        <label className="search">
          <Search size={16} aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Poste, entreprise, ville…" aria-label="Chercher dans les offres" />
        </label>
        <label>
          Métier
          <select value={metier} onChange={(e) => setMetier(e.target.value)}>
            <option value="">Tous ({inTab.length})</option>
            {CATEGORIES.filter((c) => metierCounts.get(c.id)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({metierCounts.get(c.id)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Contrat
          <select value={contract} onChange={(e) => setContract(e.target.value)}>
            <option value="">Tous</option>
            {(Object.keys(CONTRACT_LABEL) as ContractKind[])
              .filter((k) => contractCounts.get(k))
              .map((k) => (
                <option key={k} value={k}>
                  {CONTRACT_LABEL[k]} ({contractCounts.get(k)})
                </option>
              ))}
          </select>
        </label>
        <label>
          Trier
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="recent">Les plus récentes</option>
            <option value="score">Meilleur score</option>
            <option value="profile" disabled={!hasSimilarity}>
              Les plus proches de mon CV{hasSimilarity ? "" : " (importe ton CV)"}
            </option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        data.jobs.length === 0 ? (
          <Empty
            title="Aucune offre pour l’instant"
            text="Choisis tes métiers dans Réglages : les offres arrivent deux fois par jour."
            action={
              <button className="btn" onClick={() => ctx.go("settings")}>
                Choisir mes métiers
              </button>
            }
          />
        ) : jobFilter === "new" ? (
          <Empty title="Tu as tout vu" text="Les nouvelles offres arrivent le matin et en début d’après-midi." />
        ) : (
          <Empty title="Aucune offre ici" text="Change de filtre ou de recherche." />
        )
      ) : (
        <>
          <div className="offers">
            {visible.map((job) => (
              <OfferCard key={job.id} job={job} kit={kits.get(job.id)} closest={closest.has(job.id)} onOpen={openOffer} />
            ))}
          </div>
          {rows.length > shown && (
            <div className="more-row">
              <button className="btn secondary" onClick={() => setShown((n) => n + 30)}>
                Voir plus d’offres ({rows.length - shown})
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
