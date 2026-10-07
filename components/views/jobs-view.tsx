"use client";
import { compareFits, scoreOf } from "@/lib/fit";
import { useEffect, useMemo, useState } from "react";
import { matchesAdvancedFilters, searchFilters, type SavedSearch, type SearchFilters } from "@/lib/saved-searches";
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
  const [sort, setSort] = useState<"recent" | "score">("recent");
  const [city, setCity] = useState("");
  const [maxAgeDays, setMaxAgeDays] = useState<SearchFilters["maxAgeDays"]>(0);
  const [remote, setRemote] = useState(false);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchesReady, setSearchesReady] = useState(false);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    if (!ctx.supabase) return;
    const controller = new AbortController();
    fetch("/api/searches", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Recherches enregistrées indisponibles. Recharge la page pour réessayer.");
      const result = await response.json();
      setSaved(result.searches); setSearchesReady(true);
    }).catch(error => { if (!controller.signal.aborted) setSearchError(error.message); });
    return () => controller.abort();
  }, [ctx.supabase]);
  async function persistSearches(next: SavedSearch[]) {
    setSaving(true); setSearchError("");
    try {
      const response = await fetch("/api/searches", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sauvegarde impossible.");
      setSaved(result.searches); setName(""); ctx.notify("Recherches enregistrées mises à jour.");
    } catch (error) { setSearchError(error instanceof Error ? error.message : "Sauvegarde impossible."); }
    finally { setSaving(false); }
  }
  const kits = useMemo(() => kitsByJob(data.documents), [data.documents]);

  // The closest offers to the profile (top 25 by score: the AI's or the free comparison).
  const closest = useMemo(
    () =>
      new Set(
        [...data.jobs]
          .filter((j) => scoreOf(j) >= 0 || typeof j.similarity === "number")
          .sort(compareFits)
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
    const filtered = list.filter(j => matchesAdvancedFilters(j, { city, maxAgeDays, remote }));
    if (sort === "score" || (jobFilter === "best" && sort === "recent")) return [...filtered].sort(compareFits);
    return [...filtered].sort((a, b) => Date.parse(b.publication_date || b.created_at || "1970-01-01") - Date.parse(a.publication_date || a.created_at || "1970-01-01"));
  }, [inTab, jobFilter, query, metier, contract, facets, sort, city, maxAgeDays, remote]);

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
            <option value="score" disabled={!hasSimilarity}>
              Les plus proches de mon CV{hasSimilarity ? "" : " (importe ton CV)"}
            </option>
          </select>
        </label>
      </div>

      <div className="facets">
        <label>Ville<input value={city} maxLength={80} onChange={e => { setCity(e.target.value); setShown(30); }} placeholder="Toutes les villes" /></label>
        <label>Publication<select value={maxAgeDays} onChange={e => { setMaxAgeDays(Number(e.target.value) as SearchFilters["maxAgeDays"]); setShown(30); }}>
          <option value={0}>Toutes les dates</option><option value={7}>Depuis 7 jours</option><option value={14}>Depuis 14 jours</option><option value={30}>Depuis 30 jours</option>
        </select></label>
        <label><input type="checkbox" checked={remote} onChange={e => { setRemote(e.target.checked); setShown(30); }} /> Télétravail explicitement proposé</label>
      </div>
      {ctx.supabase && <div className="facets">
        <label>Nom de la recherche<input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Ex. Stage data à Lyon" /></label>
        <button className="btn secondary" disabled={saving || !searchesReady || !name.trim() || (saved.length >= 10 && !saved.some(s => s.name.toLowerCase() === name.trim().toLowerCase()))} onClick={() => {
          const filters = searchFilters.parse({ query, metier, contract, sort, city, maxAgeDays, remote });
          void persistSearches([...saved.filter(s => s.name.toLowerCase() !== name.trim().toLowerCase()), { name: name.trim(), filters }]);
        }}>Enregistrer ces filtres</button>
        {saved.map(search => <div className="inline" key={search.name}>
          <button className="btn secondary" onClick={() => {
            const f = search.filters;
            setQuery(f.query); setMetier(f.metier); setContract(f.contract); setSort(f.sort); setCity(f.city); setMaxAgeDays(f.maxAgeDays); setRemote(f.remote); setName(search.name); setJobFilter("all"); setShown(30);
          }}>{search.name}</button>
          <button className="btn secondary" disabled={saving} aria-label={`Supprimer la recherche ${search.name}`} onClick={() => void persistSearches(saved.filter(s => s.name !== search.name))}>×</button>
        </div>)}
      </div>}
      {searchError && <p role="alert">{searchError}</p>}

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
