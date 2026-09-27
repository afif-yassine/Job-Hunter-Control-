/** Asks the Railway worker whether it is up and its browser is installed. */
export async function workerState(): Promise<{ online: boolean; browserReady: boolean | null }> {
  const base = process.env.WORKER_BASE_URL?.replace(/\/+$/, "");
  if (!base) return { online: false, browserReady: null };
  try {
    const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return { online: false, browserReady: null };
    const body = (await response.json().catch(() => ({}))) as { browserReady?: boolean };
    return { online: true, browserReady: typeof body.browserReady === "boolean" ? body.browserReady : null };
  } catch {
    return { online: false, browserReady: null };
  }
}
