import { z } from "zod";
import { authenticatedClient } from "@/lib/api";

const input = z.object({ available: z.boolean() });

/**
 * "Offre plus disponible" (available: false): the offer leaves the account's
 * lists and is reported to the shared catalogue — ten reports from different
 * accounts close it for everybody. available: true puts it back.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const { id } = await params;

  if (!parsed.data.available) {
    const { data, error } = await auth.supabase.rpc("report_offer_gone", { p_job: id });
    if (error) {
      const notFound = /job not found/i.test(error.message);
      return Response.json(
        { error: notFound ? "Offre introuvable." : `Signalement impossible : ${error.message}` },
        { status: notFound ? 404 : 400 },
      );
    }
    return Response.json({
      message:
        data === "closed"
          ? "Merci : 10 candidats l’ont signalée, elle est retirée pour tout le monde."
          : "Merci : l’offre est rangée dans « Plus disponibles ». Rien ne sera plus dépensé dessus.",
    });
  }

  const { data, error } = await auth.supabase
    .from("jobs")
    .update({ gone_reason: null, gone_at: null })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id");
  if (error) return Response.json({ error: error.message }, { status: 400 });
  if (!data?.length) return Response.json({ error: "Offre introuvable." }, { status: 404 });
  return Response.json({ message: "Offre remise dans ta liste." });
}
