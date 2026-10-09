"use client";
import { LoaderCircle } from "lucide-react";
import { actionMessage } from "@/components/unlock";
import { Callout } from "@/components/ui";
import { JobsView } from "./jobs-view";
import { PicksView } from "./picks-view";
import type { Ctx } from "./types";

/**
 * The "Offres" page. When the student has a selection (batches), it opens on it and the whole catalogue
 * is one button away; in every other case (administrator, demo, nothing known, any doubt) it is the
 * catalogue with its tabs and filters, exactly as before.
 */
export function JobsEntry({ ctx }: { ctx: Ctx }) {
  const { unlock, jobsMode } = ctx;
  if (unlock.kind === "loading")
    return (
      <div className="empty" role="status">
        <LoaderCircle className="spin" aria-hidden /> Chargement de tes offres…
      </div>
    );
  if (unlock.kind === "locking" && jobsMode === "picks") return <PicksView ctx={ctx} />;
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
            {actionMessage(unlock.need)} En attendant, tout le catalogue est ouvert.
          </Callout>
        </div>
      )}
      {unlock.kind === "locking" && (
        <p style={{ marginBottom: 12 }}>
          <button className="linkbtn" onClick={() => ctx.setJobsMode("picks")}>
            ← Revenir à ma sélection
          </button>
        </p>
      )}
      <JobsView ctx={ctx} />
    </>
  );
}
