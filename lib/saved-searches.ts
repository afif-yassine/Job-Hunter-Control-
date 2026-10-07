import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "./types";

export const searchFilters = z.object({
  query: z.string().max(160).default(""),
  metier: z.string().max(60).default(""),
  contract: z.enum(["", "alternance", "stage", "cdd", "cdi", "autre"]).default(""),
  sort: z.enum(["recent", "score"]).default("recent"),
  city: z.string().max(80).default(""),
  maxAgeDays: z.union([z.literal(0), z.literal(7), z.literal(14), z.literal(30)]).default(0),
  remote: z.boolean().default(false),
});
export const savedSearch = z.object({ name: z.string().trim().min(1).max(60), filters: searchFilters });
export const savedSearchList = z.array(savedSearch).max(10).refine(list => new Set(list.map(s => s.name.toLowerCase())).size === list.length, "Noms de recherches dupliqués.");
export type SearchFilters = z.infer<typeof searchFilters>;
export type SavedSearch = z.infer<typeof savedSearch>;

export function storedSearches(value: unknown): SavedSearch[] {
  if (!Array.isArray(value)) return [];
  const valid = value.flatMap(item => { const parsed = savedSearch.safeParse(item); return parsed.success ? [parsed.data] : []; });
  return valid.filter((item, i) => valid.findIndex(other => other.name.toLowerCase() === item.name.toLowerCase()) === i).slice(0, 10);
}

export async function loadSearches(db: SupabaseClient, userId: string) {
  const result = await db.from("user_settings").select("scan_config").eq("user_id", userId).maybeSingle();
  if (result.error) throw new Error("Recherches enregistrées indisponibles.");
  const config = result.data?.scan_config;
  return { config: config && typeof config === "object" && !Array.isArray(config) ? config as Record<string, unknown> : {}, searches: storedSearches(config?.savedSearches) };
}

export async function saveSearches(db: SupabaseClient, userId: string, searches: SavedSearch[]) {
  const parsed = savedSearchList.parse(searches);
  const { config } = await loadSearches(db, userId);
  const { error } = await db.from("user_settings").upsert({ user_id: userId, scan_config: { ...config, savedSearches: parsed }, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error("Sauvegarde des recherches impossible.");
  return parsed;
}

export function matchesAdvancedFilters(job: Job, filters: Pick<SearchFilters, "city" | "maxAgeDays" | "remote">, now = Date.now()) {
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (filters.city && !fold(job.location ?? "").includes(fold(filters.city))) return false;
  if (filters.maxAgeDays) {
    // Never substitute ingestion time for an unknown publication date.
    const published = Date.parse(job.publication_date ?? "");
    if (!Number.isFinite(published) || published > now || now - published > filters.maxAgeDays * 86_400_000) return false;
  }
  if (filters.remote) {
    const remote = job.offers?.summary?.remote ?? "";
    if (["partiel", "total"].includes(remote)) return true;
    if (!remote || /\b(non|no|aucun|pas|presentiel)\b|sur site/i.test(fold(remote)) || !/teletravail|remote|hybrid|distance/i.test(fold(remote))) return false;
  }
  return true;
}
