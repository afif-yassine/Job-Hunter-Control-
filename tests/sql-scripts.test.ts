import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

// Scripts the owner may run by hand in production: they must stay safe to open and read.
const files = readdirSync("tools/sql").filter((name) => name.endsWith(".sql"));

test("the hand-run production scripts are labelled, roll back by default and hold no personal data", () => {
  assert.ok(files.includes("renormalize-skills.sql") && files.includes("remove-alert-offers-from-catalogue.sql"));
  for (const name of files) {
    const sql = readFileSync(`tools/sql/${name}`, "utf8");
    assert.match(sql, /NON EXÉCUTÉ/, `${name}: header`);
    assert.match(sql, /ROLLBACK par défaut/, `${name}: says it rolls back`);
    // The last real statement of the write step is a rollback, never a commit.
    const code = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
    const statements = code.split(";").map((s) => s.trim()).filter(Boolean);
    assert.equal(statements.filter((s) => /^commit$/i.test(s)).length, 0, `${name}: no active COMMIT`);
    assert.ok(statements.some((s) => /^rollback$/i.test(s)), `${name}: ends the write step with ROLLBACK`);
    // No e-mail address, no identifier, no real name.
    assert.doesNotMatch(sql, /[\w.+-]+@[\w-]+\.[\w.]+/, `${name}: e-mail address`);
    assert.doesNotMatch(sql, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, `${name}: identifier`);
    assert.doesNotMatch(sql, /yassine|afif/i, `${name}: owner's name`);
  }
});

test("the alert cleanup keeps what students touched and the administrator's own lines", () => {
  const sql = readFileSync("tools/sql/remove-alert-offers-from-catalogue.sql", "utf8");
  // Active lines only: the comments describe a more cautious variant that is not part of the script.
  const write = sql
    .slice(sql.indexOf("begin;"), sql.indexOf("rollback;"))
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join(" ");
  // Only untouched copies of non-administrators are deleted from jobs.
  assert.match(write, /delete from public\.jobs j\s+where j\.user_id not in \(select user_id from public\.app_admins\)/);
  assert.match(write, /j\.stage = 'new' and j\.notes is null/);
  assert.match(write, /not exists \(select 1 from public\.applications a where a\.job_id = j\.id\)/);
  assert.match(write, /not exists \(select 1 from public\.documents d where d\.job_id = j\.id\)/);
  // Only alert offers are deleted from the catalogue.
  assert.match(write, /delete from public\.offers where source like 'alert:%'/);
  assert.equal((write.match(/delete from/g) ?? []).length, 2);
});
