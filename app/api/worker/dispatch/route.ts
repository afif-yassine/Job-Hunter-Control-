import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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
  if (process.env.APPLICATION_MODE !== "PREPARE_ONLY")
    return Response.json({ error: "Unsafe mode rejected" }, { status: 403 });
  if (!process.env.WORKER_BASE_URL || !process.env.WORKER_SHARED_SECRET)
    return Response.json({ error: "Worker not configured" }, { status: 503 });
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
  const response = await fetch(`${process.env.WORKER_BASE_URL}/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.WORKER_SHARED_SECRET}`,
    },
    body: JSON.stringify({ ...parsed.data, url, mode: "PREPARE_ONLY" }),
  });
  const body = await response.json();
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
  if (response.ok && body.questions?.length)
    await supabase
      .from("application_questions")
      .insert(
        body.questions.map((q: { question: string; category: string }) => ({
          user_id: userId,
          application_id: application.id,
          question: q.question,
          category: q.category,
          blocking: true,
          approved: false,
        })),
      );
  await supabase.from("notifications").insert({
    user_id: userId,
    application_id: application.id,
    notification_type: body.questions?.length ? "ACTION_REQUIRED" : "FORM_PREPARED",
    title: body.questions?.length ? "Préparation Playwright interrompue" : "Formulaire inspecté",
    message: body.questions?.length
      ? `${body.questions.length} blocage(s) nécessitent votre intervention. Aucun envoi n’a été effectué.`
      : `${body.fields?.length || 0} champ(s) détecté(s). La soumission finale reste désactivée.`,
    action_url: url,
    delivery_channels: ["dashboard"],
  });
  return Response.json(body, { status: response.status });
}
