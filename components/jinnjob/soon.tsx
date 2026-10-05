"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const EXCUSES = [
  "Ce dossier est encore sous scellés.",
  "L’inspecteur est parti chercher des indices.",
  "Pièce à conviction en cours d’analyse au labo.",
  "Le témoin principal n’a pas encore rappelé.",
  "Affaire en cours. Repasse bientôt, on te tient au courant.",
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
            <div className="jj-mini-case" aria-hidden="true">
              <div className="jj-mini-folder">
                <span className="jj-mini-tab" />
                <span className="jj-mini-stamp">SOUS SCELLÉS</span>
              </div>
              <svg className="jj-mini-lens" viewBox="0 0 60 60" width="60" height="60">
                <circle cx="24" cy="24" r="15" fill="rgba(255,255,255,.35)" stroke="#1c1a17" strokeWidth="4" />
                <path d="M35 35 L52 52" stroke="#1c1a17" strokeWidth="7" strokeLinecap="round" />
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
            <p style={{ fontSize: 17, color: "var(--ink-2)", maxWidth: 460 }}>Cette fonction arrive bientôt. Le reste de l’enquête, lui, est déjà ouvert.</p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 24, minHeight: 60 }}>
              <button type="button" className="jj-bound" onClick={onClose}>Retour au tableau</button>
              <button type="button" className="jj-quill" onClick={() => setI((n) => n + 1)}>Une autre excuse</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
