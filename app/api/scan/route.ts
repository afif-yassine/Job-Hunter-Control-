import { createClient } from "@/lib/supabase/server";

/**
 * Starts the external offer scanner. The scanner stays outside the dashboard
 * so search credentials and scraping rules are never exposed to the browser.
 * Configure SCAN_WEBHOOK_URL with the protected worker/automation endpoint.
 */
export async function POST() {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const endpoint = process.env.SCAN_WEBHOOK_URL;
  if (!endpoint) {
    return Response.json(
      { error: "Le scanner n’est pas encore connecté. Ajoutez SCAN_WEBHOOK_URL dans Vercel." },
      { status: 503 },
    );
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.SCAN_WEBHOOK_SECRET || ""}` },
    body: JSON.stringify({ user_id: data.claims.sub, mode: "PREPARE_ONLY" }),
  });
  if (!response.ok) return Response.json({ error: "Le scanner a refusé la demande." }, { status: 502 });
  return Response.json({ message: "Scan lancé. Les nouvelles offres apparaîtront dans le dashboard." });
}
