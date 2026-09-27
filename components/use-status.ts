"use client";
import { useCallback, useEffect, useState } from "react";
import type { ProviderStatus } from "@/lib/integrations";
import type { Usage } from "@/lib/quota";

export type SystemStatus = {
  applicationMode: string;
  safeMode: boolean;
  explicitModeVariable: boolean;
  gemini: boolean;
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
