"use client";

import { useCallback, useState } from "react";
import { SoonModal } from "./soon";

/** Public sign-up is not open yet: say it with the fun "bientôt" message. */
export function NoAccountYet() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <p style={{ fontSize: 15, color: "#4a4136" }}>
        Pas encore de compte ?{" "}
        <button type="button" className="jj-quill" style={{ fontSize: 15, padding: "12px 0 2px" }} onClick={() => setOpen(true)}>
          Les inscriptions ouvrent bientôt
        </button>
      </p>
      <SoonModal feature={open ? "inscriptions" : null} onClose={close} />
    </>
  );
}
