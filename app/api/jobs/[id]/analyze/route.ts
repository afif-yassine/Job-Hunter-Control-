import { authenticatedClient } from "@/lib/api";
import { analyzeJob } from "@/lib/pipeline/analyze";

export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedClient("ai");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const result = await analyzeJob({ supabase: auth.supabase, userId: auth.userId, jobId: id });
  return Response.json(result.body, { status: result.status });
}
