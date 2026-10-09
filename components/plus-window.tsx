"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * The one small window that proposes LeBonTaf Plus (a sheet at the bottom on a phone). Words come from the caller.
 * It closes with the cross (44 px, always there), Échap or a click beside it; the two buttons have the same size and
 * the way to stay free is written in plain words. The primary button only leads to the pricing page.
 */
export function PlusWindow({
  open,
  title,
  children,
  primary,
  href,
  secondary,
  closeLabel = "Fermer",
  onClose,
}: {
  open: boolean;
  title: string;
  children: string;
  primary: string;
  href: string;
  secondary: string;
  closeLabel?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
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
      {open && (
        <div className="plus-dialog-body">
          <button type="button" className="iconbtn plus-dialog-close" aria-label={closeLabel} onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
          <h2 id="plus-dialog-title">{title}</h2>
          <p className="muted">{children}</p>
          <div className="plus-dialog-actions">
            <a className="btn" href={href}>
              {primary}
            </a>
            <button type="button" className="btn secondary" onClick={onClose}>
              {secondary}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
