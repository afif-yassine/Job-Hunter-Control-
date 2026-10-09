import { authenticatedClient } from "@/lib/api";
import { runHarvestSlice } from "@/lib/scan/harvest";
import { serviceClient } from "@/lib/supabase/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function admin() {
  const auth = await authenticatedClient();
  if ("error" in auth) return { error: auth.error };
  const { data: isAdmin } = await auth.supabase.rpc("is_admin");
  if (isAdmin !== true) return { error: Response.json({ error: "Réservé à l’administrateur." }, { status: 403 }) };
  const db = serviceClient();
  if (!db) return { error: Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante dans Vercel." }, { status: 503 }) };
  return { db };
}

/** Last runs and their tasks, for the Admin page. */
export async function GET() {
  const a = await admin();
  if ("error" in a) return a.error;
  const { data: runs } = await a.db.from("harvest_runs").select("*").order("started_at", { ascending: false }).limit(5);
  const latest = (runs ?? [])[0] as { id: string } | undefined;
  let tasks: Record<string, number> = {};
  let errors: { key: string; error: string | null }[] = [];
  if (latest) {
    const { data } = await a.db.from("harvest_tasks").select("key,status,error").eq("run_id", latest.id).limit(5000);  // real cap: 1 000 rows per request
    const rows = (data ?? []) as { key: string; status: string; error: string | null }[];
    tasks = rows.reduce<Record<string, number>>((acc, t) => ((acc[t.status] = (acc[t.status] ?? 0) + 1), acc), {});
    errors = rows.filter((t) => t.status === "error").slice(0, 10);
  }
  const { count } = await a.db.from("offers").select("id", { count: "exact", head: true }).eq("status", "open");
  return Response.json({ runs: runs ?? [], tasks, errors, openOffers: count ?? 0 });
}

/** "Avancer la collecte": one slice now (≈ 45 s). */
export async function POST() {
  const a = await admin();
  if ("error" in a) return a.error;
  try {
    return Response.json(await runHarvestSlice(a.db));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Collecte impossible" }, { status: 500 });
  }
}
