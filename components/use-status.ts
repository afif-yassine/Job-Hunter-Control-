"use client";
import { useCallback, useEffect, useState } from "react";
import type { ProviderStatus } from "@/lib/integrations";
import type { PlanUsage } from "@/lib/plan";
import type { Usage } from "@/lib/quota";

export type SystemStatus = {
  applicationMode: string;
  safeMode: boolean;
  explicitModeVariable: boolean;
  gemini: boolean;
  aiConfigured?: boolean;
  aiProvider?: string;
  drive: boolean;
  worker: boolean;
  workerOnline: boolean;
  workerBrowserReady: boolean | null;
  providers: ProviderStatus[];
  integrationsSecret: boolean;
  scanConfigured: boolean;
  autoScan: boolean;
  lastScanAt: string | null;
  scheduledScan: boolean;
  /** Today's use of the daily limits (null before the migration). */
  usage?: Usage | null;
  /** Plan and application kits used this month (free plan: limited). */
  plan?: PlanUsage | null;
  /** The account administers the platform (sees the Admin page). */
  isAdmin?: boolean;
};

/** State of the connections (sources, Gemini, Drive, Playwright worker). */
export function useSystemStatus(enabled: boolean, demo?: SystemStatus) {
  const [status, setStatus] = useState<SystemStatus | null>(demo ?? null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    if (demo) return;
    try {
      const response = await fetch("/api/status");
      if (!response.ok) throw new Error(String(response.status));
      setStatus((await response.json()) as SystemStatus);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [demo]);
  useEffect(() => {
    if (!enabled || demo) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, demo, refresh]);
  return { status, failed, refresh };
}
