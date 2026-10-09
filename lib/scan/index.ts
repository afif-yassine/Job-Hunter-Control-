import type { SupabaseClient } from "@supabase/supabase-js";
import { loadIntegrationEnv } from "@/lib/integrations";
import { loadUserSettings, saveUserSettings } from "@/lib/settings";
import { configFromPrefs, hasChosenSearch, isRelevant, NO_SEARCH_MESSAGE } from "./config";
import { ingestOffers } from "./ingest";
import { ensureDailyBatch, unlockGate } from "../unlock";
import { scanAdzuna } from "./sources/adzuna";
import { discoveredTargets, loadDiscovered, mergeDiscovered, saveDiscovered } from "./discover";
import { parseAtsTarget, scanAts, targetKey } from "./sources/ats";
import { scanFranceTravail } from "./sources/francetravail";
import { scanGmailAlerts } from "./sources/gmail";
import { scanJooble } from "./sources/jooble";
import { scanJSearch } from "./sources/jsearch";
import { DEFAULT_TECH_ROMES, scanLba } from "./sources/lba";
import { serviceClient } from "@/lib/supabase/admin";
import { ensureProfileEmbedding, geminiEmbedder } from "@/lib/embeddings";
import { ensureSemanticProfile, semanticEnabled } from "@/lib/semantic-embeddings";
import {
  closeBoardOffers,
  dayBucket,
  expireOffers,
  harvestOffers,
  importFromCatalogue,
  offerFingerprint,
  queryCacheParts,
  withinDays,
} from "./catalogue";
import type { ScanConfig, SearchQuery } from "./config";
import { categorize, contractKind } from "./categories";
import {
  BudgetReached,
  budgetedFetch,
  budgetFor,
  cacheHours,
  cacheKey,
  classifyError,
  readCache,
  recordSourceRun,
  writeCache,
  type SourceId,
} from "./health";
import type { ScanSummary, ScannedOffer, SourceReport } from "./types";

export const SETUP_HINT =
  "Aucune source d’offres n’est connectée. Va dans Réglages > Sources et ajoute une clé gratuite (JSearch couvre LinkedIn, Indeed, Welcome to the Jungle… en 3 minutes).";

async function callWebhook(userId: string): Promise<ScannedOffer[]> {
  const response = await fetch(process.env.SCAN_WEBHOOK_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.SCAN_WEBHOOK_SECRET || ""}`,
    },
    body: JSON.stringify({ user_id: userId, mode: "PREPARE_ONLY" }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!response.ok)
    throw new Error(`Le scanner externe a répondu HTTP ${response.status}`);
  const body = (await response.json().catch(() => ({}))) as {
    offers?: ScannedOffer[];
  };
  return Array.isArray(body.offers) ? body.offers : [];
}

/**
 * The métiers (ROME codes) of this account, learnt from its France Travail
 * offers — the only source that gives them. Tech defaults until there are some.
 */
async function userRomes(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from("jobs").select("rome_code").eq("user_id", userId).not("rome_code", "is", null).limit(500);
  const count = new Map<string, number>();
  for (const r of (data ?? []) as { rome_code: string | null }[])
    if (r.rome_code) count.set(r.rome_code, (count.get(r.rome_code) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code).slice(0, 10);
  return top.length ? top : DEFAULT_TECH_ROMES;
}

/** A category × contract with this many catalogue offers is not searched again per account. */
const COVERED = 20;

/** Companies' boards learnt from the catalogue, read on top of the account's own. */
const SHARED_BOARDS = 15;

type SourceDef = {
  id: SourceId;
  name: string;
  enabled: boolean;
  missing: string;
  /** Environment variables holding its key (to know whose key is used). */
  keys: string[];
  /** Same results for every account with the same search → shared cache. */
  cacheable: boolean;
  /** Searched around a city or department: not called when the account chose no area. */
  zoned?: boolean;
  /**
   * Searched one query at a time (at most this many queries), each query
   * cached on its own: accounts whose searches overlap share the calls.
   */
  perQuery?: number;
  /** Cache identity when the source is not searched by query. */
  cacheParts?: () => Promise<unknown>;
  run: (fetchImpl: typeof fetch, config: ScanConfig) => Promise<ScannedOffer[]>;
};

export async function runScan(ctx: {
  supabase: SupabaseClient;
  userId: string;
  /** Overrides the environment (tests). */
  env?: Record<string, string | undefined>;
  /** Write an OFFER_SCAN line in the journal (default true). */
  log?: boolean;
  /** Service client for the shared cache (defaults to SUPABASE_SERVICE_ROLE_KEY). */
  cacheDb?: SupabaseClient | null;
  /**
   * A student's account (anyone but the administrator). The operator's mailbox (Gmail)
   * and the external webhook (which receives the account id) are never used for it,
   * nor the companies learnt from the shared catalogue: they belong to the platform.
   */
  student?: boolean;
  /**
   * A student's update that only reads the shared catalogue (and the companies the account
   * typed itself). No job-site API is called or charged either. Implies `student`.
   */
  catalogueOnly?: boolean;
}): Promise<ScanSummary> {
  const student = Boolean(ctx.student || ctx.catalogueOnly);
  // Daily selection (migration 20261009090000): once it applies to this account, nothing a job site returns
  // reaches the list, so no job site is called at all (their quota would be spent for nothing), whatever
  // STUDENT_CATALOGUE_ONLY says. The administrator is never concerned.
  const cacheDb = ctx.cacheDb !== undefined ? ctx.cacheDb : serviceClient();
  const gate = student ? await unlockGate(ctx.supabase, ctx.userId, cacheDb) : ({ active: false } as const);
  const catalogueOnly = Boolean(ctx.catalogueOnly) || gate.active;
  // Keys typed in the dashboard win over Vercel variables.
  const env = ctx.env ?? {
    ...process.env,
    ...(catalogueOnly ? {} : await loadIntegrationEnv(ctx.supabase, ctx.userId)),
  };
  const has = (name: string) => Boolean(env[name]?.trim());
  // A platform key (Vercel) is shared by every account: its free budget and
  // cache are shared too. A key typed by one account stays its own.
  const platformKey = (keys: string[]) => keys.every((k) => process.env[k] && env[k] === process.env[k]);
  const settings = await loadUserSettings(ctx.supabase, ctx.userId);
  // Nothing chosen yet: no source, catalogue or vector work is started for this account.
  if (!hasChosenSearch(settings.prefs))
    return { reports: [], found: 0, relevant: 0, inserted: 0, duplicates: 0, alreadyApplied: 0, toReview: 0, suspected: 0, needsDescription: 0, configured: true, noSearch: true };
  const config = configFromPrefs(settings.prefs);
  // Companies the app found by itself on a recruitment platform (see discover.ts)
  // are read like the ones typed in Réglages. null = column not migrated yet.
  const discovered = catalogueOnly ? null : await loadDiscovered(ctx.supabase, ctx.userId);
  const manualKeys = new Set(config.targets.map(targetKey));
  if (discovered)
    for (const t of discoveredTargets(discovered)) if (!manualKeys.has(targetKey(t))) config.targets.push(t);
  // Offers other accounts already found (any wording) that answer this search:
  // no call to any job site. Their companies' boards are read too, so they
  // stay fresh and withdrawn offers are noticed.
  // The profile's vector first (once per profile version), so the closest offers come too.
  if (semanticEnabled(env)) await ensureSemanticProfile(ctx.supabase, ctx.userId, env);
  else await ensureProfileEmbedding(ctx.supabase, ctx.userId, geminiEmbedder(env));
  const fromCatalogue = await importFromCatalogue(ctx.supabase, config);
  // Offers the catalogue gave for each ticked category × contract.
  const coverage = new Map<string, number>();
  for (const o of fromCatalogue.offers) {
    const kind = contractKind(o);
    for (const c of categorize(o)) coverage.set(`${c}|${kind}`, (coverage.get(`${c}|${kind}`) ?? 0) + 1);
  }
  const covered = (q: SearchQuery) => Boolean(q.category && q.contract && (coverage.get(`${q.category}|${q.contract}`) ?? 0) >= COVERED);
  const ignored = new Set(discovered?.ignored ?? []);
  const reading = new Set(config.targets.map(targetKey));
  // Boards learnt from the catalogue are the collection's job, not a student update's.
  for (const board of student ? [] : fromCatalogue.boards.slice(0, SHARED_BOARDS)) {
    const t = parseAtsTarget(board);
    if (t && !reading.has(board) && !ignored.has(board)) {
      config.targets.push(t);
      reading.add(board);
    }
  }
  const reports: SourceReport[] = [];
  const collected: ScannedOffer[] = [];
  // Careers boards read in full this scan → every link they list.
  const listedBoards: Record<string, string[]> = {};
  // Budgets and source health are platform data: written with the service
  // client only (accounts cannot call these functions themselves).
  const platformDb = cacheDb ?? ctx.supabase;
  const ttl = cacheHours(env);
  // La bonne alternance searches by métier (ROME), learnt once per scan.
  let romes: Promise<string[]> | null = null;
  const lbaRomes = () => (romes ??= userRomes(ctx.supabase, ctx.userId));

  const sources: SourceDef[] = [
    {
      id: "francetravail",
      zoned: true,
      name: "France Travail",
      enabled: has("FRANCE_TRAVAIL_CLIENT_ID") && has("FRANCE_TRAVAIL_CLIENT_SECRET"),
      missing: "FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET",
      keys: ["FRANCE_TRAVAIL_CLIENT_ID", "FRANCE_TRAVAIL_CLIENT_SECRET"],
      cacheable: true,
      perQuery: 10,
      run: (f, c) => scanFranceTravail(c, env, f),
    },
    {
      id: "jsearch",
      zoned: true,
      name: "JSearch (LinkedIn, Indeed, WTTJ…)",
      enabled: has("JSEARCH_API_KEY"),
      missing: "JSEARCH_API_KEY",
      keys: ["JSEARCH_API_KEY"],
      cacheable: true,
      // Free plan ~200 requests / month: the first 3 queries only.
      perQuery: 3,
      run: (f, c) => scanJSearch(c, env, f),
    },
    {
      id: "adzuna",
      zoned: true,
      name: "Adzuna",
      enabled: has("ADZUNA_APP_ID") && has("ADZUNA_APP_KEY"),
      missing: "ADZUNA_APP_ID / ADZUNA_APP_KEY",
      keys: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
      cacheable: true,
      perQuery: 10,
      run: (f, c) => scanAdzuna(c, env, f),
    },
    {
      id: "jooble",
      zoned: true,
      name: "Jooble",
      enabled: has("JOOBLE_API_KEY"),
      missing: "JOOBLE_API_KEY",
      keys: ["JOOBLE_API_KEY"],
      cacheable: true,
      perQuery: 10,
      run: (f, c) => scanJooble(c, env, f),
    },
    {
      id: "lba",
      zoned: true,
      name: "La bonne alternance",
      enabled: has("LBA_API_KEY"),
      missing: "LBA_API_KEY (et l’accord d’usage commercial de La bonne alternance)",
      keys: ["LBA_API_KEY"],
      cacheable: true,
      cacheParts: async () => ({ source: "lba", romes: await lbaRomes(), city: config.city.toLowerCase().trim() }),
      run: async (f, c) => scanLba(c, env, f, await lbaRomes()),
    },
    {
      id: "gmail",
      name: "Alertes e-mail (Gmail)",
      enabled: has("GMAIL_CLIENT_ID") && has("GMAIL_CLIENT_SECRET") && has("GMAIL_REFRESH_TOKEN"),
      missing: "GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN",
      keys: ["GMAIL_REFRESH_TOKEN"],
      cacheable: false,
      run: () => scanGmailAlerts(env, Math.min(config.maxAgeDays, 14)),
    },
    {
      id: "webhook",
      name: "Scanner externe (SCAN_WEBHOOK_URL)",
      enabled: has("SCAN_WEBHOOK_URL"),
      missing: "SCAN_WEBHOOK_URL",
      keys: ["SCAN_WEBHOOK_URL"],
      cacheable: false,
      run: () => callWebhook(ctx.userId),
    },
  ];

  const runSource = async (source: SourceDef) => {
    if (!source.enabled) {
      reports.push({ source: source.name, status: "skipped", found: 0, message: `Non configuré (${source.missing})` });
      return;
    }
    // No city or department chosen: only the shared catalogue is read, no job site is called or charged.
    if (source.zoned && !config.city.trim() && !config.departments.length) {
      reports.push({ source: source.name, status: "skipped", found: 0, message: "Sans ville ni département choisi, seul le catalogue commun est lu." });
      return;
    }
    const shared = platformKey(source.keys);
    const useCache = source.cacheable && shared;
    const budget = shared ? budgetFor(source.id, env) : null;
    const fetchImpl = budget ? budgetedFetch(platformDb, source.id, budget) : fetch;

    // Category queries the platform harvest already covers well are not
    // searched again for this account: its offers come from the catalogue.
    const queries = config.queries.filter((q) => !covered(q));
    if (source.perQuery && !queries.length) {
      reports.push({ source: source.name, status: "ok", found: 0, message: "Déjà couvert par la collecte plateforme (catalogue commun)" });
      return;
    }
    // One unit = one call to the source (one query, or the whole search).
    const units: { key: string | null; config: ScanConfig }[] = source.perQuery
      ? queries.slice(0, source.perQuery).map((q) => ({
          key: useCache ? cacheKey(queryCacheParts(source.id, q, config)) : null,
          // Standard window so that accounts at 10 or 14 days share the call.
          config: { ...config, queries: [q], maxAgeDays: dayBucket(config.maxAgeDays) },
        }))
      : [{ key: useCache ? cacheKey(source.cacheParts ? await source.cacheParts() : { source: source.id }) : null, config }];

    const got: ScannedOffer[] = [];
    const errors: string[] = [];
    let fromCache = 0;
    let budgetMessage: string | null = null;
    for (const unit of units) {
      const cached = unit.key ? await readCache(cacheDb, source.id, unit.key, ttl) : null;
      if (cached) {
        got.push(...cached);
        fromCache += 1;
        continue;
      }
      try {
        const offers = await source.run(fetchImpl, unit.config);
        got.push(...offers);
        if (unit.key) await writeCache(cacheDb, source.id, unit.key, offers);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        if (error instanceof BudgetReached) {
          budgetMessage = message;
          break;
        }
        errors.push(message);
        // A refused key or an exhausted quota will not work for the next query either.
        if (classifyError(message) !== "error") break;
      }
    }
    const offers = source.perQuery ? withinDays(got, config.maxAgeDays) : got;
    collected.push(...offers);

    const tried = units.length;
    const failed = errors.length > 0 && got.length === 0 && fromCache === 0;
    if (failed) {
      const message = [...new Set(errors)].join(" ; ");
      reports.push({ source: source.name, status: "error", found: 0, message });
      await recordSourceRun(platformDb, source.id, classifyError(message), 0, message);
      return;
    }
    if (budgetMessage) {
      // Not the user's problem: the other sources keep going, the admin is told.
      reports.push({ source: source.name, status: got.length ? "ok" : "skipped", found: offers.length, message: budgetMessage });
      await recordSourceRun(platformDb, source.id, "budget", offers.length, budgetMessage);
      return;
    }
    const notes: string[] = [];
    if (fromCache === tried) notes.push("Résultat récent réutilisé (cache commun)");
    else if (fromCache) notes.push(`${fromCache} recherche(s) sur ${tried} reprise(s) du cache commun`);
    if (errors.length) notes.push([...new Set(errors)].join(" ; "));
    reports.push({ source: source.name, status: "ok", found: offers.length, message: notes.join(" · ") || undefined });
    await recordSourceRun(platformDb, source.id, "ok", offers.length, errors.length ? errors.join(" ; ") : null, fromCache === tried);
  };

  // Company careers pages: read per company, each one cached for everybody.
  const runCareers = async () => {
    const name = "Pages carrière (Greenhouse, Lever, Ashby…)";
    if (!config.targets.length) {
      reports.push({ source: name, status: "skipped", found: 0, message: "Non configuré (aucune entreprise ajoutée dans Réglages > Recherche)" });
      return;
    }
    const perAts = new Map<SourceId, { found: number; errors: string[] }>();
    const tally = (ats: string) => {
      const id = `ats:${ats}` as SourceId;
      if (!perAts.has(id)) perAts.set(id, { found: 0, errors: [] });
      return perAts.get(id)!;
    };
    const errors: string[] = [];
    let found = 0;
    let next = 0;
    const lane = async () => {
      while (next < config.targets.length) {
        const target = config.targets[next++];
        const id = `ats:${target.ats}` as SourceId;
        const key = cacheKey({ source: id, slug: target.slug, days: Math.max(config.maxAgeDays, 30), city: config.city });
        const cached = await readCache(cacheDb, id, key, ttl);
        if (cached) {
          collected.push(...cached);
          found += cached.length;
          tally(target.ats).found += cached.length;
          continue;
        }
        const result = await scanAts([target], config);
        Object.assign(listedBoards, result.listed);
        collected.push(...result.offers);
        found += result.offers.length;
        tally(target.ats).found += result.offers.length;
        if (result.errors.length) {
          errors.push(...result.errors);
          tally(target.ats).errors.push(...result.errors);
        } else await writeCache(cacheDb, id, key, result.offers);
      }
    };
    await Promise.all(Array.from({ length: Math.min(5, config.targets.length) }, lane));
    for (const [id, t] of perAts) {
      const allFailed = t.errors.length > 0 && t.found === 0;
      await recordSourceRun(platformDb, id, allFailed ? classifyError(t.errors.join(" ")) : "ok", t.found, t.errors.slice(0, 3).join(" ; ") || null);
    }
    if (errors.length && !found && errors.length >= config.targets.length)
      reports.push({ source: name, status: "error", found: 0, message: errors.slice(0, 3).join(" ; ") });
    else
      reports.push({ source: name, status: "ok", found, message: errors.length ? errors.slice(0, 3).join(" ; ") : undefined });
  };

  if (catalogueOnly)
    reports.push({ source: "Sources d’emploi externes", status: "skipped", found: 0, message: "Réservées à la collecte automatique de la plateforme : ta liste vient du catalogue commun." });
  // Operator-level sources are for the administrator's account only.
  const allowed = sources.filter((s) => !(student && (s.id === "gmail" || s.id === "webhook")));
  // Selection active: the pages carrière typed by the account are read by the platform's own harvest (it
  // knows every account's boards), and what they return would not be copied here: nothing is read per account.
  await Promise.all(gate.active ? [] : catalogueOnly ? [runCareers()] : [...allowed.map(runSource), runCareers()]);

  // Learn new companies from the links of what was just found.
  let discoveredCount = 0;
  if (discovered) {
    const { next, added } = mergeDiscovered(discovered, collected, manualKeys);
    discoveredCount = added.length;
    if (JSON.stringify(next) !== JSON.stringify(discovered)) await saveDiscovered(ctx.supabase, ctx.userId, next);
  }

  // Company careers pages and the catalogue alone do not need any key.
  const configured = catalogueOnly || sources.some((s) => s.enabled) || config.targets.length > 0 || fromCatalogue.offers.length > 0;
  const relevant = collected.filter(isRelevant);
  // Shared catalogue: store / refresh what was seen, close what left its board,
  // expire what nobody has seen for 3 weeks. Never blocks the scan.
  const harvest = await harvestOffers(cacheDb, relevant);
  if (!harvest.error) {
    for (const [board, urls] of Object.entries(listedBoards)) await closeBoardOffers(cacheDb, board, urls);
    await expireOffers(cacheDb);
  }
  // Catalogue offers are not harvested again (that would keep them alive forever).
  const fresh = new Set(relevant.map(offerFingerprint));
  const imported = fromCatalogue.offers.filter((o) => isRelevant(o) && !fresh.has(offerFingerprint(o)));
  if (fromCatalogue.offers.length)
    reports.push({
      source: "Catalogue commun",
      status: "ok",
      found: imported.length,
      message: "Offres déjà trouvées par d’autres recherches : aucun appel aux sites d’emploi.",
    });
  const entries = harvest.error ? new Map(fromCatalogue.entries) : new Map([...fromCatalogue.entries, ...harvest.entries]);
  // Daily selection (migration 20261009090000): a student's list only receives the offers unlocked
  // for the account, today's lot included. Offers outside the catalogue are not copied at all.
  const ingest = gate.active
    ? await ensureDailyBatch(ctx.supabase, gate, ctx.userId).then((b) => ({ inserted: b.inserted, duplicates: 0, alreadyApplied: 0, toReview: 0, suspected: 0, needsDescription: 0, error: undefined as string | undefined }))
    : await ingestOffers(ctx.supabase, ctx.userId, [...relevant, ...imported], entries.size ? entries : undefined);
  if (ingest.error)
    reports.push({
      source: "Base de données",
      status: "error",
      found: 0,
      message: ingest.error,
    });

  const summary: ScanSummary = {
    reports,
    found: collected.length + imported.length,
    relevant: relevant.length + imported.length,
    inserted: ingest.inserted,
    duplicates: ingest.duplicates,
    alreadyApplied: ingest.alreadyApplied,
    toReview: ingest.toReview,
    suspected: ingest.suspected,
    needsDescription: ingest.needsDescription,
    configured,
    discovered: discoveredCount,
  };

  if (configured) {
    await saveUserSettings(ctx.supabase, ctx.userId, {
      lastScanAt: new Date().toISOString(),
    });
    if (ctx.log !== false)
      await ctx.supabase.from("agent_runs").insert({
        user_id: ctx.userId,
        run_type: "OFFER_SCAN",
        status: reports.some((r) => r.status === "error")
          ? "FAILED"
          : "COMPLETED",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        counters: {
          found: summary.found,
          relevant: summary.relevant,
          inserted: summary.inserted,
          duplicates: summary.duplicates,
          alreadyApplied: summary.alreadyApplied,
          toReview: summary.toReview,
          suspected: summary.suspected,
        },
        error_message:
          reports
            .filter((r) => r.status === "error")
            .map((r) => `${r.source}: ${r.message}`)
            .join(" | ") || null,
      });
    if (summary.inserted && ctx.log !== false)
      await ctx.supabase.from("notifications").insert({
        user_id: ctx.userId,
        notification_type: "NEW_OFFERS",
        title: `${summary.inserted} nouvelle(s) offre(s)`,
        message: `${summary.duplicates} doublon(s) regroupé(s)${summary.alreadyApplied ? ` (dont ${summary.alreadyApplied} déjà postulée(s) ailleurs)` : ""}${summary.toReview + summary.suspected ? ` · ${summary.toReview + summary.suspected} à vérifier` : ""}${summary.needsDescription ? ` · ${summary.needsDescription} offre(s) à compléter avec la description` : ""}.`,
        delivery_channels: ["dashboard"],
      });
  }
  return summary;
}

export function scanMessage(s: ScanSummary): string {
  if (s.noSearch) return NO_SEARCH_MESSAGE;
  if (!s.configured) return SETUP_HINT;
  const errors = s.reports.filter((r) => r.status === "error");
  const head = `Scan terminé : ${s.found} offre(s) trouvée(s), ${s.relevant} pertinente(s), ${s.inserted} nouvelle(s), ${s.duplicates} doublon(s) regroupé(s)${s.alreadyApplied ? ` dont ${s.alreadyApplied} déjà postulée(s) ailleurs` : ""}.${s.toReview + s.suspected ? ` ${s.toReview + s.suspected} offre(s) à vérifier.` : ""}`;
  const learned = s.discovered
    ? ` ${s.discovered} entreprise(s) repérée(s) sur une plateforme de recrutement : leurs offres seront lues directement à la prochaine recherche.`
    : "";
  const extra = s.needsDescription
    ? ` ${s.needsDescription} offre(s) sans description : colle-la pour activer l’analyse.`
    : "";
  const problems = errors.length
    ? ` Erreur : ${errors.map((e) => `${e.source} — ${e.message}`).join(" ; ")}`
    : "";
  return head + learned + extra + problems;
}

/**
 * Fill the account's list from the shared catalogue only (no job site
 * called): right after sign-up or a change of search. Returns how many
 * offers were added.
 */
export async function seedFromCatalogue(supabase: SupabaseClient, userId: string, options: { refreshVector?: boolean; /** Service client for the daily unlock (tests); defaults to the platform's. */ service?: SupabaseClient | null } = {}): Promise<number> {
  const settings = await loadUserSettings(supabase, userId);
  if (!hasChosenSearch(settings.prefs)) return 0;
  const config = configFromPrefs(settings.prefs);
  // The profile's vector is refreshed unless the caller only copies what the catalogue holds (no AI call).
  if (options.refreshVector !== false) {
    if (semanticEnabled()) await ensureSemanticProfile(supabase, userId, process.env);
    else await ensureProfileEmbedding(supabase, userId, geminiEmbedder());
  }
  // Daily selection: only today's lot (and what was unlocked before) is copied for a student.
  const gate = await unlockGate(supabase, userId, options.service);
  if (gate.active) return (await ensureDailyBatch(supabase, gate, userId)).inserted;
  const found = await importFromCatalogue(supabase, config);
  const offers = found.offers.filter(isRelevant);
  if (!offers.length) return 0;
  const result = await ingestOffers(supabase, userId, offers, found.entries);
  return result.inserted;
}
