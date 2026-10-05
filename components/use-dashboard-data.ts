"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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
    // How close each offer is to the profile (embeddings); missing = not computed yet.
    const near = await supabase.rpc("my_job_similarity");
    const similarity = new Map(((near.data ?? []) as { job_id: string; similarity: number }[]).map((x) => [x.job_id, x.similarity]));
    if (jobs.data) for (const job of jobs.data as Job[]) job.similarity = similarity.get(job.id) ?? null;
    // How many LeBonTaf students applied to the same offer (only from 3, anonymous).
    const offerIds = [...new Set(((jobs.data ?? []) as Job[]).map((x) => x.offer_id).filter((x): x is string => Boolean(x)))];
    if (offerIds.length) {
      const crowd = await supabase.rpc("offer_applicants", { p_offer_ids: offerIds.slice(0, 2000) });
      const applicants = new Map(((crowd.data ?? []) as { offer_id: string; applicants: number }[]).map((x) => [x.offer_id, x.applicants]));
      for (const job of (jobs.data ?? []) as Job[]) job.applicants = job.offer_id ? (applicants.get(job.offer_id) ?? null) : null;
    }
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

  return { supabase, data, loading, error, reload: load, patchJob };
}
