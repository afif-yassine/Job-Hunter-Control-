import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeText } from "@/lib/questions";
import type { ScannedOffer } from "./types";

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

function city(location: string | null | undefined) {
  const first = (location || "").split(/[,(]/)[0];
  return normalizeText(first)
    .replace(/\b(cedex|arrondissement|er|eme|e)\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** company | title | city, accents/case/punctuation insensitive. */
export function fingerprintOf(o: {
  company: string;
  title: string;
  location?: string | null;
}) {
  return [normalizeText(o.company), normalizeText(o.title), city(o.location)].join("|");
}

export type IngestResult = {
  inserted: number;
  duplicates: number;
  needsDescription: number;
  error?: string;
};

export async function ingestOffers(
  supabase: SupabaseClient,
  userId: string,
  offers: ScannedOffer[],
): Promise<IngestResult> {
  const result: IngestResult = { inserted: 0, duplicates: 0, needsDescription: 0 };
  if (!offers.length) return result;

  const { data: existing, error } = await supabase
    .from("jobs")
    .select("company,title,location,source_url,official_url")
    .eq("user_id", userId)
    .limit(5000);
  if (error) return { ...result, error: error.message };

  const seenFingerprints = new Set<string>();
  const seenUrls = new Set<string>();
  for (const row of existing ?? []) {
    seenFingerprints.add(fingerprintOf(row));
    for (const url of [row.source_url, row.official_url])
      if (url) seenUrls.add(canonicalUrl(url));
  }

  const rows: Record<string, unknown>[] = [];
  for (const offer of offers) {
    const url = canonicalUrl(offer.url);
    const apply = offer.applyUrl ? canonicalUrl(offer.applyUrl) : null;
    const unknownCompany = /^(à compléter|entreprise non communiquée)$/i.test(offer.company);
    // An offer without a known company can only be recognised by its URL.
    const fingerprint = unknownCompany ? `url|${url}` : fingerprintOf(offer);
    if (
      seenUrls.has(url) ||
      (apply && seenUrls.has(apply)) ||
      seenFingerprints.has(fingerprint)
    ) {
      result.duplicates += 1;
      continue;
    }
    seenUrls.add(url);
    if (apply) seenUrls.add(apply);
    seenFingerprints.add(fingerprint);
    if (!offer.description) result.needsDescription += 1;
    rows.push({
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
    });
  }

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    let { error: insertError } = await supabase.from("jobs").insert(chunk);
    if (insertError) {
      // Retry with only the columns the manual "Ajouter une offre" form uses, in
      // case an optional column (source_platform, publication_date) is constrained.
      const minimal = chunk.map((row) => {
        const rest = { ...row };
        delete rest.source_platform;
        delete rest.publication_date;
        return rest;
      });
      ({ error: insertError } = await supabase.from("jobs").insert(minimal));
    }
    if (insertError) return { ...result, error: insertError.message };
    result.inserted += chunk.length;
  }
  return result;
}
