"use client";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one card that proposes LeBonTaf Plus, wherever the incentive plan puts it. It carries no text of its own:
 * title, sentence and button come from the caller. The way to close it is always visible, and the button only
 * leads to the pricing page (nothing is sold here).
 */
export function PlusOfferCard({
  title,
  children,
  action,
  href = "/tarifs",
  onClose,
}: {
  title: string;
  children: ReactNode;
  action: string;
  href?: string;
  onClose: () => void;
}) {
  return (
    <aside className="plus-offer card" aria-label={title}>
      <button type="button" className="iconbtn plus-offer-close" aria-label="Fermer" onClick={onClose}>
        <X size={16} aria-hidden />
      </button>
      <strong>{title}</strong>
      <p className="muted">{children}</p>
      <a className="btn secondary" href={href}>
        {action}
      </a>
    </aside>
  );
}
