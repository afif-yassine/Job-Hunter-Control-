"use client";
import { silhouetteCount, teaserText } from "@/components/unlock";

/**
 * What comes next, said under the day's offers: a few DRAWN silhouettes (no real offer, no title, no company,
 * no score, no link: hidden from screen readers and not clickable) and the words of the business judgment.
 * The only button is "Explorer tout le catalogue". Nothing here sells anything: no price, no plan name.
 */
export function LockedTeaser({ batch, locked, onExplore }: { batch: number; locked: number; onExplore: () => void }) {
  const { title, text } = teaserText(batch);
  const count = silhouetteCount(locked);
  return (
    <section className="teaser card" aria-labelledby="teaser-title">
      <div className="teaser-silhouettes" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="teaser-card">
            <i />
            <i />
            <i />
          </span>
        ))}
      </div>
      <div className="teaser-text">
        <h2 id="teaser-title">{title}</h2>
        <p className="muted">{text}</p>
        <button className="btn secondary" onClick={onExplore}>
          Explorer tout le catalogue
        </button>
      </div>
    </section>
  );
}
