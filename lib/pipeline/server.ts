import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiCall } from "@/lib/ai";
import { QUOTA_CODE } from "@/lib/quota";
import { runScan } from "@/lib/scan";
import type { ScanSummary } from "@/lib/scan/types";
import { analyzeJob } from "./analyze";
import { stillOnline } from "./availability";
import { generateForJob } from "./generate";

/**
 * The scheduled run, on the server, for every account — no browser needed.
 * Called by a cron every 15-30 min. Each call does as much as fits in its time
 * budget and stops cleanly; the next call continues where it stopped, because
 * the queue *is* the offers' status (DISCOVERED → ANALYZED → WAITING_APPROVAL).
 *
 * It never submits an application and never opens a browser: preparing a form
 * stays a click in the dashboard.
 */

type Env = Record<string, string | undefined>;

export type TickOptions = {
  supabase: SupabaseClient;
  env?: Env;
  /** Milliseconds this call may use (Vercel stops functions at 60 s). */
  budgetMs?: number;
  now?: () => number;
  ai?: AiCall;
  fetchPage?: (url: string) => Promise<string | null>;
  scan?: (supabase: SupabaseClient, userId: string) => Promise<ScanSummary>;
};

export type UserTally = {
  scanned: boolean;
  inserted: number;
  toReview: number;
  analyzed: number;
  strong: number;
  generated: number;
  quotaReached: string[];
  errors: string[];
};

export type TickReport = {
  users: Record<string, UserTally>;
  stoppedBy: "done" | "time" | "ai";
};

const THREE_DAYS = 3 * 86_400_000;
const FATAL_AI = /GEMINI_API_KEY|API key|RESOURCE_EXHAUSTED|429|quota exceeded|Unauthorized|PERMISSION_DENIED/i;

export async function runServerTick(options: TickOptions): Promise<TickReport> {
  const { supabase } = options;
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const started = now();
  const budget = options.budgetMs ?? 45_000;
  const left = () => budget - (now() - started);
  const intervalMs = Math.max(1, Number(env.SCAN_INTERVAL_HOURS) || 12) * 3_600_000;
  const threshold = Math.min(100, Math.max(0, Number(env.AUTO_GENERATE_THRESHOLD) || 80));
  const report: TickReport = { users: {}, stoppedBy: "done" };
  const tally = (userId: string) =>
    (report.users[userId] ??= {
      scanned: false,
      inserted: 0,
      toReview: 0,
      analyzed: 0,
      strong: 0,
      generated: 0,
      quotaReached: [],
      errors: [],
    });
  const scan = options.scan ?? ((db: SupabaseClient, userId: string) => runScan({ supabase: db, userId, log: false }));

  // 1. Search for accounts whose last search is old (2 per call at most) ------
  const { data: settings } = await supabase
    .from("user_settings")
    .select("user_id,last_scan_at,auto_scan")
    .eq("auto_scan", true)
    .order("last_scan_at", { ascending: true, nullsFirst: true })
    .limit(20);
  const due = ((settings ?? []) as { user_id: string; last_scan_at: string | null }[])
    .filter((s) => !s.last_scan_at || now() - Date.parse(s.last_scan_at) >= intervalMs)
    .slice(0, 2);
  for (const s of due) {
    if (left() < 25_000) {
      report.stoppedBy = "time";
      break;
    }
    const t = tally(s.user_id);
    // Mark the attempt even when no source is connected, so one account
    // without sources never blocks the others' turn.
    await supabase
      .from("user_settings")
      .update({ last_scan_at: new Date(now()).toISOString() })
      .eq("user_id", s.user_id);
    try {
      const summary = await scan(supabase, s.user_id);
      t.scanned = true;
      t.inserted += summary.inserted;
      t.toReview += summary.toReview + summary.suspected;
      for (const r of summary.reports) if (r.status === "error") t.errors.push(`${r.source} : ${r.message}`);
    } catch (error) {
      t.errors.push(`Recherche : ${error instanceof Error ? error.message : "erreur"}`);
    }
  }

  // 2. Score waiting offers, oldest first ---------------------------------------
  const blocked = new Set<string>();
  let aiDown = false;
  if (report.stoppedBy === "done") {
    const { data: waiting } = await supabase
      .from("jobs")
      .select("id,user_id,description,official_url,source_url,last_checked_at")
      .eq("status", "DISCOVERED")
      .is("review_flag", null)
      .is("gone_reason", null)
      .order("created_at", { ascending: true })
      .limit(40);
    const readable = ((waiting ?? []) as {
      id: string;
      user_id: string;
      description: string | null;
      official_url: string | null;
      source_url: string | null;
      last_checked_at: string | null;
    }[]).filter((j) => {
      if (!j.description && !(j.official_url || j.source_url)) return false;
      // Unreadable ads wait for the user to paste the text.
      const tried = j.last_checked_at ? now() - Date.parse(j.last_checked_at) < THREE_DAYS : false;
      return !(tried && !j.description);
    });
    for (const job of readable) {
      if (left() < 12_000) {
        report.stoppedBy = "time";
        break;
      }
      if (blocked.has(job.user_id)) continue;
      const t = tally(job.user_id);
      const result = await analyzeJob({
        supabase,
        userId: job.user_id,
        jobId: job.id,
        env,
        ai: options.ai,
        fetchPage: options.fetchPage,
      });
      const error = String(result.body.error ?? "");
      if (result.status === 200 && result.body.suspected) t.toReview += 1;
      else if (result.status === 200) {
        t.analyzed += 1;
        if (Number(result.body.total) >= threshold) t.strong += 1;
      } else if (result.body.code === QUOTA_CODE) {
        blocked.add(job.user_id);
        t.quotaReached.push("analysis");
      } else if (FATAL_AI.test(error)) {
        aiDown = true;
        t.errors.push(error);
        break;
      } else if (result.status !== 400 && result.status !== 409) t.errors.push(error);
    }
  }

  // 3. Write the documents of the strong offers ---------------------------------
  if (report.stoppedBy === "done" && !aiDown) {
    const { data: strong } = await supabase
      .from("jobs")
      .select("id,user_id")
      .eq("status", "ANALYZED")
      .is("review_flag", null)
      .gte("match_score", threshold)
      .order("match_score", { ascending: false })
      .limit(10);
    const generationBlocked = new Set<string>();
    for (const job of (strong ?? []) as { id: string; user_id: string }[]) {
      if (left() < 15_000) {
        report.stoppedBy = "time";
        break;
      }
      if (generationBlocked.has(job.user_id)) continue;
      const t = tally(job.user_id);
      const result = await generateForJob({
        supabase,
        userId: job.user_id,
        jobId: job.id,
        env,
        ai: options.ai,
        // Real runs check the offer is still online; injected test runs do not.
        checkOnline: options.ai ? undefined : (j) => stillOnline(j, env),
        service: supabase,
      });
      const error = String(result.body.error ?? "");
      if (result.status === 200) t.generated += 1;
      else if (result.body.code === QUOTA_CODE) {
        generationBlocked.add(job.user_id);
        t.quotaReached.push("generation");
      } else if (FATAL_AI.test(error)) {
        aiDown = true;
        t.errors.push(error);
        break;
      } else t.errors.push(error);
    }
  }
  if (aiDown) report.stoppedBy = "ai";

  // 4. One journal line + one notification per account that got something -----
  const finished = new Date(now()).toISOString();
  for (const [userId, t] of Object.entries(report.users)) {
    const worked = t.scanned || t.analyzed || t.generated || t.toReview;
    if (!worked && !t.errors.length) continue;
    await supabase.from("agent_runs").insert({
      user_id: userId,
      run_type: "PIPELINE",
      status: t.errors.length && !worked ? "FAILED" : "COMPLETED",
      started_at: new Date(started).toISOString(),
      finished_at: finished,
      counters: {
        trigger: "server",
        inserted: t.inserted,
        analyzed: t.analyzed,
        strong: t.strong,
        generated: t.generated,
        toReview: t.toReview,
        quotaReached: t.quotaReached,
        issues: t.errors.length,
      },
      error_message: t.errors.slice(0, 3).join(" | ") || null,
    });
    if (t.inserted || t.generated || t.toReview)
      await supabase.from("notifications").insert({
        user_id: userId,
        notification_type: "PIPELINE_DONE",
        title: "Recherche automatique",
        message: `${t.inserted} nouvelle(s) offre(s), ${t.strong} très bonne(s) (≥ ${threshold}), ${t.generated} dossier(s) prêt(s)${t.toReview ? `, ${t.toReview} à vérifier` : ""}.`,
        action_url: null,
        delivery_channels: ["dashboard"],
      });
  }
  return report;
}
