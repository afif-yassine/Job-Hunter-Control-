"use client";
import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { shouldReload } from "@/components/session-guard";

/**
 * Reloads the page, once, when the browser's session is no longer the account the page was rendered for
 * (another account signed in from another window) or after a sign-out. Two triggers, one decision
 * (components/session-guard.ts): the auth events of the Supabase client, and the return to the tab, where the
 * session is read again from the cookies (no network call). Disabled without a known starting account (demo).
 */
export function useSessionGuard(startedAs: string | null | undefined, enabled = true) {
  const supabase = useMemo(() => (enabled && startedAs ? createClient() : null), [enabled, startedAs]);
  useEffect(() => {
    if (!supabase || !startedAs) return;
    // One reload only: it is dropped when the page is replaced, so nothing can loop.
    let reloading = false;
    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (shouldReload({ event, startedAs, nowUserId: session?.user?.id ?? null })) reloadOnce();
    });
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.auth
        .getSession()
        .then(({ data: current }) => {
          if (shouldReload({ event: "VISIBLE", startedAs, nowUserId: current.session?.user?.id ?? null })) reloadOnce();
        })
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, startedAs]);
}
