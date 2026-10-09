/**
 * What "Télécharger mes données" contains: every table holding rows of the
 * account, minus what is useless or must never leave the server (encrypted
 * keys, vectors). A new user table is added here and in the privacy policy.
 */
export const EXPORT_TABLES: { table: string; columns: string; note?: string; /** Unique, stable column the pages are ordered by (default "id"). */ orderBy?: string }[] = [
  {
    table: "candidate_profiles",
    columns:
      "id,full_name,email,phone,location,linkedin_url,github_url,portfolio_url,availability,work_authorization,profile,truth_ledger,source_files,created_at,updated_at",
  },
  { table: "user_settings", columns: "scan_config,auto_scan,last_scan_at,discovered_targets,updated_at", orderBy: "user_id" },
  { table: "jobs", columns: "*" },
  { table: "job_sources", columns: "*" },
  { table: "documents", columns: "*" },
  { table: "applications", columns: "*" },
  { table: "application_questions", columns: "*" },
  { table: "profile_answers", columns: "*" },
  { table: "notifications", columns: "*" },
  { table: "agent_rules", columns: "*" },
  { table: "agent_schedules", columns: "*" },
  { table: "agent_runs", columns: "*" },
  { table: "audit_events", columns: "*" },
  { table: "offer_reports", columns: "*" },
  { table: "usage_events", columns: "*" },
  { table: "ai_usage", columns: "*" },
  { table: "source_runs", columns: "*" },
  { table: "offer_unlocks", columns: "offer_id,unlocked_on,origin,created_at", orderBy: "offer_id", note: "Les offres du catalogue que ton compte a débloquées, avec la date." },
  { table: "integrations", columns: "provider,updated_at", orderBy: "provider", note: "Les clés elles-mêmes restent chiffrées et ne sont jamais exportées." },
];

/** Exact sentence the user types to delete the account. */
export const DELETE_CONFIRMATION = "SUPPRIMER";

/** Same-site check for state-changing requests made with the session cookie. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
