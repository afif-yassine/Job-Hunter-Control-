"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RETRY_DELAY_MS, retryDecision } from "@/components/load-retry";
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

  const load = useCallback(async () => {
    if (demo) return;
    if (!supabase) {
      setError("Variables Supabase absentes.");
      setLoading(false);
      return;
    }
    const fetchOnce = async () => {
    const [j, a, q, d, r, n] = await Promise.all([
      supabase.from("jobs").select("*,job_sources(platform,url),offers(summary,salary)").order("created_at", { ascending: false }),
      supabase.from("applications").select("*,jobs(company,title)").order("created_at", { ascending: false }),
      supabase
        .from("application_questions")
        .select("*,applications(jobs(company,title))")
        .order("created_at", { ascending: false }),
      supabase.from("documents").select("*,jobs(company,title)").order("created_at", { ascending: false }),
      supabase.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    let jobs = j;
    if (j.error) {
      // Older databases: without the salary, without the catalogue, then without job_sources.
      jobs = await supabase.from("jobs").select("*,job_sources(platform,url),offers(summary)").order("created_at", { ascending: false });
      if (jobs.error) jobs = await supabase.from("jobs").select("*,job_sources(platform,url)").order("created_at", { ascending: false });
      if (jobs.error) jobs = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    }
    let questions = q.data as Question[] | null;
    if (q.error) {
      // The join is only a nicety: fall back to the plain table if it fails.
      const plain = await supabase
        .from("application_questions")
        .select("*")
        .order("created_at", { ascending: false });
      questions = plain.data as Question[] | null;
    }
    // The free score of every offer: closeness to the CV (vectors) and skills
    // in common, compared in the database without any AI call.
    type FitRow = { job_id: string; similarity: number | null; matched?: string[] | null; missing?: string[] | null; model?: string };
    let near = await supabase.rpc("my_job_fit_v2");
    if (near.error || !near.data?.length) near = await supabase.rpc("my_job_fit");
    if (near.error) near = await supabase.rpc("my_job_similarity");
    const fits = new Map(((near.data ?? []) as FitRow[]).map((x) => [x.job_id, x]));
    if (jobs.data)
      for (const job of jobs.data as Job[]) {
        const f = fits.get(job.id);
        job.similarity = f?.similarity ?? null;
        job.fit = f ? fitScore(f.similarity, f.matched ?? [], f.missing ?? [], f.model) : null;
      }
    // How many LeBonTaf students applied to the same offer (only from 3, anonymous).
    const offerIds = [...new Set(((jobs.data ?? []) as Job[]).map((x) => x.offer_id).filter((x): x is string => Boolean(x)))];
    if (offerIds.length) {
      const crowd = await supabase.rpc("offer_applicants", { p_offer_ids: offerIds.slice(0, 2000) });
      const applicants = new Map(((crowd.data ?? []) as { offer_id: string; applicants: number }[]).map((x) => [x.offer_id, x.applicants]));
      for (const job of (jobs.data ?? []) as Job[]) job.applicants = job.offer_id ? (applicants.get(job.offer_id) ?? null) : null;
    }
    return { jobs, a, d, r, n, questions };
    };
    const failureOf = (x: { jobs: { error: { message?: string; code?: string } | null }; a: { error: { message?: string; code?: string } | null }; d: { error: { message?: string; code?: string } | null }; r: { error: { message?: string; code?: string } | null }; n: { error: { message?: string; code?: string } | null } }) => [x.jobs, x.a, x.d, x.r, x.n].find((y) => y.error)?.error;
    let got = await fetchOnce();
    // A token dated slightly in the future: wait and ask again (twice at most) before showing anything.
    for (let attempt = 0; retryDecision(failureOf(got), attempt).retry; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
      got = await fetchOnce();
    }
    const { jobs, a, d, r, n, questions } = got;
    const failure = [jobs, a, d, r, n].find((x) => x.error)?.error;
    setError(failure ? failure.message : "");
    setData({
      jobs: (jobs.data || []) as Job[],
      apps: (a.data || []) as Application[],
      questions: questions || [],
      documents: (d.data || []) as DocumentRecord[],
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

  return { supabase, data, loading, error, reload, patchJob };
}
