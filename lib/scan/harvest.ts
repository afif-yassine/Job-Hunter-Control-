import type { SupabaseClient } from "@supabase/supabase-js";
import { getFranceTravailToken } from "@/lib/france-travail/client";
import { closeBoardOffers, expireOffers, harvestOffers } from "./catalogue";
import { CATEGORIES, EXTRA_ROMES, SCOPE_CONTRACTS, categorize, contractKind } from "./categories";
import { BudgetReached, budgetFor, budgetedFetch, classifyError, recordSourceRun } from "./health";
import { scanAdzuna } from "./sources/adzuna";
import { parseAtsTarget, scanAts, targetKey } from "./sources/ats";
import { FT_MAX_INDEX, FT_OFFERS_SCOPE, FT_PAGE, fetchFranceTravailPage, type FtHarvestQuery } from "./sources/francetravail";
import type { ScannedOffer } from "./types";

/**
 * Platform harvest: twice a day the platform collects, for everybody, the
 * offers of the scope (stage, alternance, CDD in IT, digital and office jobs):
 *
 * - France Travail, whole country, by métier (domain M18 + the ROME codes of
 *   the other categories), one search per region and kind of contract
 *   (split by département when a region has more than 3 150 offers);
 * - Adzuna, each category in the big cities (morning run only: free budget);
 * - every careers board known to the platform (free).
 *
 * Vercel stops a function after 60 s, so a run is a queue of tasks
 * (harvest_tasks) worked through in slices by /api/cron/harvest; each slice
 * resumes where the previous one stopped. When every France Travail task of a
 * run succeeded, its offers no longer listed are closed (licence: mirror
 * deletions at least every 24 h).
 */

type Env = Record<string, string | undefined>;

/** Runs start at 04:00 and 12:00 UTC (6 h and 14 h in Paris, summer time). */
export const HARVEST_HOURS_UTC = [4, 12];

/** The run due at this moment: "2026-10-04T12". */
export function slotOf(now: Date): string {
  const hour = now.getUTCHours();
  const due = [...HARVEST_HOURS_UTC].reverse().find((h) => h <= hour);
  const day = new Date(now);
  if (due === undefined) day.setUTCDate(day.getUTCDate() - 1);
  const h = due ?? HARVEST_HOURS_UTC[HARVEST_HOURS_UTC.length - 1];
  return `${day.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}`;
}

/** France Travail regions (INSEE codes) and their départements (split when too big). */
export const FT_REGIONS: Record<string, string[]> = {
  "11": ["75", "77", "78", "91", "92", "93", "94", "95"],
  "24": ["18", "28", "36", "37", "41", "45"],
  "27": ["21", "25", "39", "58", "70", "71", "89", "90"],
  "28": ["14", "27", "50", "61", "76"],
  "32": ["02", "59", "60", "62", "80"],
  "44": ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
  "52": ["44", "49", "53", "72", "85"],
  "53": ["22", "29", "35", "56"],
  "75": ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
  "76": ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
  "84": ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
  "93": ["04", "05", "06", "13", "83", "84"],
  "94": ["2A", "2B"],
  "01": ["971"],
  "02": ["972"],
  "03": ["973"],
  "04": ["974"],
  "06": ["976"],
};

/** France Travail has no internships: apprenticeship, professionalisation, CDD. */
export const FT_SEGMENTS: { id: string; query: FtHarvestQuery }[] = [
  { id: "it-app", query: { grandDomaine: "M18", natureContrat: "E2" } },
  { id: "it-pro", query: { grandDomaine: "M18", natureContrat: "FS" } },
  { id: "it-cdd", query: { grandDomaine: "M18", typeContrat: "CDD" } },
  { id: "oth-app", query: { codeROME: EXTRA_ROMES, natureContrat: "E2" } },
  { id: "oth-pro", query: { codeROME: EXTRA_ROMES, natureContrat: "FS" } },
  { id: "oth-cdd", query: { codeROME: EXTRA_ROMES, typeContrat: "CDD" } },
];

export const ADZUNA_CITIES = ["Paris", "Lyon", "Toulouse", "Lille", "Bordeaux"];
const ADZUNA_CONTRACTS = ["alternance", "stage"];
const MAX_BOARDS = 300;

export type HarvestTask = {
  key: string;
  source: "francetravail" | "adzuna" | "ats";
  params: Record<string, unknown>;
  status?: "pending" | "done" | "error";
  next_index?: number;
  found?: number;
  error?: string | null;
};

/** Only offers of the scope go into the catalogue from boards and keyword sources. */
export function inScope(o: ScannedOffer): boolean {
  return SCOPE_CONTRACTS.includes(contractKind(o)) && categorize(o).length > 0;
}

const ftReady = (env: Env) => Boolean(env.FRANCE_TRAVAIL_CLIENT_ID?.trim() && env.FRANCE_TRAVAIL_CLIENT_SECRET?.trim());
const adzunaReady = (env: Env) => Boolean(env.ADZUNA_APP_ID?.trim() && env.ADZUNA_APP_KEY?.trim());

/** Every careers board the platform knows: in the catalogue, typed or discovered by any account. */
async function knownBoards(db: SupabaseClient): Promise<string[]> {
  const boards = new Set<string>();
  const { data: offers } = await db.from("offers").select("board").not("board", "is", null).limit(5000);
  for (const r of (offers ?? []) as { board: string | null }[]) if (r.board) boards.add(r.board);
  const { data: settings } = await db.from("user_settings").select("scan_config,discovered_targets").limit(5000);
  for (const s of (settings ?? []) as { scan_config?: { targets?: unknown }; discovered_targets?: { items?: { key?: unknown }[] } }[]) {
    const typed = Array.isArray(s.scan_config?.targets) ? (s.scan_config!.targets as unknown[]) : [];
    for (const t of typed) {
      const parsed = typeof t === "string" ? parseAtsTarget(t) : null;
      if (parsed) boards.add(targetKey(parsed));
    }
    for (const item of s.discovered_targets?.items ?? []) if (typeof item.key === "string" && parseAtsTarget(item.key)) boards.add(item.key);
  }
  return [...boards].sort().slice(0, MAX_BOARDS);
}

export async function planTasks(db: SupabaseClient, slot: string, env: Env): Promise<HarvestTask[]> {
  const tasks: HarvestTask[] = [];
  if (ftReady(env))
    for (const region of Object.keys(FT_REGIONS))
      for (const seg of FT_SEGMENTS)
        tasks.push({ key: `ft:r${region}:${seg.id}`, source: "francetravail", params: { region, segment: seg.id } });
  for (const board of await knownBoards(db)) tasks.push({ key: `ats:${board}`, source: "ats", params: { board } });
  const morning = slot.endsWith(`T${String(HARVEST_HOURS_UTC[0]).padStart(2, "0")}`);
  if (adzunaReady(env) && morning)
    for (const cat of CATEGORIES)
      for (const contract of ADZUNA_CONTRACTS)
        for (const city of ADZUNA_CITIES)
          tasks.push({ key: `adzuna:${cat.id}:${contract}:${city}`, source: "adzuna", params: { what: `${contract} ${cat.search}`, city } });
  return tasks;
}

function ftQuery(params: Record<string, unknown>): FtHarvestQuery | null {
  const seg = FT_SEGMENTS.find((s) => s.id === params.segment);
  if (!seg) return null;
  return {
    ...seg.query,
    ...(typeof params.region === "string" ? { region: params.region } : {}),
    ...(typeof params.departement === "string" ? { departement: params.departement } : {}),
  };
}

export type HarvestReport = {
  run: string;
  created: boolean;
  processed: number;
  offers: number;
  pending: number;
  finished: boolean;
  closed?: number;
  expired?: number;
  errors: string[];
};

/**
 * One slice of the current run: creates it when due, works through its tasks
 * until `budgetMs` is spent, finishes it when nothing is left.
 */
export async function runHarvestSlice(
  db: SupabaseClient,
  opts: { env?: Env; now?: Date; budgetMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<HarvestReport> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 45_000;
  let throttled = false;
  const left = () => (throttled ? 0 : budgetMs - (Date.now() - started));
  const fetchImpl = opts.fetchImpl ?? fetch;
  const run = slotOf(now);
  const report: HarvestReport = { run, created: false, processed: 0, offers: 0, pending: 0, finished: false, errors: [] };

  const { data: existing, error: runError } = await db.from("harvest_runs").select("id,status,started_at").eq("id", run).maybeSingle();
  if (runError) throw new Error(`Collecte : table harvest_runs indisponible (${runError.message})`);
  let startedAt = existing?.started_at as string | undefined;
  if (!existing) {
    const tasks = await planTasks(db, run, env);
    const { error } = await db.from("harvest_runs").insert({ id: run, status: "running" });
    if (error && !/duplicate|23505/.test(`${error.code} ${error.message}`)) throw new Error(error.message);
    for (let i = 0; i < tasks.length; i += 200)
      await db.from("harvest_tasks").upsert(
        tasks.slice(i, i + 200).map((t) => ({ run_id: run, key: t.key, source: t.source, params: t.params, status: "pending", next_index: 0, found: 0 })),
        { onConflict: "run_id,key", ignoreDuplicates: true },
      );
    report.created = true;
    startedAt = new Date().toISOString();
  } else if (existing.status !== "running") {
    report.finished = true;
    return report;
  }

  let token: string | null = null;
  const ftToken = async () => (token ??= await getFranceTravailToken(FT_OFFERS_SCOPE, env, fetchImpl));
  const adzunaBudget = budgetFor("adzuna", env, now);
  const adzunaFetch = adzunaBudget ? budgetedFetch(db, "adzuna", adzunaBudget, fetchImpl) : fetchImpl;

  const save = (key: string, patch: Record<string, unknown>) =>
    db.from("harvest_tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("run_id", run).eq("key", key);
  const store = async (offers: ScannedOffer[]) => {
    const { error } = await harvestOffers(db, offers);
    if (error) throw new Error(`Catalogue : ${error}`);
    report.offers += offers.length;
  };

  const work = async (task: HarvestTask) => {
    if (task.source === "francetravail") {
      const query = ftQuery(task.params);
      if (!query) return save(task.key, { status: "error", error: "Segment inconnu" });
      let index = task.next_index ?? 0;
      let found = task.found ?? 0;
      while (left() > 6_000) {
        let page;
        try {
          page = await fetchFranceTravailPage(query, index, await ftToken(), fetchImpl);
        } catch (error) {
          const message = error instanceof Error ? error.message : "erreur";
          // A region refused or too big: the same search per département.
          if (query.region && index === 0 && /HTTP 400/.test(message)) return split(task);
          if (/429/.test(message)) {
            // Too fast for France Travail: stop this slice, the next one resumes here.
            throttled = true;
            return save(task.key, { found, next_index: index, error: message });
          }
          return save(task.key, { status: "error", error: message });
        }
        if (index === 0 && query.region && (page.total ?? 0) > FT_MAX_INDEX + 1) return split(task);
        await store(page.offers);
        found += page.offers.length;
        index += FT_PAGE;
        if (page.last) return save(task.key, { status: "done", found, next_index: index, error: null });
        await save(task.key, { found, next_index: index });
        await new Promise((r) => setTimeout(r, 120)); // France Travail: 10 calls / s at most
      }
      return;
    }
    if (task.source === "ats") {
      const target = parseAtsTarget(String(task.params.board ?? ""));
      if (!target) return save(task.key, { status: "error", error: "Page carrière illisible" });
      const result = await scanAts([target], { city: "", maxAgeDays: 31 }, fetchImpl);
      const offers = result.offers.filter(inScope);
      await store(offers);
      if (!result.errors.length) for (const [board, urls] of Object.entries(result.listed)) await closeBoardOffers(db, board, urls);
      return save(task.key, result.errors.length ? { status: "error", error: result.errors[0] } : { status: "done", found: offers.length });
    }
    // Adzuna
    try {
      const offers = (
        await scanAdzuna(
          { queries: [{ keywords: String(task.params.what) }], city: String(task.params.city), departments: [], maxAgeDays: 14, targets: [] },
          env,
          adzunaFetch,
        )
      ).filter(inScope);
      await store(offers);
      return save(task.key, { status: "done", found: offers.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "erreur";
      return save(task.key, { status: "error", error: error instanceof BudgetReached ? `budget : ${message}` : message });
    }
  };

  const split = async (task: HarvestTask) => {
    const deps = FT_REGIONS[String(task.params.region)] ?? [];
    await db.from("harvest_tasks").upsert(
      deps.map((d) => ({
        run_id: run,
        key: `ft:d${d}:${task.params.segment}`,
        source: "francetravail",
        params: { departement: d, segment: task.params.segment },
        status: "pending",
        next_index: 0,
        found: 0,
      })),
      { onConflict: "run_id,key", ignoreDuplicates: true },
    );
    return save(task.key, { status: "done", error: `Découpée en ${deps.length} départements` });
  };

  while (left() > 6_000) {
    const { data: pending } = await db
      .from("harvest_tasks")
      .select("key,source,params,next_index,found")
      .eq("run_id", run)
      .eq("status", "pending")
      .order("key")
      .limit(20);
    const list = (pending ?? []) as HarvestTask[];
    if (!list.length) break;
    for (const task of list) {
      if (left() <= 6_000) break;
      try {
        await work(task);
      } catch (error) {
        const message = error instanceof Error ? error.message : "erreur";
        report.errors.push(`${task.key} : ${message}`);
        await save(task.key, { status: "error", error: message });
      }
      report.processed += 1;
    }
  }

  const { data: rest } = await db.from("harvest_tasks").select("key,source,status,found,error").eq("run_id", run).limit(5000);
  const tasks = (rest ?? []) as HarvestTask[];
  report.pending = tasks.filter((t) => t.status === "pending").length;
  if (report.pending === 0) {
    const ft = tasks.filter((t) => t.source === "francetravail");
    const ftComplete = ft.length > 0 && ft.every((t) => t.status === "done");
    if (ftComplete && startedAt) {
      const { data } = await db.rpc("close_unseen_offers", {
        p_source: "francetravail",
        p_since: startedAt,
        p_romes: EXTRA_ROMES,
        p_rome_prefix: "M18",
      });
      report.closed = Number(data) || 0;
    }
    report.expired = await expireOffers(db);
    const errors = tasks.filter((t) => t.status === "error");
    const counters: Record<string, number> = { tasks: tasks.length, errors: errors.length, closed: report.closed ?? 0, expired: report.expired };
    for (const source of ["francetravail", "adzuna", "ats"] as const) {
      const mine = tasks.filter((t) => t.source === source);
      if (!mine.length) continue;
      const found = mine.reduce((n, t) => n + (t.found ?? 0), 0);
      counters[source] = found;
      const failed = mine.filter((t) => t.status === "error");
      if (source !== "ats")
        await recordSourceRun(db, source, failed.length === mine.length ? classifyError(failed[0]?.error ?? "") : "ok", found, failed[0]?.error ?? null);
    }
    await db
      .from("harvest_runs")
      .update({ status: errors.length ? "partial" : "done", finished_at: new Date().toISOString(), counters })
      .eq("id", run);
    report.finished = true;
  }
  return report;
}
