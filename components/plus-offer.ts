import { shiftDay } from "@/components/unlock";
import type { UnlockState } from "@/components/unlock";
import type { PlanUsage } from "@/lib/plan";

/**
 * When may LeBonTaf Plus be proposed? Pure decisions, no text. Common rules (commercial plan of 10 October):
 * nothing for a Plus account, the administrator, the demo, the guided sign-up, when the pricing page is off,
 * and in any case of doubt. Frequencies are kept in the browser (a small store) and read defensively.
 */

export type PlusMoment = "clic" | "fiche" | "cartes" | "fin" | "dernier" | "bandeau";

/** Who may see a proposal at all. Every doubt is "no". */
export function plusEligible(input: {
  pricing: boolean;
  demo: boolean;
  onboarding: boolean;
  isAdmin: boolean;
  plan: PlanUsage | null | undefined;
  unlock: UnlockState;
}): boolean {
  if (!input.pricing || input.demo || input.onboarding || input.isAdmin) return false;
  if (!input.plan || input.plan.plan !== "free") return false;
  const { unlock } = input;
  return unlock.kind === "locking" && !unlock.computing && !unlock.degraded;
}

/** The free kits of the month are all used (counter known). */
export function kitsUsedUp(plan: PlanUsage | null | undefined): boolean {
  return Boolean(plan && plan.plan === "free" && plan.limit !== null && plan.used >= plan.limit);
}

/** Exactly one free kit is left (counter known). */
export function lastKitLeft(plan: PlanUsage | null | undefined): boolean {
  return Boolean(plan && plan.plan === "free" && plan.limit !== null && plan.limit - plan.used === 1);
}

export type PlusStore = {
  /** Paris day on which the window (moment "clic") was last shown. */
  windowDay: string | null;
  /** Paris month ("2026-10") in which the "last kit" block (moment "dernier") was last shown. */
  kitMonth: string | null;
  banner: {
    /** Paris days on which the banner was closed (the last five). */
    closed: string[];
    /** Month until which the banner no longer comes back (closed three days in a row). */
    mutedMonth: string | null;
  };
};

export const EMPTY_PLUS_STORE: PlusStore = { windowDay: null, kitMonth: null, banner: { closed: [], mutedMonth: null } };

export const monthOf = (day: string) => day.slice(0, 7);

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);

/** A stored store, read defensively: anything unreadable is an empty store (so the rules start from nothing). */
export function parsePlusStore(raw: string | null): PlusStore {
  if (!raw) return EMPTY_PLUS_STORE;
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return EMPTY_PLUS_STORE;
    const banner = (v.banner && typeof v.banner === "object" ? v.banner : {}) as Record<string, unknown>;
    return {
      windowDay: isDay(v.windowDay) ? v.windowDay : null,
      kitMonth: isMonth(v.kitMonth) ? v.kitMonth : null,
      banner: {
        closed: Array.isArray(banner.closed) ? banner.closed.filter(isDay).slice(-5) : [],
        mutedMonth: isMonth(banner.mutedMonth) ? banner.mutedMonth : null,
      },
    };
  } catch {
    return EMPTY_PLUS_STORE;
  }
}

/** Moment "clic": the one window, at most once a day. */
export const canShowWindow = (store: PlusStore, today: string) => store.windowDay !== today;
export const afterWindowShown = (store: PlusStore, today: string): PlusStore => ({ ...store, windowDay: today });

/** Moment "dernier": once a month. */
export const canShowLastKit = (store: PlusStore, today: string) => store.kitMonth !== monthOf(today);
export const afterLastKitShown = (store: PlusStore, today: string): PlusStore => ({ ...store, kitMonth: monthOf(today) });

/** Moment "bandeau": once a day (closing hides it until the next day); closed three days in a row, not again this month. */
export function canShowBanner(store: PlusStore, today: string): boolean {
  return !store.banner.closed.includes(today) && store.banner.mutedMonth !== monthOf(today);
}

export function afterBannerClosed(store: PlusStore, today: string): PlusStore {
  const closed = [...new Set([...store.banner.closed, today])].sort().slice(-5);
  const threeInARow = [today, shiftDay(today, -1), shiftDay(today, -2)].every((d) => closed.includes(d));
  return { ...store, banner: { closed, mutedMonth: threeInARow ? monthOf(today) : store.banner.mutedMonth } };
}

/**
 * One Plus block per screen: of the blocks that could show, the smallest moment number wins
 * (clic 1, fiche 2, cartes 3, fin 4, dernier 5, bandeau 6).
 */
const ORDER: PlusMoment[] = ["clic", "fiche", "cartes", "fin", "dernier", "bandeau"];
export function winningMoment(candidates: PlusMoment[]): PlusMoment | null {
  return ORDER.find((m) => candidates.includes(m)) ?? null;
}
