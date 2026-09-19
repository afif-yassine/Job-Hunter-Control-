import { authenticatedClient } from "@/lib/api";
import { runScan, scanMessage, SETUP_HINT } from "@/lib/scan";

// France Travail + Gmail take a few seconds; allow up to a minute.
export const maxDuration = 60;

/**
 * Runs the offer scan for the logged-in user: official API + e-mail alerts
 * (+ an optional external scanner), then de-duplicates and stores new offers as
 * DISCOVERED so the smart pipeline can score them.
 */
export async function POST() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const summary = await runScan({ supabase: auth.supabase, userId: auth.userId });
  if (!summary.configured)
    return Response.json({ error: SETUP_HINT, ...summary }, { status: 503 });
  return Response.json({ message: scanMessage(summary), ...summary });
}
