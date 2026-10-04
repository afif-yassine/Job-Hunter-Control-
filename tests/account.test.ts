import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPORT_TABLES, sameOrigin } from "../lib/account";

const req = (headers: Record<string, string>) => new Request("https://app.test/api/account", { method: "DELETE", headers });

test("account deletion only accepts requests from the site itself", () => {
  assert.equal(sameOrigin(req({ host: "app.test", origin: "https://app.test" })), true);
  assert.equal(sameOrigin(req({ host: "app.test", origin: "https://evil.test" })), false);
  assert.equal(sameOrigin(req({ host: "app.test" })), false);
  assert.equal(sameOrigin(req({ host: "app.test", origin: "null" })), false);
});

test("the data export never includes secrets or vectors", () => {
  for (const t of EXPORT_TABLES) {
    assert.doesNotMatch(t.columns, /secret|embedding/, t.table);
  }
  const integrations = EXPORT_TABLES.find((t) => t.table === "integrations");
  assert.ok(integrations && integrations.columns !== "*");
});
