"use client";
import { useEffect, useState } from "react";
import { Callout } from "@/components/ui";
import { DEFAULT_PREFS, type ScanPrefs } from "@/lib/scan/config";
import { CATEGORIES } from "@/lib/scan/categories";
import type { DiscoveredTarget } from "@/lib/scan/discover";
import type { Ctx } from "@/components/views/types";

export const CONTRACTS = [
  ["alternance", "Alternance"],
  ["stage", "Stage"],
  ["cdd", "CDD"],
] as const;

export const split = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** What the student has chosen to look for: at least one job (a ticked category or a keyword). */
export function hasChosenJob(prefs: Pick<ScanPrefs, "categories" | "keywords">): boolean {
  return (prefs.categories ?? []).length > 0 || (prefs.keywords ?? []).length > 0;
}

/**
 * The search preferences of the account (/api/settings), read once and saved as a whole. Shared by Réglages and the
 * sign-up journey so both edit the very same fields. `save` returns true when the server accepted them.
 */
export function useSearchPrefs(ctx: Ctx) {
  const { notify, refreshStatus, reload } = ctx;
  const [prefs, setPrefs] = useState<ScanPrefs>(DEFAULT_PREFS);
  const [keywords, setKeywords] = useState(DEFAULT_PREFS.keywords.join(", "));
  const [departments, setDepartments] = useState(DEFAULT_PREFS.departments.join(", "));
  const [targets, setTargets] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredTarget[]>([]);
  const [auto, setAuto] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<{ total: number; byCategory: Record<string, number> } | null>(null);
  const [countsError, setCountsError] = useState("");

  // Offers already in the catalogue for each category, around the place being edited.
  useEffect(() => {
    if (!loaded) return;
    const params = new URLSearchParams({
      city: prefs.city,
      departments: split(departments).join(","),
      contracts: prefs.contracts.join(","),
      days: String(prefs.maxAgeDays),
    });
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/catalogue/counts?${params}`, { signal: controller.signal })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
          setCounts(body);
          setCountsError("");
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted) setCountsError(e instanceof Error ? e.message : "erreur");
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loaded, prefs.city, prefs.contracts, prefs.maxAgeDays, departments]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings")
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then((body) => {
        if (cancelled || !body) return;
        setPrefs(body.prefs);
        setKeywords(body.prefs.keywords.join(", "));
        setDepartments(body.prefs.departments.join(", "));
        setTargets((body.prefs.targets ?? []).join("\n"));
        setDiscovered(body.discovered ?? []);
        setAuto(body.autoScan !== false);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadFailed(true);
        notify(`Réglages de recherche illisibles : ${error instanceof Error ? error.message : "erreur"}`, "bad");
      });
    return () => {
      cancelled = true;
    };
  }, [notify]);

  async function save(): Promise<boolean> {
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
      if (Number(body.imported) || 0) await reload();
      // No promise about when offers arrive: a student gets his selection of the day, not a list filled at once.
      notify("Recherche enregistrée : elle sert à choisir tes prochaines offres.", "good");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erreur", "bad");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const toggleCategory = (id: string) => {
    const current = prefs.categories ?? [];
    setPrefs({ ...prefs, categories: current.includes(id) ? current.filter((c) => c !== id) : [...current, id] });
  };

  const toggleContract = (value: string) =>
    setPrefs({
      ...prefs,
      contracts: prefs.contracts.includes(value) ? prefs.contracts.filter((c) => c !== value) : [...prefs.contracts, value],
    });

  return {
    prefs,
    setPrefs,
    keywords,
    setKeywords,
    departments,
    setDepartments,
    targets,
    setTargets,
    discovered,
    setDiscovered,
    auto,
    setAuto,
    loaded,
    loadFailed,
    saving,
    counts,
    countsError,
    save,
    toggleCategory,
    toggleContract,
  };
}

export type SearchPrefsState = ReturnType<typeof useSearchPrefs>;

/**
 * The fields every student fills: type of contract, jobs (with how many offers are known around), other keywords
 * and city. Réglages adds its own advanced fields below; the sign-up journey shows only these.
 */
export function SearchBasics({ s }: { s: SearchPrefsState }) {
  const { prefs, setPrefs, keywords, setKeywords, loaded, counts, countsError } = s;
  return (
    <>
      <fieldset className="wide">
        <legend>Type de contrat</legend>
        <div className="chips">
          {CONTRACTS.map(([id, label]) => (
            <label key={id} className={prefs.contracts.includes(id) ? "pill active" : "pill"}>
              <input type="checkbox" className="sr" checked={prefs.contracts.includes(id)} onChange={() => s.toggleContract(id)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="wide">
        <legend>Métiers</legend>
        {loaded && !(prefs.categories ?? []).length && !split(keywords).length && (
          <Callout tone="info" title="Choisis au moins un métier">
            Sans métier coché, on ne peut pas te proposer d’offres. Coche ceux qui t’intéressent ci-dessous.
          </Callout>
        )}
        <small className="muted">
          Coche les métiers qui t’intéressent : tes offres du jour sont choisies selon eux. Le nombre indique les offres connues autour de toi
          {counts ? ` (${counts.total} au total)` : ""}.
        </small>
        <div className="categories">
          {CATEGORIES.map((c) => {
            const on = (prefs.categories ?? []).includes(c.id);
            const n = counts?.byCategory[c.id];
            return (
              <label key={c.id} className={on ? "category active" : "category"} title={c.examples}>
                <input type="checkbox" className="sr" checked={on} onChange={() => s.toggleCategory(c.id)} />
                <span className="category-name">{c.label}</span>
                <span className="category-count">{counts ? `${n ?? 0} offre${(n ?? 0) > 1 ? "s" : ""}` : "…"}</span>
                <small className="muted">{c.examples}</small>
              </label>
            );
          })}
        </div>
        {countsError && <small className="warn-text">Nombre d’offres indisponible : {countsError}</small>}
      </fieldset>
      <label className="wide">
        Autre métier ou mots-clés (facultatif)
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ex. technicien fibre, intégrateur web" />
        <small className="muted">Pour un métier qui n’est dans aucune case. Sépare-les par des virgules (8 maximum).</small>
      </label>
      <label>
        Ville
        <input value={prefs.city ?? ""} onChange={(e) => setPrefs({ ...prefs, city: e.target.value })} placeholder="ex. Lyon" />
      </label>
    </>
  );
}
