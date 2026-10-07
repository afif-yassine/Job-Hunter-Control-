import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesAdvancedFilters, saveSearches, loadSearches, searchFilters, savedSearchList } from "../lib/saved-searches";
import { normalizePrefs } from "../lib/scan/config";
import { fakeSupabase } from "./fake-supabase";
import type { Job } from "../lib/types";

test("searches are account scoped and preserve collection preferences", async () => {
  const { db, tables } = fakeSupabase({ user_settings: [{ user_id: "a", scan_config: { city: "Lyon", contracts: ["stage"] } }, { user_id: "b", scan_config: { city: "Paris" } }] });
  const searches = [{ name: "Mon stage", filters: searchFilters.parse({ contract: "stage", city: "Lyon" }) }];
  await saveSearches(db, "a", searches);
  assert.deepEqual((await loadSearches(db, "a")).searches, searches);
  assert.deepEqual((await loadSearches(db, "b")).searches, []);
  assert.equal((tables.user_settings[0].scan_config as Record<string, unknown>).city, "Lyon");
  assert.deepEqual(normalizePrefs(tables.user_settings[0].scan_config).savedSearches, searches);
});

test("invalid, duplicated and excessive searches are rejected", () => {
  const search = { name: "Stage", filters: {} };
  assert.equal(savedSearchList.safeParse([search, { ...search, name: "stage" }]).success, false);
  assert.equal(savedSearchList.safeParse([{ name: " ", filters: {} }]).success, false);
  assert.equal(savedSearchList.safeParse([{ ...search, filters: { maxAgeDays: -1 } }]).success, false);
  assert.equal(savedSearchList.safeParse(Array.from({ length: 11 }, (_, i) => ({ name: `${i}`, filters: {} }))).success, false);
});

test("advanced filters respect known publication dates and explicit remote conditions", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  const job = { location: "Évry", publication_date: "2026-10-05T12:00:00Z", offers: { summary: { remote: "Télétravail hybride" } } } as Job;
  const filters = { city: "evry", maxAgeDays: 7 as const, remote: true };
  assert.equal(matchesAdvancedFilters(job, filters, now), true);
  assert.equal(matchesAdvancedFilters({ ...job, offers: { summary: { remote: "partiel" } } }, filters, now), true);
  assert.equal(matchesAdvancedFilters({ ...job, offers: { summary: { remote: "total" } } }, filters, now), true);
  assert.equal(matchesAdvancedFilters({ ...job, publication_date: null }, filters, now), false);
  assert.equal(matchesAdvancedFilters({ ...job, publication_date: "2026-09-01" }, filters, now), false);
  assert.equal(matchesAdvancedFilters({ ...job, offers: { summary: { remote: "Pas de télétravail" } } }, filters, now), false);
});
