import { parseAtsTarget, targetKey, type AtsId } from "./sources/ats";

/**
 * Companies offered as one-click suggestions in "Entreprises à surveiller":
 * a normal user does not know which recruitment platform a company uses, nor
 * where its careers feed lives. Each board below was checked on its public API
 * (Sept 2026: real board, at least one job located in France). Boards change:
 * a company that leaves its platform simply shows up as an error in the
 * sources health, it never breaks a scan.
 */
export type SuggestedTarget = {
  name: string;
  ats: AtsId;
  slug: string;
  /** Had internship / apprenticeship offers in France when checked. */
  juniors?: boolean;
};

export const SUGGESTED_TARGETS: SuggestedTarget[] = [
  { name: "Doctolib", ats: "greenhouse", slug: "doctolib", juniors: true },
  { name: "Datadog", ats: "greenhouse", slug: "datadog", juniors: true },
  { name: "Dataiku", ats: "greenhouse", slug: "dataiku", juniors: true },
  { name: "Helsing", ats: "greenhouse", slug: "helsing", juniors: true },
  { name: "Algolia", ats: "greenhouse", slug: "algolia" },
  { name: "Mirakl", ats: "greenhouse", slug: "mirakl" },
  { name: "Shift Technology", ats: "greenhouse", slug: "shifttechnology" },
  { name: "Back Market", ats: "ashby", slug: "backmarket", juniors: true },
  { name: "Alan", ats: "ashby", slug: "alan", juniors: true },
  { name: "Ledger", ats: "ashby", slug: "ledger", juniors: true },
  { name: "Sorare", ats: "ashby", slug: "sorare", juniors: true },
  { name: "Nabla", ats: "ashby", slug: "nabla", juniors: true },
  { name: "Qonto", ats: "ashby", slug: "qonto" },
  { name: "Pennylane", ats: "ashby", slug: "pennylane" },
  { name: "Photoroom", ats: "ashby", slug: "photoroom" },
  { name: "Dust", ats: "ashby", slug: "dust" },
  { name: "lemlist", ats: "ashby", slug: "lemlist" },
  { name: "Ankorstore", ats: "ashby", slug: "ankorstore" },
  { name: "H Company", ats: "ashby", slug: "hcompany" },
  { name: "BlaBlaCar", ats: "lever", slug: "blablacar" },
  { name: "Swile", ats: "lever", slug: "swile" },
  { name: "Malt", ats: "lever", slug: "malt" },
  { name: "Aircall", ats: "lever", slug: "aircall" },
  { name: "Contentsquare", ats: "lever", slug: "contentsquare" },
  { name: "Agicap", ats: "lever", slug: "agicap" },
  { name: "Vestiaire Collective", ats: "lever", slug: "vestiairecollective" },
];

const BOARD_URL: Partial<Record<AtsId, (slug: string) => string>> = {
  greenhouse: (s) => `https://job-boards.greenhouse.io/${s}`,
  lever: (s) => `https://jobs.lever.co/${s}`,
  ashby: (s) => `https://jobs.ashbyhq.com/${s}`,
};

/** The careers page link written in the list (readable, and what the user would paste). */
export function suggestionLine(s: SuggestedTarget): string {
  return BOARD_URL[s.ats]?.(s.slug) ?? `${s.ats}:${s.slug}`;
}

/** Suggestions not already in the user's list (same board = same key, whatever the link form). */
export function remainingSuggestions(lines: string[]): SuggestedTarget[] {
  const taken = new Set(
    lines.map((l) => parseAtsTarget(l)).flatMap((t) => (t ? [targetKey(t)] : [])),
  );
  return SUGGESTED_TARGETS.filter((s) => !taken.has(`${s.ats}:${s.slug}`));
}
