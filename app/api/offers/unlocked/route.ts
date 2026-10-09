import { authenticatedClient } from "@/lib/api";
import { unlockedState } from "@/lib/unlock";

export const dynamic = "force-dynamic";

/**
 * The offers the account may work on, and today's lot (computed here, on the first visit of the day).
 *   { unlocked: [{ jobId, unlockedOn, origin: "daily" | "backfill" | "manual" }], reason?, newToday }
 *   { unlocked: "all" }                       the administrator
 *   { unlocked: null, reason: "NOT_READY" }   the feature is not installed yet (or failed): treat everything as unlocked
 * `reason` on a list says why it is empty or short (NO_SEARCH, NO_PROFILE, NO_PROFILE_VECTOR, NO_CANDIDATES,
 * NONE_ABOVE_THRESHOLD, DEGRADED) so the screen can tell the student what to do.
 */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  try {
    const state = await unlockedState(auth.supabase, auth.userId);
    if (state.mode === "all") return Response.json({ unlocked: "all" });
    if (state.mode === "not_ready") return Response.json({ unlocked: null, reason: "NOT_READY" });
    return Response.json({ unlocked: state.unlocked, reason: state.note, newToday: state.newToday });
  } catch {
    return Response.json({ unlocked: null, reason: "NOT_READY" });
  }
}
