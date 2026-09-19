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
  needsDescription: number;
  configured: boolean;
};
