import type { SupabaseClient } from "@supabase/supabase-js";
import { fingerprintOf, fuzzyMatch, type Candidate } from "./dedupe";
import { detectSuspicion } from "./suspicion";
import type { ScannedOffer } from "./types";

export { fingerprintOf } from "./dedupe";

const TRACKING = /^(utm_|fbclid|gclid|mc_|trk|tracking|refid|ref$|src$|source$|from$)/i;

/** Same page, different tracking parameters → same URL. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (TRACKING.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** Statuses meaning "the user already applied to this offer". */
export const APPLIED_STATUSES = new Set(["APPLYING", "SUBMITTED", "CONFIRMED", "INTERVIEW", "REJECTED"]);

export type IngestResult = {
  inserted: number;
  /** Seen again (same link, same fingerprint or same text): links merged. */
  duplicates: number;
  /** Among the duplicates: offers you already applied to elsewhere. */
  alreadyApplied: number;
  /** New offers put in "À vérifier" (probable duplicate / already applied). */
  toReview: number;
  /** New offers put in "À vérifier" as possible scams. */
  suspected: number;
  needsDescription: number;
  error?: string;
};

type Pending = {
  temp: string;
  row: Record<string, unknown>;
  urls: string[];
  platform: string;
  /** Offer this one probably duplicates (may be another new offer). */
  dupRef: string | null;
};

const OPTIONAL_COLUMNS = ["review_flag", "review_reason", "duplicate_of", "source_platform", "publication_date"];

export async function ingestOffers(
  supabase: SupabaseClient,
  userId: string,
  offers: ScannedOffer[],
): Promise<IngestResult> {
  const result: IngestResult = {
    inserted: 0,
    duplicates: 0,
    alreadyApplied: 0,
    toReview: 0,
    suspected: 0,
    needsDescription: 0,
  };
  if (!offers.length) return result;

  const [jobsRes, sourcesRes, appsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,company,title,location,contract_type,status,source_url,official_url")
      .eq("user_id", userId)
      .limit(5000),
    supabase.from("job_sources").select("job_id,url").eq("user_id", userId).limit(20000),
    supabase.from("applications").select("job_id,status").eq("user_id", userId).limit(5000),
  ]);
  if (jobsRes.error) return { ...result, error: jobsRes.error.message };
  // Before the Phase 1 migration the table does not exist: keep working without it.
  const hasSources = !sourcesRes.error;

  const applied = new Set<string>();
  for (const a of (appsRes.data ?? []) as { job_id: string; status: string }[])
    if (APPLIED_STATUSES.has(a.status)) applied.add(a.job_id);

  const urlToJob = new Map<string, string>();
  const fpToJob = new Map<string, string>();
  const known: Candidate[] = [];
  type JobRow = Candidate & { status: string; source_url: string | null; official_url: string | null };
  for (const row of (jobsRes.data ?? []) as JobRow[]) {
    if (APPLIED_STATUSES.has(row.status)) applied.add(row.id);
    known.push(row);
    fpToJob.set(fingerprintOf(row), row.id);
    for (const url of [row.source_url, row.official_url]) if (url) urlToJob.set(canonicalUrl(url), row.id);
  }
  for (const s of (sourcesRes.data ?? []) as { job_id: string; url: string }[])
    urlToJob.set(canonicalUrl(s.url), s.job_id);

  const pending: Pending[] = [];
  const merges: { job: string; url: string; platform: string }[] = [];

  for (const offer of offers) {
    const url = canonicalUrl(offer.url);
    const apply = offer.applyUrl ? canonicalUrl(offer.applyUrl) : null;
    const unknownCompany = /^(à compléter|entreprise non communiquée)$/i.test(offer.company.trim());
    // An offer without a known company can only be recognised by its URL.
    const fingerprint = unknownCompany ? `url|${url}` : fingerprintOf(offer);

    let target = urlToJob.get(url) ?? (apply ? urlToJob.get(apply) : undefined);
    if (!target && !unknownCompany) target = fpToJob.get(fingerprint);
    const fuzzy = !target && !unknownCompany ? fuzzyMatch(offer, known, applied) : null;
    if (fuzzy?.kind === "same") target = fuzzy.id;

    if (target) {
      result.duplicates += 1;
      if (applied.has(target)) result.alreadyApplied += 1;
      merges.push({ job: target, url, platform: offer.source });
      if (apply && apply !== url) merges.push({ job: target, url: apply, platform: offer.source });
      continue;
    }

    let flag: string | null = null;
    let reason: string | null = null;
    const probable = fuzzy?.kind === "probable" ? fuzzy : null;
    if (probable) {
      const done = applied.has(probable.id);
      flag = done ? "ALREADY_APPLIED" : "PROBABLE_DUPLICATE";
      reason = done
        ? `Tu as déjà postulé à une offre très proche (${probable.why}).`
        : `Peut-être la même offre qu’une autre déjà trouvée (${probable.why}).`;
      result.toReview += 1;
    } else {
      const suspicion = detectSuspicion(offer);
      if (suspicion.level === "high") {
        flag = "SUSPECTED";
        reason = suspicion.reasons.join(" · ");
        result.suspected += 1;
      }
    }

    const temp = `new:${pending.length}`;
    pending.push({
      temp,
      platform: offer.source,
      urls: apply && apply !== url ? [url, apply] : [url],
      dupRef: probable?.id ?? null,
      row: {
        user_id: userId,
        company: offer.company,
        title: offer.title,
        contract_type: offer.contract_type,
        location: offer.location,
        description: offer.description,
        official_url: offer.applyUrl || offer.url,
        source_url: offer.url,
        source_platform: offer.source,
        publication_date: offer.publishedAt ? offer.publishedAt.slice(0, 10) : null,
        fingerprint,
        status: "DISCOVERED",
        review_flag: flag,
        review_reason: reason,
      },
    });
    urlToJob.set(url, temp);
    if (apply) urlToJob.set(apply, temp);
    fpToJob.set(fingerprint, temp);
    known.push({ id: temp, ...offer });
    if (!offer.description) result.needsDescription += 1;
  }

  // Insert the new offers ------------------------------------------------------
  const realId = new Map<string, string>();
  let stripOptional = false;
  const prepare = (p: Pending) => {
    const row: Record<string, unknown> = {
      ...p.row,
      duplicate_of: p.dupRef && !p.dupRef.startsWith("new:") ? p.dupRef : null,
    };
    if (stripOptional) for (const c of OPTIONAL_COLUMNS) delete row[c];
    return row;
  };
  const insert = async (batch: Pending[]) => {
    const { data, error } = await supabase.from("jobs").insert(batch.map(prepare)).select("id,fingerprint");
    if (!error) result.inserted += batch.length;
    if (!error)
      for (const r of (data ?? []) as { id: string; fingerprint: string }[]) {
        const p = batch.find((b) => b.row.fingerprint === r.fingerprint);
        if (p) realId.set(p.temp, r.id);
      }
    return error;
  };

  for (let i = 0; i < pending.length; i += 50) {
    const chunk = pending.slice(i, i + 50);
    let error = await insert(chunk);
    if (error && /column|schema cache|42703|PGRST204/i.test(`${error.code} ${error.message}`)) {
      // Database not migrated yet: store the offer without the new columns.
      stripOptional = true;
      error = await insert(chunk);
    }
    if (error && (error.code === "23505" || /duplicate key/i.test(error.message))) {
      // Another scan inserted one of them meanwhile: insert one by one.
      for (const p of chunk) {
        const single = await insert([p]);
        if (single && !(single.code === "23505" || /duplicate key/i.test(single.message)))
          return { ...result, error: single.message };
        if (single) result.duplicates += 1;
      }
      error = null;
    }
    if (error) return { ...result, error: error.message };
  }

  // Remember every link of every offer ----------------------------------------
  if (hasSources) {
    const resolve = (id: string) => (id.startsWith("new:") ? realId.get(id) : id);
    const rows: Record<string, unknown>[] = [];
    for (const p of pending) {
      const job = resolve(p.temp);
      if (job) for (const url of p.urls) rows.push({ user_id: userId, job_id: job, platform: p.platform, url });
    }
    for (const m of merges) {
      const job = resolve(m.job);
      if (job) rows.push({ user_id: userId, job_id: job, platform: m.platform, url: m.url });
    }
    for (let i = 0; i < rows.length; i += 200)
      await supabase
        .from("job_sources")
        .upsert(rows.slice(i, i + 200), { onConflict: "user_id,url", ignoreDuplicates: true });
  }
  return result;
}
