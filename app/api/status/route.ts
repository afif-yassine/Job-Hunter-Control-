import { authenticatedClient } from "@/lib/api";
import { applicationMode, isSafeMode } from "@/lib/config";
import { integrationStatus } from "@/lib/integrations";
import { usageToday } from "@/lib/quota";
import { loadUserSettings } from "@/lib/settings";

/** Asks the Railway worker whether it is up and its browser is installed. */
async function workerState(): Promise<{ online: boolean; browserReady: boolean | null }> {
  const base = process.env.WORKER_BASE_URL?.replace(/\/+$/, "");
  if (!base) return { online: false, browserReady: null };
  try {
    const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return { online: false, browserReady: null };
    const body = (await response.json().catch(() => ({}))) as { browserReady?: boolean };
    return { online: true, browserReady: typeof body.browserReady === "boolean" ? body.browserReady : null };
  } catch {
    return { online: false, browserReady: null };
  }
}

/**
 * Tells the (authenticated) dashboard which integrations are configured.
 * Only booleans, masked hints and the safety mode are returned, never a secret.
 */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const has = (name: string) => Boolean(process.env[name]?.trim());
  const [providers, settings, worker, usage] = await Promise.all([
    integrationStatus(auth.supabase, auth.userId),
    loadUserSettings(auth.supabase, auth.userId),
    workerState(),
    usageToday(auth.supabase, auth.userId),
  ]);
  return Response.json({
    applicationMode: applicationMode(),
    safeMode: isSafeMode(),
    explicitModeVariable: has("APPLICATION_MODE"),
    gemini: has("GEMINI_API_KEY"),
    drive:
      has("GOOGLE_SERVICE_ACCOUNT_JSON") &&
      has("GOOGLE_DRIVE_CVS_FOLDER_ID") &&
      has("GOOGLE_DRIVE_LETTERS_FOLDER_ID"),
    worker: has("WORKER_BASE_URL") && has("WORKER_SHARED_SECRET"),
    workerOnline: worker.online,
    workerBrowserReady: worker.browserReady,
    providers,
    integrationsSecret: has("INTEGRATIONS_SECRET"),
    scanConfigured:
      providers.some((p) => p.configured) || has("SCAN_WEBHOOK_URL") || settings.prefs.targets.length > 0,
    autoScan: settings.autoScan,
    lastScanAt: settings.lastScanAt,
    // The server runs search → score → documents by itself (see /api/cron/tick).
    scheduledScan: has("CRON_SECRET") && has("SUPABASE_SERVICE_ROLE_KEY"),
    usage,
  });
}
