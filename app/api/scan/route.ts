import { isAdmin } from "@/lib/admin";
import { authenticatedClient } from "@/lib/api";
import { consumeQuota, quotaRefusal } from "@/lib/quota";
import { runScan, scanMessage, SETUP_HINT } from "@/lib/scan";
import { studentCatalogueOnly } from "@/lib/scan/config";
import { unlockGate } from "@/lib/unlock";

// France Travail + Gmail take a few seconds; allow up to a minute.
export const maxDuration = 60;

/**
 * Runs the offer scan for the logged-in user: official API + e-mail alerts
 * (+ an optional external scanner), then de-duplicates and stores new offers as
 * DISCOVERED so the smart pipeline can score them.
 */
export async function POST(req: Request) {
  const auth = await authenticatedClient("scan");
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { log?: boolean };
  // The decision is the server's: the administrator's search is the only one that may use the
  // operator's mailbox and webhook, and (once the owner switches it on) call job sites.
  const admin = await isAdmin(auth.supabase);
  // With the daily selection active for this account, no job site is called either (runScan does the same),
  // so the update costs nothing outside and does not spend the daily scan quota.
  const gate = admin ? ({ active: false } as const) : await unlockGate(auth.supabase, auth.userId);
  const catalogueOnly = !admin && (studentCatalogueOnly() || gate.active);
  // Scheduled server scans are free; scans started from the dashboard are counted.
  // A catalogue-only update costs nothing outside, so it does not spend the daily scan quota.
  if (!catalogueOnly) {
    const quota = await consumeQuota(auth.supabase, auth.userId, "scan");
    if (!quota.ok) {
      const refusal = quotaRefusal("scan", quota.limit, quota.unavailable);
      return Response.json(refusal.body, { status: refusal.status });
    }
  }
  const summary = await runScan({
    supabase: auth.supabase,
    userId: auth.userId,
    // The full pipeline writes its own journal entry.
    log: body.log !== false,
    student: !admin,
    catalogueOnly,
  });
  if (!summary.configured)
    return Response.json({ error: SETUP_HINT, ...summary }, { status: 503 });
  return Response.json({ message: scanMessage(summary), ...summary });
}
