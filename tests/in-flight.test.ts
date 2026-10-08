import assert from "node:assert/strict";
import { test } from "node:test";
import { createInflightGuard } from "../components/in-flight";

/** A call that stays open until the test lets it finish. */
function pending() {
  let finish!: () => void;
  let fail!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}

test("a second call with the same key is ignored while the first one is running", async () => {
  const guard = createInflightGuard();
  const first = pending();
  let started = 0;
  const one = guard.run("kit:job-1", () => (started++, first.promise));
  // Same tick: nothing has been rendered yet, the key is already taken.
  const two = guard.run("kit:job-1", () => (started++, Promise.resolve()));
  assert.equal(await two, false);
  assert.equal(started, 1);
  assert.equal(guard.has("kit:job-1"), true);
  first.finish();
  assert.equal(await one, true);
  assert.equal(started, 1);
});

test("the key is released after a success, so the action can run again", async () => {
  const guard = createInflightGuard();
  assert.equal(await guard.run("kit:job-1", async () => undefined), true);
  assert.equal(guard.has("kit:job-1"), false);
  assert.equal(await guard.run("kit:job-1", async () => undefined), true);
});

test("the key is released after a failure that the work reports itself", async () => {
  const guard = createInflightGuard();
  const result = { ok: true };
  assert.equal(await guard.run("kit:job-1", async () => { result.ok = false; }), true);
  assert.equal(result.ok, false);
  assert.equal(guard.has("kit:job-1"), false);
  assert.equal(await guard.run("kit:job-1", async () => undefined), true);
});

test("the key is released after an exception, which still reaches the caller", async () => {
  const guard = createInflightGuard();
  const boom = pending();
  const call = guard.run("kit:job-1", () => boom.promise);
  boom.fail(new Error("réseau coupé"));
  await assert.rejects(call, /réseau coupé/);
  assert.equal(guard.has("kit:job-1"), false);
  assert.equal(await guard.run("kit:job-1", async () => undefined), true);
  // An exception thrown before the first await is released too.
  await assert.rejects(guard.run("kit:job-1", () => { throw new Error("tout de suite"); }), /tout de suite/);
  assert.equal(guard.has("kit:job-1"), false);
});

test("another offer or another action is never blocked", async () => {
  const guard = createInflightGuard();
  const first = pending();
  const one = guard.run("kit:job-1", () => first.promise);
  assert.equal(await guard.run("kit:job-2", async () => undefined), true);
  assert.equal(await guard.run("dismiss:job-1", async () => undefined), true);
  assert.equal(guard.has("kit:job-1"), true);
  first.finish();
  await one;
});
