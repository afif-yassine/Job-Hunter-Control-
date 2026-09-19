import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applicationMode, isSafeMode } from "@/lib/config";
import { queueQuestions } from "@/lib/question-store";
import type { IncomingQuestion } from "@/lib/questions";
const payload = z.object({
  applicationId: z.string().uuid(),
  action: z.enum(["inspect", "prepare"]),
});
export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase)
    return Response.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  // A missing APPLICATION_MODE means PREPARE_ONLY (the only mode that exists).
  // Only an explicit, different value is refused.
  if (!isSafeMode())
    return Response.json(
      {
        error: `Mode « ${applicationMode()} » refusé : seul PREPARE_ONLY est autorisé. Mets APPLICATION_MODE=PREPARE_ONLY dans Vercel (ou supprime la variable).`,
      },
      { status: 403 },
    );
  if (!process.env.WORKER_BASE_URL || !process.env.WORKER_SHARED_SECRET)
    return Response.json(
      {
        error:
          "Worker Playwright non configuré : ajoute WORKER_BASE_URL (URL publique Railway) et WORKER_SHARED_SECRET dans Vercel.",
      },
      { status: 503 },
    );
  const parsed = payload.safeParse(await req.json());
  if (!parsed.success)
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  const userId = String(data.claims.sub);
  const { data: application } = await supabase
    .from("applications")
    .select("id,job_id,jobs(official_url,source_url)")
    .eq("id", parsed.data.applicationId)
    .eq("user_id", userId)
    .single();
  if (!application)
    return Response.json({ error: "Application not found" }, { status: 404 });
  const jobs = application.jobs as unknown as {
    official_url: string | null;
    source_url: string | null;
  };
  const url = jobs?.official_url || jobs?.source_url;
  if (!url)
    return Response.json(
      { error: "No application URL configured" },
      { status: 409 },
    );
  const { data: run } = await supabase
    .from("agent_runs")
    .insert({
      user_id: userId,
      run_type: `PLAYWRIGHT_${parsed.data.action.toUpperCase()}`,
      status: "RUNNING",
      started_at: new Date().toISOString(),
      counters: { applicationId: application.id },
    })
    .select("id")
    .single();
  let response: Response;
  let body: {
    error?: string;
    state?: string;
    fields?: unknown[];
    questions?: IncomingQuestion[];
  };
  try {
    response = await fetch(`${process.env.WORKER_BASE_URL}/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.WORKER_SHARED_SECRET}`,
      },
      body: JSON.stringify({ ...parsed.data, url, mode: "PREPARE_ONLY" }),
      signal: AbortSignal.timeout(55_000),
    });
    body = await response.json().catch(() => ({
      error: `Réponse invalide du worker (${response.status})`,
    }));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "inconnue";
    if (run)
      await supabase
        .from("agent_runs")
        .update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          error_message: `Worker injoignable : ${detail}`,
        })
        .eq("id", run.id);
    return Response.json(
      { error: `Worker Playwright injoignable (${detail}). Vérifie WORKER_BASE_URL et que le service Railway est démarré.` },
      { status: 502 },
    );
  }
  if (run)
    await supabase
      .from("agent_runs")
      .update({
        status: response.ok
          ? body.state === "PAUSED"
            ? "PAUSED"
            : "COMPLETED"
          : "FAILED",
        finished_at: new Date().toISOString(),
        counters: {
          applicationId: application.id,
          fields: body.fields?.length || 0,
          questions: body.questions?.length || 0,
        },
        error_message: response.ok ? null : body.error,
      })
      .eq("id", run.id);
  // Deduplicated against the answer bank: only new questions block.
  let queued = { asked: 0, autoAnswered: 0, duplicates: 0 };
  if (response.ok && body.questions?.length) {
    try {
      queued = await queueQuestions(
        supabase,
        userId,
        application.id,
        body.questions,
      );
    } catch (error) {
      console.error("Could not store questions", error);
    }
  }
  await supabase.from("notifications").insert({
    user_id: userId,
    application_id: application.id,
    notification_type: queued.asked ? "ACTION_REQUIRED" : "FORM_PREPARED",
    title: queued.asked ? "Préparation Playwright interrompue" : "Formulaire inspecté",
    message: queued.asked
      ? `${queued.asked} question(s) nécessitent votre réponse${queued.autoAnswered ? ` (${queued.autoAnswered} déjà répondue(s) automatiquement)` : ""}. Aucun envoi n’a été effectué.`
      : `${body.fields?.length || 0} champ(s) détecté(s)${queued.autoAnswered ? `, ${queued.autoAnswered} réponse(s) reprise(s) de ta mémoire` : ""}. La soumission finale reste désactivée.`,
    action_url: url,
    delivery_channels: ["dashboard"],
  });
  return Response.json(
    { ...body, questionStats: queued },
    { status: response.status },
  );
}
