"use client";
import { LoaderCircle } from "lucide-react";
import { actionMessage } from "@/components/unlock";
import { Callout } from "@/components/ui";
import { JobsView } from "./jobs-view";
import { PicksView } from "./picks-view";
import type { Ctx } from "./types";

/**
 * The "Offres" page. A student who has a selection (batches) sees only that selection: there is no way to the
 * rest of the catalogue from here. In every other case (administrator, demo, nothing known, any doubt, no batch
 * could be made) nothing is hidden: it is the catalogue with its tabs and filters, as before.
 */
export function JobsEntry({ ctx }: { ctx: Ctx }) {
  const { unlock } = ctx;
  if (unlock.kind === "loading")
    return (
      <div className="empty" role="status">
        <LoaderCircle className="spin" aria-hidden /> Chargement de tes offres…
      </div>
    );
  if (unlock.kind === "locking") return <PicksView ctx={ctx} />;
  return (
    <>
      {unlock.kind === "action" && (
        <div style={{ marginBottom: 16 }}>
          <Callout
            tone="info"
            title="Pas encore de sélection du jour"
            action={
              <button className="btn secondary small" onClick={() => ctx.go("settings")}>
                Ouvrir Réglages
              </button>
            }
          >
            {actionMessage(unlock.need)}
          </Callout>
        </div>
      )}
      <JobsView ctx={ctx} />
    </>
  );
}
