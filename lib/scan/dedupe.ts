import { normalizeText } from "@/lib/questions";

/**
 * Recognising the same offer published on several platforms.
 *
 * Level 1 — same link (handled by the caller with canonical URLs).
 * Level 2 — same fingerprint: company + title + city + contract, all normalised.
 * Level 3 — similar text: trigram similarity of the titles (same idea as
 *           Postgres pg_trgm), then word-shingle similarity of the descriptions.
 */

const LEGAL =
  /\b(sas|sasu|sa|sarl|eurl|sca|snc|inc|ltd|llc|gmbh|ag|bv|nv|plc|corp|corporation|company|co|group|groupe|holding|france|fr|the)\b/g;

export function normalizeCompany(company: string | null | undefined): string {
  return normalizeText(company || "")
    .replace(LEGAL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TITLE_NOISE = new Set(
  (
    "h f x hf fh m w mf fm hfx fhx alternance alternant alternante apprentissage apprenti apprentie " +
    "apprentice apprenticeship trainee stage stagiaire internship intern cdd cdi contrat pro professionnalisation poste offre " +
    "en de d du des la le les l un une et a au aux pour with for of in to at " +
    "mois month months an ans year years semaines temps plein partiel full part time rentree septembre " +
    "janvier fevrier mars avril mai juin juillet aout octobre novembre decembre"
  ).split(" "),
);

export function normalizeTitle(title: string | null | undefined): string {
  return normalizeText(title || "")
    .split(" ")
    .filter((t) => t && !TITLE_NOISE.has(t) && !/^\d+$/.test(t))
    .join(" ");
}

/** First place name of a location: "75 - PARIS 08" → "paris", "Saint-Denis, IDF" → "saint denis". */
export function normalizeCity(location: string | null | undefined): string {
  for (const part of (location || "").split(/[,(/]| - /)) {
    const city = normalizeText(part)
      .replace(/\b(cedex|arrondissement|er|eme|e)\b/g, " ")
      .replace(/\d+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (city) return city;
  }
  return "";
}

/** "alternance" | "stage" | "" — an internship and an apprenticeship are different offers. */
export function contractKind(title: string | null | undefined, contract?: string | null): string {
  const text = normalizeText(`${title || ""} ${contract || ""}`);
  if (/\b(alternan\w*|apprenti\w*|apprentissage|professionnalisation)\b/.test(text)) return "alternance";
  if (/\b(stage|stagiaire|internship|intern)\b/.test(text)) return "stage";
  return "";
}

export type OfferKey = {
  company: string;
  title: string;
  location?: string | null;
  contract_type?: string | null;
};

/** company | title | city | contract, accents/case/noise insensitive. */
export function fingerprintOf(o: OfferKey): string {
  return [
    normalizeCompany(o.company),
    normalizeTitle(o.title),
    normalizeCity(o.location),
    contractKind(o.title, o.contract_type),
  ].join("|");
}

export function sameCompany(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // "capgemini" vs "capgemini engineering", "bnp paribas" vs "bnp paribas cardif".
  return a.startsWith(`${b} `) || b.startsWith(`${a} `);
}

function trigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (const word of text.split(" ").filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i += 1) grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** Title similarity, 0..1 (pg_trgm-style). */
export function titleSimilarity(a: string, b: string): number {
  return jaccard(trigrams(normalizeTitle(a)), trigrams(normalizeTitle(b)));
}

function shingles(text: string): Set<string> {
  const words = normalizeText(text).split(" ").filter((w) => w.length > 2).slice(0, 400);
  const out = new Set<string>();
  for (let i = 0; i < words.length - 2; i += 1) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
}

/** Description similarity, 0..1; null when either text is too short to judge. */
export function descriptionSimilarity(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b || a.length < 200 || b.length < 200) return null;
  return jaccard(shingles(a), shingles(b));
}

export type Candidate = OfferKey & { id: string; description?: string | null };

export type Match =
  | { kind: "same"; id: string; why: string }
  | { kind: "probable"; id: string; why: string };

/**
 * Compares a new offer with known offers of the same company.
 * `same` = merge into the existing offer; `probable` = new offer, flagged for
 * the user to decide. Offers of an unknown company are never fuzzy-matched.
 */
export function fuzzyMatch(
  offer: OfferKey & { description?: string | null },
  known: Candidate[],
  /** Offers already applied to: a looser match is enough to warn the user. */
  applied: Set<string> = new Set(),
): Match | null {
  const company = normalizeCompany(offer.company);
  if (!company || /^(a completer|entreprise non communiquee)$/.test(company)) return null;
  const kind = contractKind(offer.title, offer.contract_type);
  const city = normalizeCity(offer.location);
  let best: Match | null = null;
  let bestScore = 0;
  for (const other of known) {
    if (!sameCompany(company, normalizeCompany(other.company))) continue;
    const otherKind = contractKind(other.title, other.contract_type);
    if (kind && otherKind && kind !== otherKind) continue;
    const otherCity = normalizeCity(other.location);
    const cityOk = !city || !otherCity || city === otherCity;
    const ts = titleSimilarity(offer.title, other.title);
    if (ts < 0.55) continue;
    let verdict: Match | null = null;
    if (ts >= 0.85 && cityOk) verdict = { kind: "same", id: other.id, why: "même entreprise, même intitulé" };
    else {
      const ds = descriptionSimilarity(offer.description, other.description);
      if (ds !== null && ds >= 0.6) verdict = { kind: "same", id: other.id, why: "même entreprise, même description" };
      else if (ds !== null && ds < 0.3) verdict = null;
      else if (ds !== null || ts >= 0.7 || applied.has(other.id))
        verdict = { kind: "probable", id: other.id, why: "même entreprise, intitulé très proche" };
    }
    const score = ts + (verdict?.kind === "same" ? 1 : 0);
    if (verdict && score > bestScore) {
      best = verdict;
      bestScore = score;
    }
  }
  return best;
}
