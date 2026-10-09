"use client";
import { useState } from "react";
import { PlusWindow } from "@/components/plus-window";
import { pricingHref } from "@/components/pricing";
import {
  ageText,
  CARD_DIALOG,
  CARD_LABEL,
  cardSpoken,
  commonText,
  dialogPhrase,
  endPhrase,
  endTitle,
  morePhrase,
  moreTitle,
  PLUS_BUTTON,
  placeText,
  skillsText,
  type TeaserItem,
} from "@/components/teaser-cards";
import { silhouetteCount, teaserText } from "@/components/unlock";

/**
 * What comes next, said under the day's offers.
 * - With cards (the server named offers LeBonTaf Plus would add, and the account may be proposed Plus): up to three
 *   blurred cards, each a real offer described by what the server computed, with the title and the company as
 *   DRAWN grey bars (no text under them). "Avec Plus", and a button to the pricing page.
 * - Otherwise: a few DRAWN silhouettes and the plain words, selling nothing. With no offer today, the one button
 *   leads to Réglages, where the jobs are chosen.
 */
export function LockedTeaser({
  batch,
  locked,
  onSettings,
  cards = [],
  more = 0,
  phase = "more",
}: {
  batch: number;
  locked: number;
  onSettings: () => void;
  cards?: TeaserItem[];
  more?: number;
  /** "end": every offer of the day was opened, kept or put aside. */
  phase?: "more" | "end";
}) {
  const [open, setOpen] = useState<TeaserItem | null>(null);

  if (cards.length > 0) {
    const title = phase === "end" ? endTitle(batch) : moreTitle(more);
    const phrase = phase === "end" ? endPhrase(more) : morePhrase();
    return (
      <section className="teaser card" aria-labelledby="teaser-title">
        <div className="teaser-text">
          <h2 id="teaser-title">{title}</h2>
          <p className="muted">{phrase}</p>
        </div>
        <div className="tcards">
          {cards.map((item, i) => (
            <button key={i} type="button" className="tcard" aria-label={cardSpoken(item)} onClick={() => setOpen(item)}>
              <span className="tcard-label" aria-hidden="true">
                {CARD_LABEL}
              </span>
              {/* Drawn bars: no text is hidden under them. */}
              <span className="tcard-bars" aria-hidden="true">
                <i className="is-title" />
                <i className="is-company" />
              </span>
              <span className="tcard-facts" aria-hidden="true">
                <b>{commonText(item)}</b>
                {skillsText(item) && <span>{skillsText(item)}</span>}
                <span>
                  {item.contract} · {placeText(item)}
                </span>
                <span>{ageText(item.publishedAgoDays)}</span>
              </span>
            </button>
          ))}
        </div>
        <a className="btn secondary" href={pricingHref(phase === "end" ? "fin" : "cartes")}>
          {PLUS_BUTTON}
        </a>
        <PlusWindow
          open={open !== null}
          title={CARD_DIALOG.title}
          primary={PLUS_BUTTON}
          href={pricingHref("carte")}
          secondary={CARD_DIALOG.stay}
          closeLabel={CARD_DIALOG.close}
          onClose={() => setOpen(null)}
        >
          {open ? dialogPhrase(open) : ""}
        </PlusWindow>
      </section>
    );
  }

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
