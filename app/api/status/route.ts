import { authenticatedClient } from "@/lib/api";
import { applicationMode, isSafeMode } from "@/lib/config";

/**
 * Tells the (authenticated) dashboard which integrations are configured.
 * Only booleans and the safety mode are returned, never a secret value.
 */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const has = (name: string) => Boolean(process.env[name]?.trim());
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
    scanSources: {
      franceTravail:
        has("FRANCE_TRAVAIL_CLIENT_ID") && has("FRANCE_TRAVAIL_CLIENT_SECRET"),
      gmailAlerts:
        has("GMAIL_CLIENT_ID") &&
        has("GMAIL_CLIENT_SECRET") &&
        has("GMAIL_REFRESH_TOKEN"),
      webhook: has("SCAN_WEBHOOK_URL"),
    },
    scheduledScan:
      has("CRON_SECRET") &&
      has("SCAN_USER_ID") &&
      has("SUPABASE_SERVICE_ROLE_KEY"),
  });
}
