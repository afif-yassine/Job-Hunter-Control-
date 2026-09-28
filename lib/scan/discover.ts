import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAtsTarget, targetKey, type AtsTarget } from "./sources/ats";
import type { ScannedOffer } from "./types";

/**
 * Companies to follow, found by the app itself.
 *
 * How the app knows that company X uses Lever or Greenhouse: every
 * recruitment platform hosts the careers pages of its clients at a
 * recognisable address, with the company's identifier in it —
 *   jobs.lever.co/<company>/…            → Lever
 *   boards.greenhouse.io/<company>/…     → Greenhouse (job-boards.…, embed?for=<company> too)
 *   jobs.ashbyhq.com/<company>/…         → Ashby
 *   jobs.smartrecruiters.com/<company>/… → SmartRecruiters
 *   apply.workable.com/<company>/…       → Workable
 *   <company>.recruitee.com/…            → Recruitee
 * When JSearch, France Travail, Adzuna… return an offer whose link (or one of
 * its application links) has that shape, the company is added to the list the
 * scan reads directly — so the list fills itself with companies that really
 * recruit in the user's field. A company's own domain that merely embeds the
 * platform (careers.x.com?gh_jid=…) does not name the company: not detected.
 */

export type DiscoveredTarget = {
  /** "lever:acme" (see targetKey). */
  key: string;
  company: string;
  /** Source of the offer that revealed it: "jsearch:linkedin", "francetravail"… */
  via: string;
  /** The link it was recognised from (shown to the user). */
  link: string;
  firstSeen: string;
  lastSeen: string;
};

export type Discovered = {
  items: DiscoveredTarget[];
  /** Keys the user chose to stop following: never added again. */
  ignored: string[];
};

export const EMPTY_DISCOVERED: Discovered = { items: [], ignored: [] };

/** How many discovered companies are read on each scan (most recently seen first). */
export const MAX_DISCOVERED = 40;
/** A company not seen in any offer for this long is dropped. */
const FORGET_AFTER_DAYS = 90;

export function normalizeDiscovered(value: unknown): Discovered {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(v.items)
    ? (v.items as Record<string, unknown>[]).flatMap((i) => {
        const target = typeof i?.key === "string" ? parseAtsTarget(i.key) : null;
        if (!target) return [];
        const text = (x: unknown, fallback: string) => (typeof x === "string" && x ? x : fallback);
        return [
          {
            key: targetKey(target),
            company: text(i.company, target.slug),
            via: text(i.via, ""),
            link: text(i.link, ""),
            firstSeen: text(i.firstSeen, new Date(0).toISOString()),
            lastSeen: text(i.lastSeen, new Date(0).toISOString()),
          },
        ];
      })
    : [];
  const ignored = Array.isArray(v.ignored) ? v.ignored.filter((k): k is string => typeof k === "string") : [];
  return { items, ignored };
}

/** Every recruitment-platform board named by the links of these offers. */
export function boardsInOffers(offers: ScannedOffer[]): Map<string, { target: AtsTarget; company: string; via: string; link: string }> {
  const found = new Map<string, { target: AtsTarget; company: string; via: string; link: string }>();
  for (const offer of offers) {
    // Offers read from a board are that board: nothing to discover.
    if (offer.source.startsWith("ats:")) continue;
    for (const link of [offer.applyUrl, offer.url, ...(offer.links ?? [])]) {
      if (!link || !/^https?:\/\//i.test(link)) continue;
      const target = parseAtsTarget(link);
      if (!target) continue;
      const key = targetKey(target);
      if (!found.has(key)) found.set(key, { target, company: offer.company, via: offer.source, link });
    }
  }
  return found;
}

/**
 * Adds the boards found in this scan's offers. Returns the new list and how
 * many companies were added (for the scan summary).
 */
export function mergeDiscovered(
  current: Discovered,
  offers: ScannedOffer[],
  manualKeys: Set<string>,
  now = new Date(),
): { next: Discovered; added: DiscoveredTarget[] } {
  const stamp = now.toISOString();
  const byKey = new Map(current.items.map((i) => [i.key, { ...i }]));
  const ignored = new Set(current.ignored);
  const added: DiscoveredTarget[] = [];
  for (const [key, b] of boardsInOffers(offers)) {
    if (ignored.has(key) || manualKeys.has(key)) continue;
    const known = byKey.get(key);
    if (known) {
      known.lastSeen = stamp;
      continue;
    }
    const company = /^(entreprise non communiqu[ée]e|à compléter)$/i.test(b.company.trim()) ? b.target.slug : b.company.trim();
    const item = { key, company, via: b.via, link: b.link, firstSeen: stamp, lastSeen: stamp };
    byKey.set(key, item);
    added.push(item);
  }
  const cutoff = now.getTime() - FORGET_AFTER_DAYS * 86_400_000;
  const items = [...byKey.values()]
    .filter((i) => Date.parse(i.lastSeen) >= cutoff)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, MAX_DISCOVERED * 2);
  return { next: { items, ignored: current.ignored }, added };
}

/** The boards a scan reads: the most recently seen ones, within the cap. */
export function discoveredTargets(d: Discovered): AtsTarget[] {
  return d.items
    .slice(0, MAX_DISCOVERED)
    .map((i) => parseAtsTarget(i.key))
    .filter((t): t is AtsTarget => Boolean(t));
}

// Storage: user_settings.discovered_targets (jsonb). Before the migration the
// column does not exist: discovery is then simply skipped, nothing breaks.

export async function loadDiscovered(supabase: SupabaseClient, userId: string): Promise<Discovered | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("discovered_targets")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return normalizeDiscovered(data?.discovered_targets);
}

export async function saveDiscovered(supabase: SupabaseClient, userId: string, d: Discovered) {
  return supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, discovered_targets: d, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
}
