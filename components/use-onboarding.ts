"use client";
import { useEffect, useState } from "react";
import { hasChosenJob } from "@/components/search-fields";
import { parseOnboardingStatus, type ServerOnboarding } from "@/components/onboarding";

const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    return { status: response.status, body: await response.json().catch(() => null) };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * What the guided sign-up needs to know, read once: the server's own verdict (GET /api/onboarding/status) when the
 * route exists, and otherwise the search preferences (GET /api/settings) to deduce it. Never blocks: a failure
 * only sets a "failed" flag so the gate lets the student in.
 */
export function useOnboardingFacts(enabled: boolean) {
  /** undefined: loading. null: the route is absent or unreadable. */
  const [server, setServer] = useState<ServerOnboarding | null | undefined>(undefined);
  const [searchChosen, setSearchChosen] = useState<boolean | undefined>(undefined);
  const [searchFailed, setSearchFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      let answer: ServerOnboarding | null = null;
      try {
        const r = await getJson("/api/onboarding/status");
        answer = r.status === 200 ? parseOnboardingStatus(r.body) : null;
      } catch {
        answer = null;
      }
      if (cancelled) return;
      setServer(answer);
      if (answer) return;
      try {
        const r = await getJson("/api/settings");
        const prefs = (r.body as { prefs?: { categories?: string[]; keywords?: string[] } } | null)?.prefs;
        if (r.status !== 200 || !prefs) throw new Error("unreadable");
        if (!cancelled) setSearchChosen(hasChosenJob({ categories: prefs.categories ?? [], keywords: prefs.keywords ?? [] }));
      } catch {
        if (!cancelled) setSearchFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { server, searchChosen, searchFailed };
}
