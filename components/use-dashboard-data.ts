"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RETRY_DELAY_MS, retryDecision } from "@/components/load-retry";
import { cappedText, readPages } from "@/components/paging";
import { fitScore } from "@/lib/fit";
import { createClient } from "@/lib/supabase/client";
import type {
  AgentRun,
  Application,
  DocumentRecord,
  Job,
  NotificationRecord,
  Question,
} from "@/lib/types";

export type Data = {
  jobs: Job[];
  apps: Application[];
  questions: Question[];
  documents: DocumentRecord[];
  notifications: NotificationRecord[];
  runs: AgentRun[];
};

const EMPTY: Data = { jobs: [], apps: [], questions: [], documents: [], notifications: [], runs: [] };

/** Loads every table the dashboard shows and keeps it fresh (realtime + manual reload). */
export function useDashboardData(demo?: Data) {
  const supabase = useMemo(() => (demo ? null : createClient()), [demo]);
  const [data, setData] = useState<Data>(demo ?? EMPTY);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  /** The ceiling was reached: how many of the most recent rows are kept (null: nothing was cut). */
  const [cut, setCut] = useState<{ jobs: number | null; apps: number | null }>({ jobs: null, apps: null });

  const load = useCallback(async () => {
    if (demo) return;
    if (!supabase) {
      setError("Variables Supabase absentes.");
      setLoading(false);
      return;
    }
    type Err = { message?: string; code?: string } | null;
    const byNewest = <B extends { order: (c: string, o: { ascending: boolean }) => B }>(q: B) => q.order("created_at", { ascending: false }).order("id", { ascending: false });
    // One table, page by page, in a stable order (date, then id): the API cuts every answer at 1 000 rows.
    const pagesOf = <T,>(table: string, select: string, onPartial?: (rows: T[]) => void) =>
      readPages<T>(
        async (from, to) => {
          const r = await byNewest(supabase.from(table).select(select)).range(from, to);
          return { data: r.data as unknown as T[] | null, error: r.error };
        },
        { onPartial },
      );
    // Older databases: without the salary, without the catalogue, then without job_sources. The first page decides.
    const jobSelects = ["*,job_sources(platform,url),offers(summary,salary)", "*,job_sources(platform,url),offers(summary)", "*,job_sources(platform,url)", "*"];
    const readJobs = async (onPartial: (rows: Job[]) => void) => {
      let out = await pagesOf<Job>("jobs", jobSelects[0], onPartial);
      for (let i = 1; out.error && out.rows.length === 0 && i < jobSelects.length; i += 1) out = await pagesOf<Job>("jobs", jobSelects[i], onPartial);
      return out;
    };
    const readQuestions = async () => {
      // The join is only a nicety: fall back to the plain table if it fails.
      const joined = await pagesOf<Question>("application_questions", "*,applications(jobs(company,title))");
      return joined.error ? pagesOf<Question>("application_questions", "*") : joined;
    };
    type FitRow = { job_id: string; similarity: number | null; matched?: string[] | null; missing?: string[] | null; model?: string };
    const readFits = (name: string) =>
      readPages<FitRow>(async (from, to) => {
        const r = await supabase.rpc(name).range(from, to);
        return { data: r.data as FitRow[] | null, error: r.error };
      });
    const fetchOnce = async (onPartial: (rows: Job[]) => void) => {
      const [jobs, a, q, d, r, n] = await Promise.all([
        readJobs(onPartial),
        pagesOf<Application>("applications", "*,jobs(company,title)"),
        readQuestions(),
        pagesOf<DocumentRecord>("documents", "*,jobs(company,title)"),
        supabase.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      // The free score of every offer: closeness to the CV (vectors) and skills
      // in common, compared in the database without any AI call.
      let near = await readFits("my_job_fit_v2");
      if (near.error || !near.rows.length) near = await readFits("my_job_fit");
      if (near.error) near = await readFits("my_job_similarity");
      const fits = new Map(near.rows.map((x) => [x.job_id, x]));
      for (const job of jobs.rows) {
        const f = fits.get(job.id);
        job.similarity = f?.similarity ?? null;
        job.fit = f ? fitScore(f.similarity, f.matched ?? [], f.missing ?? [], f.model) : null;
      }
      // How many LeBonTaf students applied to the same offer (only from 3, anonymous).
      const offerIds = [...new Set(jobs.rows.map((x) => x.offer_id).filter((x): x is string => Boolean(x)))];
      if (offerIds.length) {
        const crowd = await supabase.rpc("offer_applicants", { p_offer_ids: offerIds.slice(0, 2000) });
        const applicants = new Map(((crowd.data ?? []) as { offer_id: string; applicants: number }[]).map((x) => [x.offer_id, x.applicants]));
        for (const job of jobs.rows) job.applicants = job.offer_id ? (applicants.get(job.offer_id) ?? null) : null;
      }
      return { jobs, a, q, d, r, n };
    };
    const failureOf = (x: Awaited<ReturnType<typeof fetchOnce>>): Err => [x.jobs, x.a, x.d, x.r, x.n].find((y) => y.error)?.error ?? null;
    // The first page of offers is shown at once; the rest follows (the realtime reload brings the stored truth).
    const showFirst = (rows: Job[]) => {
      setData((cur) => ({ ...cur, jobs: rows }));
      setLoading(false);
    };
    let got = await fetchOnce(showFirst);
    // A token dated slightly in the future: wait and ask again (twice at most) before showing anything.
    for (let attempt = 0; retryDecision(failureOf(got), attempt).retry; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
      got = await fetchOnce(showFirst);
    }
    const { jobs, a, q, d, r, n } = got;
    const failure = failureOf(got);
    setError(failure ? (failure.message ?? "") : "");
    setCut({ jobs: jobs.capped ? jobs.rows.length : null, apps: a.capped ? a.rows.length : null });
    setData({
      jobs: jobs.rows,
      apps: a.rows,
      questions: q.rows,
      documents: d.rows,
      runs: (r.data || []) as AgentRun[],
      notifications: (n.data || []) as NotificationRecord[],
    });
    setLoading(false);
  }, [supabase, demo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    if (!supabase) return () => window.clearTimeout(timer);
    // Reloading on every event of a busy pipeline would flood the database:
    // coalesce bursts into one reload.
    let pending: number | undefined;
    const soon = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => void load(), 600);
    };
    const channel = supabase
      .channel("job-hunter-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_runs" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, soon)
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  /** Optimistic change of one offer (the realtime reload brings the stored truth). */
  const patchJob = useCallback((id: string, patch: Partial<Job>) => {
    setData((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
  }, []);

  // A plain reload: never hands an event to `load` as its retry counter.
  const reload = useCallback(() => load(), [load]);

  const cutNotice = cut.jobs !== null ? cappedText(cut.jobs, "offres", true) : cut.apps !== null ? cappedText(cut.apps, "candidatures", true) : null;

  return { supabase, data, loading, error, reload, patchJob, cutNotice };
}
