"use client";
import { PageHead } from "@/components/ui";
import { FEATURES, STATE_LABEL, type FeatureState } from "@/lib/roadmap";

const ORDER: FeatureState[] = ["done", "doing", "soon"];
const TONE: Record<FeatureState, string> = { done: "good", doing: "info", soon: "neutral" };

/** What works today, what is being built, what comes next. */
export function RoadmapView() {
  return (
    <>
      <PageHead title="Feuille de route" subtitle="Ce qui marche déjà, ce qui est en cours, ce qui arrive ensuite." />
      {ORDER.map((state) => {
        const items = FEATURES.filter((f) => f.state === state);
        if (!items.length) return null;
        return (
          <section key={state} className="settings-section">
            <h2 className="section-title">
              {STATE_LABEL[state]} ({items.length})
            </h2>
            <ul className="card list roadmap">
              {items.map((f) => (
                <li key={f.id} className="row">
                  <span className={`chip ${TONE[state]}`}>{f.sprint ? `Sprint ${f.sprint}` : STATE_LABEL[state]}</span>
                  <span className="row-main">
                    <strong>{f.label}</strong>
                    {f.detail && <span className="muted">{f.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
