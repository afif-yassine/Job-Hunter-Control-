import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanRaw, explainError } from "@/lib/errors";

/**
 * The whole "find → score → write → prepare" chain, driven from the browser.
 * Every step is a short server call (Vercel limits each request to ~60 s), and
 * the browser stitches them together and reports progress.
 *
 * Safety: the last step only *inspects* the application form (PREPARE_ONLY).
 * Nothing is ever submitted.
 */

export type PipelinePhase = "scan" | "analyze" | "generate" | "prepare";

export type PipelineProgress = {
  phase: PipelinePhase;
  done: number;
  total: number;
  label: string;
};

export type PipelineIssue = {
  /** "Airbus · Développeur IA" or "Recherche". */
  where: string;
  title: string;
  hint: string | null;
  /** Technical text, shown only in "détails". */
  raw: string;
};

export type PipelineReport = {
  startedAt: string;
  finishedAt: string;
  cancelled: boolean;
  /** No job source is connected yet. */
  noSource: boolean;
  scanned: boolean;
  found: number;
  inserted: number;
  duplicates: number;
  /** Seen again elsewhere, already applied: never proposed again. */
  alreadyApplied: number;
  /** Offers put in "À vérifier" (possible scam, probable duplicate…). */
  toReview: number;
  needsDescription: number;
  analyzed: number;
  strong: number;
  generated: number;
  prepared: number;
  questions: number;
  issues: PipelineIssue[];
};

export type PipelineOptions = {
  supabase: SupabaseClient;
  /** Look for new offers first. */
  scan: boolean;
  /** Inspect the forms of the strong offers with the Playwright worker. */
  prepare: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: PipelineProgress) => void;
  /** Offers analysed per run (keeps the free Gemini quota safe). */
  maxAnalyze?: number;
  /** Forms inspected per run. */
  maxPrepare?: number;
  /** Minimum score (0-100) that triggers CV + letter generation. */
  threshold?: number;
};

type Call = { ok: boolean; status: number; body: Record<string, unknown> };

async function call(url: string, signal?: AbortSignal, body: unknown = {}): Promise<Call> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const parsed = (await response.json().catch(() => ({
      error: `Réponse vide du serveur (HTTP ${response.status})`,
    }))) as Record<string, unknown>;
    return { ok: response.ok, status: response.status, body: parsed };
  } catch (error) {
    if (signal?.aborted) throw error;
    return {
      ok: false,
      status: 0,
      body: { error: `Connexion impossible : ${error instanceof Error ? error.message : "réseau"}` },
    };
  }
}

/** Errors after which trying the next offer would be pointless. */
const FATAL_ANALYSIS = /quota|429|RESOURCE_EXHAUSTED|GEMINI_API_KEY|API key|Unauthorized|Connexion impossible|Limite du jour/i;
const FATAL_WORKER = /Worker Playwright|injoignable|Executable doesn't exist|Please update docker image|browserType\.launch|Connexion impossible|Unauthorized/i;

const THREE_DAYS = 3 * 86_400_000;

function issue(where: string, raw: unknown): PipelineIssue {
  const text = cleanRaw(String(raw || "Erreur inconnue"));
  const explained = explainError(text);
  return { where, title: explained?.title ?? text, hint: explained?.hint ?? null, raw: text };
}

export function emptyReport(): PipelineReport {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    finishedAt: now,
    cancelled: false,
    noSource: false,
    scanned: false,
    found: 0,
    inserted: 0,
    duplicates: 0,
    alreadyApplied: 0,
    toReview: 0,
    needsDescription: 0,
    analyzed: 0,
    strong: 0,
    generated: 0,
    prepared: 0,
    questions: 0,
    issues: [],
  };
}

type PendingJob = {
  id: string;
  company: string;
  title: string;
  description: string | null;
  official_url: string | null;
  source_url: string | null;
  last_checked_at: string | null;
};

/** Runs `worker` over `items` with at most `size` calls in flight. */
async function pool<T>(items: T[], size: number, signal: AbortSignal | undefined, worker: (item: T) => Promise<void>) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length && !signal?.aborted) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineReport> {
  const { supabase, signal } = options;
  const maxAnalyze = options.maxAnalyze ?? 15;
  const maxPrepare = options.maxPrepare ?? 4;
  const threshold = options.threshold ?? 80;
  const report = emptyReport();
  const progress = (phase: PipelinePhase, done: number, total: number, label: string) =>
    options.onProgress?.({ phase, done, total, label });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  try {
    // 1. Look for new offers ---------------------------------------------
    if (options.scan) {
      progress("scan", 0, 1, "Recherche des offres sur internet…");
      const scan = await call("/api/scan", signal, { log: false });
      if (scan.ok) {
        report.scanned = true;
        report.found = Number(scan.body.found) || 0;
        report.inserted = Number(scan.body.inserted) || 0;
        report.duplicates = Number(scan.body.duplicates) || 0;
        report.alreadyApplied = Number(scan.body.alreadyApplied) || 0;
        report.toReview = (Number(scan.body.toReview) || 0) + (Number(scan.body.suspected) || 0);
        report.needsDescription = Number(scan.body.needsDescription) || 0;
        const reports = (scan.body.reports as { source: string; status: string; message?: string }[]) || [];
        for (const r of reports)
          if (r.status === "error") report.issues.push(issue(r.source, r.message));
      } else if (scan.status === 503 && scan.body.configured === false) {
        report.noSource = true;
      } else {
        report.issues.push(issue("Recherche", scan.body.error));
      }
      progress("scan", 1, 1, "Recherche terminée");
    }

    // 2. Score the offers that were never analysed --------------------------
    // Offers in "À vérifier" wait for the user: nothing is spent on them.
    const select = "id,company,title,description,official_url,source_url,last_checked_at";
    const first = await supabase
      .from("jobs")
      .select(select)
      .eq("status", "DISCOVERED")
      .is("review_flag", null)
      .is("gone_reason", null)
      .order("created_at", { ascending: false })
      .limit(60);
    let rows = first.data;
    if (first.error)
      ({ data: rows } = await supabase
        .from("jobs")
        .select(select)
        .eq("status", "DISCOVERED")
        .order("created_at", { ascending: false })
        .limit(60));
    const now = Date.now();
    const candidates = ((rows || []) as PendingJob[]).filter((job) => {
      // Offers we could not read recently wait for the user to paste the text.
      const tried = job.last_checked_at ? now - Date.parse(job.last_checked_at) < THREE_DAYS : false;
      return !(tried && !job.description);
    });
    const pending = candidates.slice(0, maxAnalyze);
    const skippedForNow = ((rows || []) as PendingJob[]).filter((j) => !j.description).length - pending.filter((j) => !j.description).length;
    if (skippedForNow > 0) report.needsDescription = Math.max(report.needsDescription, skippedForNow);

    const strong: { id: string; company: string; title: string; score: number }[] = [];
    let analysisStopped = false;
    let done = 0;
    if (pending.length) progress("analyze", 0, pending.length, `Analyse des offres (0/${pending.length})`);
    await pool(pending, 2, signal, async (job) => {
      if (analysisStopped) return;
      const analysis = await call(`/api/jobs/${job.id}/analyze`, signal);
      done += 1;
      if (analysis.ok && analysis.body.suspected) {
        report.toReview += 1;
      } else if (analysis.ok) {
        report.analyzed += 1;
        const total = Number(analysis.body.total) || 0;
        if (total >= threshold) strong.push({ id: job.id, company: job.company, title: job.title, score: total });
      } else {
        const raw = String(analysis.body.error || "Analyse impossible");
        if (/Impossible de lire l’annonce/.test(raw)) report.needsDescription += 1;
        else if (analysis.body.code === "TO_REVIEW") report.toReview += 1;
        else {
          report.issues.push(issue(`${job.company} · ${job.title}`, raw));
          if (FATAL_ANALYSIS.test(raw)) analysisStopped = true;
        }
      }
      progress("analyze", done, pending.length, `Analyse des offres (${done}/${pending.length}) · ${job.company}`);
    });
    report.strong = strong.length;

    // 3. Write the CV + letter of the strong offers -------------------------
    const prepared: { applicationId: string; company: string; title: string }[] = [];
    let generationStopped = false;
    let written = 0;
    if (strong.length) progress("generate", 0, strong.length, `Rédaction des documents (0/${strong.length})`);
    await pool(strong, 2, signal, async (job) => {
      if (generationStopped) return;
      const generation = await call(`/api/jobs/${job.id}/generate`, signal);
      written += 1;
      if (generation.ok) {
        report.generated += 1;
        const stats = (generation.body.questionStats as { asked?: number; autoAnswered?: number }) || {};
        report.questions += stats.asked ?? 0;
        if (typeof generation.body.applicationId === "string")
          prepared.push({ applicationId: generation.body.applicationId, company: job.company, title: job.title });
        if (userId) {
          const docs = (generation.body.documents as unknown[] | undefined)?.length ?? 0;
          await supabase.from("notifications").insert({
            user_id: userId,
            notification_type: "DOCUMENTS_READY",
            title: `${job.company} · documents prêts (${job.score}/100)`,
            message: `${docs} document(s) rédigé(s)${stats.asked ? `, ${stats.asked} question(s) à valider` : ""}${stats.autoAnswered ? `, ${stats.autoAnswered} réponse(s) reprise(s) de ta mémoire` : ""}.`,
            action_url: null,
            delivery_channels: ["dashboard"],
          });
        }
      } else {
        const raw = String(generation.body.error || "Génération impossible");
        report.issues.push(issue(`${job.company} · ${job.title}`, raw));
        if (FATAL_ANALYSIS.test(raw)) generationStopped = true;
      }
      progress("generate", written, strong.length, `Rédaction des documents (${written}/${strong.length}) · ${job.company}`);
    });

    // 4. Inspect the application forms (never submits) ----------------------
    if (options.prepare && prepared.length) {
      const batch = prepared.slice(0, maxPrepare);
      progress("prepare", 0, batch.length, `Préparation des formulaires (0/${batch.length})`);
      for (let i = 0; i < batch.length; i += 1) {
        if (signal?.aborted) break;
        const item = batch[i];
        progress("prepare", i, batch.length, `Préparation du formulaire · ${item.company}`);
        const result = await call("/api/worker/dispatch", signal, {
          applicationId: item.applicationId,
          action: "prepare",
        });
        if (result.ok) {
          report.prepared += 1;
        } else {
          const raw = String(result.body.error || "Préparation impossible");
          report.issues.push(issue(`${item.company} · ${item.title}`, raw));
          // A dead worker will not come back within this run.
          if (FATAL_WORKER.test(raw)) break;
        }
        progress("prepare", i + 1, batch.length, `Préparation des formulaires (${i + 1}/${batch.length})`);
      }
    }
  } catch (error) {
    if (!signal?.aborted) report.issues.push(issue("Pipeline", error instanceof Error ? error.message : error));
  }

  report.cancelled = Boolean(signal?.aborted);
  report.finishedAt = new Date().toISOString();

  // 5. Journal + notification ---------------------------------------------
  if (userId) {
    const failed =
      report.issues.length > 0 && report.inserted + report.analyzed + report.generated + report.prepared === 0;
    await supabase.from("agent_runs").insert({
      user_id: userId,
      run_type: "PIPELINE",
      status: report.cancelled ? "CANCELLED" : failed ? "FAILED" : "COMPLETED",
      started_at: report.startedAt,
      finished_at: report.finishedAt,
      counters: {
        found: report.found,
        inserted: report.inserted,
        analyzed: report.analyzed,
        strong: report.strong,
        generated: report.generated,
        prepared: report.prepared,
        needsDescription: report.needsDescription,
        toReview: report.toReview,
        alreadyApplied: report.alreadyApplied,
        issues: report.issues.length,
        noSource: report.noSource,
      },
      error_message: failed ? report.issues[0]?.raw || null : null,
    });
    if (!report.cancelled && (report.inserted > 0 || report.generated > 0))
      await supabase.from("notifications").insert({
        user_id: userId,
        notification_type: "PIPELINE_DONE",
        title: "Recherche terminée",
        message: `${report.inserted} nouvelle(s) offre(s), ${report.strong} très bonne(s) (≥ ${threshold}), ${report.generated} dossier(s) prêt(s)${report.prepared ? `, ${report.prepared} formulaire(s) préparé(s)` : ""}${report.toReview ? `, ${report.toReview} à vérifier` : ""}.`,
        action_url: null,
        delivery_channels: ["dashboard"],
      });
  }
  return report;
}

/** One friendly sentence describing what a run did. */
export function summarize(report: PipelineReport): string {
  if (report.noSource && !report.analyzed && !report.generated)
    return "Aucune source d’offres n’est connectée : ajoute une clé dans Réglages > Sources.";
  const parts: string[] = [];
  if (report.scanned) parts.push(`${report.inserted} nouvelle${report.inserted > 1 ? "s" : ""} offre${report.inserted > 1 ? "s" : ""}`);
  if (report.analyzed) parts.push(`${report.analyzed} analysée${report.analyzed > 1 ? "s" : ""}`);
  if (report.strong) parts.push(`${report.strong} très bonne${report.strong > 1 ? "s" : ""}`);
  if (report.generated) parts.push(`${report.generated} dossier${report.generated > 1 ? "s" : ""} prêt${report.generated > 1 ? "s" : ""}`);
  if (report.prepared) parts.push(`${report.prepared} formulaire${report.prepared > 1 ? "s" : ""} préparé${report.prepared > 1 ? "s" : ""}`);
  if (report.toReview) parts.push(`${report.toReview} à vérifier`);
  if (!parts.length) return report.issues.length ? "Rien n’a pu être traité." : "Rien de nouveau pour le moment.";
  return parts.join(" · ");
}
