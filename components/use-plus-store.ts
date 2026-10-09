"use client";
import { useCallback, useEffect, useState } from "react";
import { EMPTY_PLUS_STORE, parsePlusStore, type PlusStore } from "@/components/plus-offer";

const KEY = "lbt-plus";

function read(): PlusStore {
  try {
    return parsePlusStore(localStorage.getItem(KEY));
  } catch {
    return EMPTY_PLUS_STORE;
  }
}

/**
 * The browser's memory of what was proposed (frequencies only, never an account id). `ready` is false until it has
 * been read, so nothing shows before the rules can be applied. Storage that is unavailable breaks nothing: the
 * store then lives in memory for the page only.
 */
export function usePlusStore() {
  const [store, setStore] = useState<PlusStore>(EMPTY_PLUS_STORE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStore(read());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const update = useCallback((change: (s: PlusStore) => PlusStore) => {
    const next = change(read());
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // not remembered across pages
    }
    setStore(next);
  }, []);
  return { store, ready, update };
}
