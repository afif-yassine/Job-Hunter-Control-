import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { FEATURES, feature } from "../lib/roadmap";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : [],
  );
}

test("every « Bientôt » card points at a feature of the roadmap (a typo would crash the page)", () => {
  const used = tsxFiles("components").flatMap((f) => [...readFileSync(f, "utf8").matchAll(/<Soon id="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(used.length >= 3);
  for (const id of used) assert.doesNotThrow(() => feature(id), id);
  const ids = FEATURES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  // A feature still to come always says in which sprint.
  for (const f of FEATURES) if (f.state !== "done") assert.ok(f.sprint, f.id);
});
