"use client";
import { useCallback, useEffect, useState } from "react";
import type { ProfileSummary } from "@/lib/profile-store";

/**
 * The account's saved profile, read once for the whole dashboard. `summary` is
 * undefined while unknown (loading, or the read failed: see `failed`); null means
 * "no profile yet". A failed read never blocks anything, it only leaves the screens
 * as they were. In the demo nothing is read and a profile is assumed, as before.
 */
export function useProfileState(enabled: boolean, demo = false) {
  const [summary, setSummary] = useState<ProfileSummary | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async () => {
    if (demo) return;
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { profile?: ProfileSummary | null };
      setSummary(body.profile ?? null);
      setFailed(false);
    } catch {
      // Unknown stays unknown.
      setFailed(true);
    }
  }, [demo]);
  useEffect(() => {
    if (!enabled || demo) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, demo, refresh]);
  const hasProfile: boolean | undefined = demo ? true : summary === undefined ? undefined : summary !== null;
  return { hasProfile, summary, failed, refresh };
}
