"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const EXCUSES = [
  "Ce chapitre est encore chez le relieur.",
  "Le génie est parti chercher de l’encre.",
  "Page en cours d’écriture : l’encre n’est pas sèche.",
  "Un ver de bibliothèque a grignoté cette page. On la réimprime.",
  "Le génie a dit : « Ton vœu est entendu. Repasse bientôt. »",
];

/**
 * The fun "not ready yet" message, as a modal. `feature` names what is coming.
 */
export function SoonModal({ feature, onClose }: { feature: string | null; onClose: () => void }) {
  const [i, setI] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!feature) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feature, onClose]);

  return (
    <AnimatePresence>
      {feature && (
        <motion.div className="jj-modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="jj-soon-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jj-soon-title"
            initial={{ opacity: 0, y: 30, rotateX: 18 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button ref={closeRef} type="button" className="jj-soon-close" onClick={onClose} aria-label="Fermer">×</button>
            <div className="jj-mini-book" aria-hidden="true">
              <div className="jj-book-cover" />
              <div className="jj-page is-left"><div className="jj-lines" style={{ height: 80 }} /></div>
              <div className="jj-page is-right" style={{ display: "grid", placeItems: "center" }}>
                <span className="jj-fell" style={{ fontSize: 40, color: "rgba(31,26,20,.25)" }}>?</span>
              </div>
              <div className="jj-leaf" />
              <div className="jj-leaf" style={{ animationDelay: "1.5s" }} />
              <svg className="jj-worm" viewBox="0 0 44 18" width="44" height="18">
                <path className="jj-ic" d="M2 13 C 6 5, 10 5, 14 13 C 18 5, 22 5, 26 13 C 30 5, 34 6, 38 9" style={{ strokeWidth: 3.2 }} />
                <circle cx="38" cy="8" r="1.3" fill="#1f1a14" />
              </svg>
            </div>
            <div className="jj-label" style={{ marginTop: 18 }}>Bientôt · {feature}</div>
            <AnimatePresence mode="wait">
              <motion.h2
                key={i}
                id="jj-soon-title"
                className="jj-fell"
                style={{ fontSize: "clamp(30px, 5vw, 44px)", lineHeight: 1.08, textWrap: "balance" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                {EXCUSES[i % EXCUSES.length]}
              </motion.h2>
            </AnimatePresence>
            <p style={{ fontSize: 17, color: "var(--ink-2)", maxWidth: 460 }}>Cette fonction arrive bientôt. Le reste du livre, lui, est déjà ouvert.</p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 24, minHeight: 60 }}>
              <button type="button" className="jj-bound" onClick={onClose}>Retourner au livre</button>
              <button type="button" className="jj-quill" onClick={() => setI((n) => n + 1)}>Une autre excuse</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
