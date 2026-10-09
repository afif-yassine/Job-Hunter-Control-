"use client";
import { silhouetteCount, teaserText } from "@/components/unlock";

/**
 * What comes next, said under the day's offers: a few DRAWN silhouettes (no real offer, no title, no company,
 * no score, no link: hidden from screen readers and not clickable) and the words of the business judgment.
 * Nothing here sells anything: no price, no plan name, and no way to the rest of the catalogue. With no offer
 * today, the one button leads to Réglages, where the jobs are chosen.
 */
export function LockedTeaser({ batch, locked, onSettings }: { batch: number; locked: number; onSettings: () => void }) {
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
        {batch <= 0 && (
          <button className="btn secondary" onClick={onSettings}>
            Ouvrir Réglages
          </button>
        )}
      </div>
    </section>
  );
}
