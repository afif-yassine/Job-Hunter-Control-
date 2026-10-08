"use client";
import { useCallback, useEffect, useState } from "react";

export type AccountInfo = { email: string; providers: string[]; createdAt: string; lastSignInAt: string | null };

/**
 * The address to show everywhere: the one the server reads now (/api/account asks the auth service),
 * else the one of the sign-in token, which can be stale after an address change.
 */
export function shownEmail(info: Pick<AccountInfo, "email"> | null | undefined, tokenEmail: string): string {
  return info?.email?.trim() || tokenEmail;
}

/** The signed-in account, read once for the whole dashboard (the menu and "Ton compte" show the same address). */
export function useAccount(enabled: boolean, demo = false) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const refresh = useCallback(async () => {
    if (demo) return;
    try {
      const response = await fetch("/api/account");
      if (!response.ok) return;
      setAccount((await response.json()) as AccountInfo);
    } catch {
      // The address of the token stays.
    }
  }, [demo]);
  useEffect(() => {
    if (!enabled || demo) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, demo, refresh]);
  return { account, refresh };
}
