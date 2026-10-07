"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Does this account have a saved profile? `undefined` while unknown: a failed
 * check never blocks anything, it only leaves the screens as they were.
 */
export function useProfileState(enabled: boolean, demo = false) {
  const [hasProfile, setHasProfile] = useState<boolean | undefined>(demo ? true : undefined);
  const refresh = useCallback(async () => {
    if (demo) return;
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) return;
      const body = (await response.json()) as { profile?: unknown };
      setHasProfile(Boolean(body.profile));
    } catch {
      // Unknown stays unknown.
    }
  }, [demo]);
  useEffect(() => {
    if (!enabled || demo) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, demo, refresh]);
  return { hasProfile, refresh };
}
