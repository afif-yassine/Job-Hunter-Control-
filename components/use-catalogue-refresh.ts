"use client";
import { useEffect, useRef, useState } from "react";
import { interpretRefresh, refreshDecision, REFRESH_GUARD_KEY } from "@/components/catalogue-refresh";

/**
 * Opens the student's list from the shared catalogue once per browser session
 * (the route copies what the catalogue already holds; no job site, no AI).
 * Silent when it fails: the dashboard works the same without it.
 */
export function useCatalogueRefresh({ enabled, reload }: { enabled: boolean; reload: () => Promise<void> }) {
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(REFRESH_GUARD_KEY);
    } catch {
      // storage unavailable: one call per mount instead
    }
    const decision = refreshDecision({ enabled, started: started.current, stored });
    if (decision === "reuse") {
      const timer = window.setTimeout(() => setRefreshedAt(stored), 0);
      return () => window.clearTimeout(timer);
    }
    if (decision !== "call") return;
    // `started` is set when the timer fires, not before: a cleanup (strict mode) must not cancel the only call.
    const timer = window.setTimeout(async () => {
      started.current = true;
      try {
        const response = await fetch("/api/catalogue/refresh", { method: "POST" });
        const body: unknown = await response.json().catch(() => null);
        const result = interpretRefresh(response.ok, body);
        if (result.checked) {
          const now = new Date().toISOString();
          try {
            window.sessionStorage.setItem(REFRESH_GUARD_KEY, now);
          } catch {
            // ignore
          }
          setRefreshedAt(now);
        }
        if (result.reload) await reload();
      } catch {
        // silent: the list is simply not refreshed this time
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [enabled, reload]);

  return { refreshedAt };
}
