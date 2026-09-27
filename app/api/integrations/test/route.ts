import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { loadIntegrationEnv } from "@/lib/integrations";
import { providerById } from "@/lib/providers";
import type { ScanConfig } from "@/lib/scan/config";
import { scanAdzuna } from "@/lib/scan/sources/adzuna";
import { scanFranceTravail } from "@/lib/scan/sources/francetravail";
import { scanGmailAlerts } from "@/lib/scan/sources/gmail";
import { scanJooble } from "@/lib/scan/sources/jooble";
import { scanJSearch } from "@/lib/scan/sources/jsearch";
import type { ScannedOffer } from "@/lib/scan/types";

export const maxDuration = 30;

const body = z.object({ provider: z.string().min(1).max(40) });

/** One tiny search to check that a saved key really works. */
export async function POST(req: Request) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  const provider = parsed.success ? providerById(parsed.data.provider) : undefined;
  if (!provider) return Response.json({ error: "Source inconnue." }, { status: 400 });

  const env = { ...process.env, ...(await loadIntegrationEnv(auth.supabase, auth.userId)) };
  if (!provider.fields.every((f) => env[f.key]?.trim()))
    return Response.json({ ok: false, error: "Clé non enregistrée." }, { status: 400 });

  const probe: ScanConfig = {
    queries: [{ keywords: "alternance développeur" }],
    departments: ["75"],
    city: "Paris",
    targets: [],
    maxAgeDays: 30,
  };
  try {
    let offers: ScannedOffer[];
    if (provider.id === "jsearch") offers = await scanJSearch(probe, env);
    else if (provider.id === "adzuna") offers = await scanAdzuna(probe, env);
    else if (provider.id === "francetravail") offers = await scanFranceTravail(probe, env);
    else if (provider.id === "jooble") offers = await scanJooble(probe, env);
    else offers = await scanGmailAlerts(env, 7);
    return Response.json({
      ok: true,
      count: offers.length,
      sample: offers.slice(0, 3).map((o) => `${o.title} — ${o.company}`),
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Test impossible.",
    });
  }
}
