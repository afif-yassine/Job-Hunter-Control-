import { after } from "next/server";
import { authenticatedClient } from "@/lib/api";
import { unlockedState } from "@/lib/unlock";

export const dynamic = "force-dynamic";
// Today's lot may take a while on the first visit of the day: the answer does not wait for it (see unlockedState),
// but the computation keeps running after the answer, within this limit.
export const maxDuration = 60;

/**
 * The offers the account may work on, and today's lot (computed here, on the first visit of the day).
 *   { unlocked: [{ jobId, unlockedOn, origin: "daily" | "backfill" | "manual" }], reason?, newToday, diag }
 *   { unlocked: "all" }                       the administrator
 *   { unlocked: null, reason: "NOT_READY" }   the feature is not installed yet (or failed): treat everything as unlocked
 * `reason` on a list says why it is empty or short (NO_SEARCH, NO_PROFILE, NO_PROFILE_VECTOR, NO_CANDIDATES,
 * NONE_ABOVE_THRESHOLD, DEGRADED) so the screen can tell the student what to do. COMPUTING means the lot of the day is
 * still being prepared: the list is the one already unlocked, ask again in a few seconds.
 * `diag` ({ step, totalMs, done }) is a non-sensitive trace of the computation, for support.
 */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  try {
    const state = await unlockedState(auth.supabase, auth.userId);
    if (state.mode === "all") return Response.json({ unlocked: "all" });
    if (state.mode === "not_ready") return Response.json({ unlocked: null, reason: "NOT_READY" });
    if (state.pending) {
      const pending = state.pending;
      after(async () => {
        await pending.catch(() => undefined);
      });
    }
    return Response.json({ unlocked: state.unlocked, reason: state.note, newToday: state.newToday, diag: state.diag });
  } catch {
    return Response.json({ unlocked: null, reason: "NOT_READY" });
  }
}
