/**
 * Simulates the daily selection (lib/unlock-select.ts) on an EXPORT, to recalibrate the threshold
 * before the feature runs on real accounts. Reads a file, calls nothing: no database, no AI, no network.
 *
 *   npx tsx tools/simulate-daily-unlock.ts export.json [days=1,5,10] [minCommon=2]
 *
 * export.json (anonymised: no name, no e-mail, no CV text):
 * {
 *   "profiles": [{ "name": "profil-A", "skills": ["python","sql"], "contracts": ["alternance"] }],
 *   "offers": [{ "id": "o1", "title": "…", "kind": "alternance", "skills": ["python","docker"],
 *                "publishedAt": "2026-10-01", "similarity": { "profil-A": 0.71 } }]
 * }
 * `similarity` is the cosine similarity of each profile with the offer (null/absent = no vector).
 * The export is the owner's to produce; this tool never fetches anything.
 */
import { readFileSync } from "node:fs";
import { fitScore } from "../lib/fit";
import { DAILY_LIMIT, MIN_COMMON_SKILLS, commonSkills, selectDaily, type UnlockCandidate } from "../lib/unlock-select";

type Profile = { name: string; skills: string[]; contracts?: string[] };
type OfferRow = { id: string; title?: string; kind?: string | null; skills?: string[]; publishedAt?: string | null; similarity?: Record<string, number | null> };
type Input = { profiles: Profile[]; offers: OfferRow[] };

export function simulate(input: Input, days: number[], minCommon = MIN_COMMON_SKILLS) {
  const last = Math.max(...days);
  return input.profiles.map((profile) => {
    const unlocked = new Set<string>();
    const out: { day: number; lot: { rank: number; id: string; title: string; similarity: number | null; score: number | null; common: number }[]; reason?: string }[] = [];
    for (let day = 1; day <= last; day++) {
      const candidates: UnlockCandidate[] = input.offers.map((o) => ({
        id: o.id,
        similarity: o.similarity?.[profile.name] ?? null,
        skills: o.skills ?? [],
        kind: o.kind ?? null,
        publishedAt: o.publishedAt ?? null,
      }));
      const selection = selectDaily({ candidates, profileSkills: profile.skills, contracts: profile.contracts ?? [], unlocked, minCommon });
      for (const pick of selection.chosen) unlocked.add(pick.id);
      if (days.includes(day))
        out.push({
          day,
          reason: selection.reason,
          lot: selection.chosen.map((pick) => {
            const offer = input.offers.find((o) => o.id === pick.id)!;
            const common = commonSkills(offer.skills ?? [], profile.skills);
            const missing = (offer.skills ?? []).filter((s) => !common.includes(s));
            return { rank: pick.rank, id: pick.id, title: offer.title ?? pick.id, similarity: pick.similarity, score: fitScore(pick.similarity, common, missing)?.score ?? null, common: common.length };
          }),
        });
    }
    return { profile: profile.name, days: out };
  });
}

if (process.argv[1] && /simulate-daily-unlock/.test(process.argv[1])) {
  const [file, daysArg, minArg] = process.argv.slice(2);
  if (!file) {
    console.error("Usage : npx tsx tools/simulate-daily-unlock.ts export.json [jours=1,5,10] [minCommon=2]");
    process.exit(1);
  }
  const input = JSON.parse(readFileSync(file, "utf8")) as Input;
  const days = (daysArg ?? "1,5,10").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  for (const result of simulate(input, days, minArg ? Number(minArg) : MIN_COMMON_SKILLS)) {
    console.log(`\n=== ${result.profile} ===`);
    for (const d of result.days) {
      console.log(`Jour ${d.day} : ${d.lot.length}/${DAILY_LIMIT} offres${d.reason ? ` (${d.reason})` : ""}`);
      for (const o of d.lot) console.log(`  #${o.rank} ${o.title.slice(0, 60)} | similarité ${o.similarity?.toFixed(3) ?? "—"} | score ${o.score ?? "—"} | compétences communes ${o.common}`);
    }
  }
}
