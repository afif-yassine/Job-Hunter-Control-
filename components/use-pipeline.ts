"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runPipeline,
  type PipelineProgress,
  type PipelineReport,
} from "@/lib/pipeline-client";
import type { SystemStatus } from "@/components/use-status";

const INTERVAL = 12 * 3_600_000;
const GUARD = "jh-auto-scan";

/**
 * Owns the "Lancer la recherche" run so it keeps going while the user moves
 * between tabs, and starts by itself (at most every 12 h) when the dashboard opens.
 */
export function usePipeline({
  supabase,
  status,
  reload,
  refreshStatus,
}: {
  supabase: SupabaseClient | null;
  status: SystemStatus | null;
  reload: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [report, setReport] = useState<PipelineReport | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);

  const start = useCallback(
    async (options: { scan?: boolean } = {}) => {
      if (!supabase || busy.current) return;
      busy.current = true;
      const abort = new AbortController();
      controller.current = abort;
      setRunning(true);
      setReport(null);
      setProgress({ phase: "scan", done: 0, total: 1, label: "Démarrage…" });
      try {
        const result = await runPipeline({
          supabase,
          scan: options.scan !== false,
          prepare: true,
          signal: abort.signal,
          onProgress: setProgress,
        });
        setReport(result);
      } finally {
        busy.current = false;
        controller.current = null;
        setRunning(false);
        setProgress(null);
        await Promise.all([reload(), refreshStatus()]);
      }
    },
    [supabase, reload, refreshStatus],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);

  // Automatic search when the dashboard opens and the last one is old.
  useEffect(() => {
    // When the server searches on its own schedule, opening the dashboard
    // does not spend one of the day's manual searches.
    if (!status || !status.autoScan || !status.scanConfigured || status.scheduledScan) return;
    const last = status.lastScanAt ? Date.parse(status.lastScanAt) : 0;
    if (Date.now() - last < INTERVAL) return;
    try {
      if (window.sessionStorage.getItem(GUARD)) return;
    } catch {
      // storage unavailable: run once per mount instead
    }
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(GUARD, String(Date.now()));
      } catch {
        // ignore
      }
      void start({ scan: true });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [status, start]);

  return { running, progress, report, start, cancel, dismiss: () => setReport(null) };
}
