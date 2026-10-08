"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseUnlocked, parisDay, type UnlockAnswer } from "@/components/unlock";

const TIMEOUT_MS = 8000;

/**
 * Reads GET /api/offers/unlocked: once when the dashboard opens, and again when the student comes back to the
 * tab on another Paris day (a new batch may be due). Never polls. Any failure, delay or unreadable answer is
 * "failed", which locks nothing (see components/unlock.ts).
 */
export function useUnlocked(enabled: boolean) {
  const [fetchState, setFetchState] = useState<"loading" | "failed" | "done">("loading");
  const [answer, setAnswer] = useState<UnlockAnswer | null>(null);
  const day = useRef("");

  const refresh = useCallback(async () => {
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

  useEffect(() => {
    if (!enabled) return;
    const first = window.setTimeout(() => void refresh(), 0);
    const back = () => {
      if (document.visibilityState === "visible" && day.current && day.current !== parisDay()) void refresh();
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", back);
    };
  }, [enabled, refresh]);

  return { fetchState, answer, refresh };
}
