"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseUnlocked, parisDay, type UnlockAnswer } from "@/components/unlock";

const TIMEOUT_MS = 12000;
/** While the server is still computing the day's batch (reason COMPUTING): ask again after these delays, then stop. */
const RETRY_DELAYS_MS = [5000, 10000, 20000];

/**
 * Reads GET /api/offers/unlocked: once when the dashboard opens, again when the student comes back to the tab on
 * another Paris day (a new batch may be due), and up to three times while the server answers COMPUTING. Any
 * failure, delay or unreadable answer is "failed", which locks nothing (see components/unlock.ts).
 * `refresh` is the student's own retry: it starts the automatic retries over.
 */
export function useUnlocked(enabled: boolean) {
  const [fetchState, setFetchState] = useState<"loading" | "failed" | "done">("loading");
  const [answer, setAnswer] = useState<UnlockAnswer | null>(null);
  const day = useRef("");
  const tries = useRef(0);

  const load = useCallback(async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch("/api/offers/unlocked", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const parsed = parseUnlocked(await response.json().catch(() => null));
      day.current = parisDay();
      setAnswer(parsed);
      setFetchState(parsed ? "done" : "failed");
    } catch {
      setAnswer(null);
      setFetchState("failed");
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  const refresh = useCallback(async () => {
    tries.current = 0;
    await load();
  }, [load]);

  useEffect(() => {
    if (!enabled) return;
    const first = window.setTimeout(() => void load(), 0);
    const back = () => {
      if (document.visibilityState === "visible" && day.current && day.current !== parisDay()) void refresh();
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", back);
    };
  }, [enabled, load, refresh]);

  // The batch is still being computed: ask again, 3 times at most.
  useEffect(() => {
    if (!enabled || answer?.reason !== "COMPUTING" || tries.current >= RETRY_DELAYS_MS.length) return;
    const timer = window.setTimeout(() => {
      tries.current += 1;
      void load();
    }, RETRY_DELAYS_MS[tries.current]);
    return () => window.clearTimeout(timer);
  }, [enabled, answer, load]);

  return { fetchState, answer, refresh };
}
