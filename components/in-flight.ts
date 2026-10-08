/**
 * A synchronous guard against a double click. The `busy` state of the dashboard
 * only disables a button after React has re-rendered: two clicks in the same
 * tick both start. Here the key is taken before anything else happens, and it is
 * released in a `finally`, so a failure never blocks the student until a reload.
 *
 * The key is made of the action and the offer ("kit:<id>"): writing the kit of
 * one offer never blocks another action, nor the same action on another offer.
 */
export function createInflightGuard() {
  const active = new Set<string>();
  return {
    has: (key: string) => active.has(key),
    /** Runs `work` unless the same key is already running. Resolves true when it ran. Errors still reach the caller. */
    async run(key: string, work: () => Promise<unknown>): Promise<boolean> {
      if (active.has(key)) return false;
      active.add(key);
      try {
        await work();
        return true;
      } finally {
        active.delete(key);
      }
    },
  };
}
