import assert from "node:assert/strict";
import { test } from "node:test";
import { simulate } from "../tools/simulate-daily-unlock";
import { DAILY_LIMIT, commonSkills, selectDaily, type UnlockCandidate } from "../lib/unlock-select";

const offer = (id: string, over: Partial<UnlockCandidate> = {}): UnlockCandidate => ({
  id, similarity: 0.6, skills: ["python", "sql", "docker"], kind: "alternance", publishedAt: "2026-10-01", ...over,
});
const base = { profileSkills: ["Python", "SQL", "Git"], contracts: ["alternance"], unlocked: new Set<string>() };

test("SELECT — at most 8, best meaning first, then more skills in common, then fresher", () => {
  const candidates = Array.from({ length: 12 }, (_, i) => offer(`o${i}`, { similarity: 0.5 + i / 100 }));
  const picked = selectDaily({ ...base, candidates });
  assert.equal(picked.chosen.length, DAILY_LIMIT);
  assert.deepEqual(picked.chosen.map((p) => p.id), ["o11", "o10", "o9", "o8", "o7", "o6", "o5", "o4"]);
  assert.deepEqual(picked.chosen.map((p) => p.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
  // Same similarity: more skills in common wins, then the more recent offer, then the id.
  const tie = selectDaily({
    ...base, profileSkills: ["python", "sql", "docker"],
    candidates: [offer("b", { skills: ["python", "sql"] }), offer("a", { skills: ["python", "sql", "docker"] }), offer("c", { skills: ["python", "sql"], publishedAt: "2026-10-05" })],
  });
  assert.deepEqual(tie.chosen.map((p) => p.id), ["a", "c", "b"]);
  // The limit can be lowered, never raised above 8.
  assert.equal(selectDaily({ ...base, candidates, limit: 3 }).chosen.length, 3);
  assert.equal(selectDaily({ ...base, candidates, limit: 50 }).chosen.length, 8);
});

test("SELECT — never fills up with bad offers: wrong contract, unread, fewer than 2 skills in common are left out", () => {
  const picked = selectDaily({
    ...base,
    candidates: [
      offer("good"),
      offer("cdi", { kind: "cdi" }),
      offer("no-kind", { kind: null }),
      offer("unread", { skills: [] }),
      offer("only-qualities", { skills: ["rigueur", "autonomie"] }),
      offer("one-common", { skills: ["python", "rust", "go"] }),
      offer("zero-common", { skills: ["cobol", "fortran"] }),
    ],
  });
  assert.deepEqual(picked.chosen.map((p) => p.id), ["good"]);
  assert.deepEqual([picked.wrongContract, picked.unread, picked.fewCommonSkills], [2, 2, 2]);
  assert.equal(picked.reason, undefined);
  // Nothing above the threshold is said, not hidden.
  const none = selectDaily({ ...base, candidates: [offer("cdi", { kind: "cdi" }), offer("one", { skills: ["python"] })] });
  assert.deepEqual([none.chosen.length, none.reason], [0, "NONE_ABOVE_THRESHOLD"]);
  assert.equal(selectDaily({ ...base, candidates: [] }).reason, "NO_CANDIDATES");
  // No contract chosen = any contract.
  assert.deepEqual(selectDaily({ ...base, contracts: [], candidates: [offer("cdi", { kind: "cdi" })] }).chosen.map((p) => p.id), ["cdi"]);
});

test("SELECT — personal qualities and spelling do not count as skills in common; an offer without vector can still qualify, after the others", () => {
  assert.deepEqual(commonSkills(["Python", "rigueur", "SQL ", "Docker 24"], ["python", "docker", "Rigueur"]), ["python", "docker"]);
  const picked = selectDaily({ ...base, candidates: [offer("novec", { similarity: null }), offer("vec", { similarity: 0.4 })] });
  assert.deepEqual(picked.chosen.map((p) => p.id), ["vec", "novec"]);
});

test("SELECT — an offer already unlocked is never picked again, so each day brings new ones until the pool is empty", () => {
  const candidates = Array.from({ length: 11 }, (_, i) => offer(`o${i}`, { similarity: 0.9 - i / 100 }));
  const unlocked = new Set<string>();
  const days: string[][] = [];
  for (let d = 0; d < 3; d++) {
    const picked = selectDaily({ ...base, candidates, unlocked });
    picked.chosen.forEach((p) => unlocked.add(p.id));
    days.push(picked.chosen.map((p) => p.id));
  }
  assert.deepEqual(days.map((d) => d.length), [8, 3, 0]);
  assert.equal(new Set(days.flat()).size, 11);
});

test("SIMULATE — the tool runs the selection day by day for each profile without touching anything", () => {
  const result = simulate({
    profiles: [{ name: "A", skills: ["python", "sql"], contracts: ["alternance"] }, { name: "B", skills: ["comptabilite", "excel"], contracts: ["stage"] }],
    offers: [
      { id: "1", title: "Data", kind: "alternance", skills: ["python", "sql"], similarity: { A: 0.7, B: 0.3 } },
      { id: "2", title: "Compta", kind: "stage", skills: ["comptabilite", "excel", "sap"], similarity: { A: 0.2, B: 0.8 } },
    ],
  }, [1, 2]);
  assert.deepEqual(result.map((r) => r.days[0].lot.map((l) => l.id)), [["1"], ["2"]]);
  assert.equal(result[0].days[1].lot.length, 0);
  assert.equal(result[0].days[1].reason, "NONE_ABOVE_THRESHOLD"); // the stage offer is left: wrong contract
  assert.ok((result[0].days[0].lot[0].score ?? 0) > 0);
});
