import { authenticatedClient } from "@/lib/api";
import { analyzeJob } from "@/lib/pipeline/analyze";
import { compareJob } from "@/lib/pipeline/compare";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedClient("ai");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const input = await req.json().catch(() => null);
  const run = input?.detailed === true ? analyzeJob : compareJob;
  const result = await run({ supabase: auth.supabase, userId: auth.userId, jobId: id });
  return Response.json(result.body, { status: result.status });
}
