import { z } from "zod";
import { authenticatedClient } from "@/lib/api";
import { reviewJob } from "@/lib/pipeline/review";

const input = z.object({
  action: z.enum(["keep", "merge", "dismiss", "applied_elsewhere"]),
  platform: z.string().trim().max(60).optional(),
  appliedAt: z.string().trim().max(40).optional(),
});

/** Decisions on an offer: keep it, merge a duplicate, dismiss it, or "already applied elsewhere". */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Action inconnue." }, { status: 400 });
  const { id } = await params;
  const result = await reviewJob({ supabase: auth.supabase, userId: auth.userId, jobId: id, ...parsed.data });
  return Response.json(result.body, { status: result.status });
}
