import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { answerQuestion } from "@/lib/question-store";

const body = z.object({
  answer: z.string().trim().min(1).max(4000),
  /** Reuse this answer for every future (and current) identical question. */
  remember: z.boolean().default(true),
  expires_at: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Réponse invalide ou vide." }, { status: 400 });
  const { id } = await params;
  const outcome = await answerQuestion(auth.supabase, auth.userId, id, parsed.data);
  if (!outcome.ok)
    return Response.json({ error: outcome.error }, { status: outcome.status });
  return Response.json(outcome);
}
