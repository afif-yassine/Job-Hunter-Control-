"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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
        <CardDialog item={open} onClose={() => setOpen(null)} />
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

/**
 * The small window a card opens (a sheet at the bottom on a phone): close with the cross, Échap or a click
 * beside it. The student opens it himself, so it does not count as the day's one window. Both buttons are the
 * same size; the way to stay free is written in plain words.
 */
function CardDialog({ item, onClose }: { item: TeaserItem | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    if (!item && dialog.open) dialog.close();
  }, [item]);
  return (
    <dialog
      ref={ref}
      className="plus-dialog"
      aria-labelledby="plus-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {item && (
        <div className="plus-dialog-body">
          <button type="button" className="iconbtn plus-dialog-close" aria-label={CARD_DIALOG.close} onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
          <h2 id="plus-dialog-title">{CARD_DIALOG.title}</h2>
          <p className="muted">{dialogPhrase(item)}</p>
          <div className="plus-dialog-actions">
            <a className="btn" href={pricingHref("carte")}>
              {PLUS_BUTTON}
            </a>
            <button type="button" className="btn secondary" onClick={onClose}>
              {CARD_DIALOG.stay}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
