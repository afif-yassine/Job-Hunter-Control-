"use client";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one card that proposes LeBonTaf Plus in the page (a block that covers nothing). It carries no words of its
 * own: title, sentence and button come from the caller. The cross is always visible (44 px), and the button only
 * leads to the pricing page: nothing is sold here.
 */
export function PlusOfferCard({
  title,
  children,
  action,
  href,
  onClose,
}: {
  title: string;
  children: ReactNode;
  action: string;
  href: string;
  onClose?: () => void;
}) {
  return (
    <aside className="plus-offer card" aria-label={title}>
      {onClose && (
        <button type="button" className="iconbtn plus-offer-close" aria-label="Fermer" onClick={onClose}>
          <X size={18} aria-hidden />
        </button>
      )}
      <strong>{title}</strong>
      <p className="muted">{children}</p>
      <a className="btn secondary" href={href}>
        {action}
      </a>
    </aside>
  );
}
