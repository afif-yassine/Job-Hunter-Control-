export type ScannedOffer = {
  /** Where the offer was found: "francetravail", "gmail:linkedin"... */
  source: string;
  company: string;
  title: string;
  location: string | null;
  contract_type: string | null;
  /** Full text when the source provides it (needed for Gemini scoring). */
  description: string | null;
  /** Link to the offer page. */
  url: string;
  /** Direct application link when different from `url`. */
  applyUrl?: string | null;
  publishedAt: string | null;
  /** ROME code (France Travail taxonomy), when the source provides one. */
  romeCode?: string | null;
  /** Other application links (JSearch lists the same offer on several sites). */
  links?: string[];
};

export type SourceReport = {
  source: string;
  status: "ok" | "skipped" | "error";
  /** Offers returned by the source, before filtering and de-duplication. */
  found: number;
  message?: string;
};

export type ScanSummary = {
  reports: SourceReport[];
  found: number;
  relevant: number;
  inserted: number;
  duplicates: number;
  /** Seen again on another platform, and you had already applied to it. */
  alreadyApplied: number;
  /** New offers waiting in "À vérifier" (probable duplicate, already applied). */
  toReview: number;
  /** New offers waiting in "À vérifier" as possible scams. */
  suspected: number;
  needsDescription: number;
  configured: boolean;
  /** Companies found on a recruitment platform during this scan, now followed. */
  discovered?: number;
};
