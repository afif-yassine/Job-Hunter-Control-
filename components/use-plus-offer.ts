"use client";
import { useCallback, useEffect, useState } from "react";
import { afterPlusShown, canShowPlus, parsePlusHistory, type PlusHistory, type PlusRules } from "@/components/plus-offer";

const LAST_KEY = "lbt-plus-last";
const SESSION_KEY = "lbt-plus-session";

/** Storage may be unavailable (private window, blocked site data): then nothing is remembered, and nothing breaks. */
function readHistory(): PlusHistory {
  let raw: string | null = null;
  let session = false;
  try {
    raw = localStorage.getItem(LAST_KEY);
    session = sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // unreadable: empty history
  }
  return { ...parsePlusHistory(raw), shownThisSession: session };
}

function remember(moment: string) {
  const next = afterPlusShown(readHistory(), moment, Date.now());
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(next.last));
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // not remembered
  }
}

/**
 * One proposal of LeBonTaf Plus at one moment. It is decided once, after the first render in the browser; showing
 * it counts at once (the gap starts and no other moment shows this session), and `close` hides it for good.
 * `active` is false while the moment itself is not on screen.
 */
export function usePlusOffer(moment: string, rules: PlusRules, pricing: boolean, active = true) {
  const [visible, setVisible] = useState(false);
  const { minGapMs } = rules;

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      if (!canShowPlus({ pricing, moment, rules: { minGapMs }, history: readHistory(), now: Date.now() })) return;
      remember(moment);
      setVisible(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, pricing, moment, minGapMs]);

  const close = useCallback(() => setVisible(false), []);
  return { visible: active && visible, close };
}
