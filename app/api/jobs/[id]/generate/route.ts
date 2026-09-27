import { authenticatedClient } from "@/lib/api";
import { generateForJob } from "@/lib/pipeline/generate";

export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const result = await generateForJob({ supabase: auth.supabase, userId: auth.userId, jobId: id });
  return Response.json(result.body, { status: result.status });
}
