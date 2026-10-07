import { authenticatedClient } from "@/lib/api";
import { stillOnlineCached } from "@/lib/pipeline/availability";
import { generateForJob } from "@/lib/pipeline/generate";
import { serviceClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedClient("ai");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  // The pipeline button says so: free accounts keep their kits for the offers they pick.
  const body = (await request.json().catch(() => ({}))) as { auto?: unknown };
  const service = serviceClient();
  const result = await generateForJob({
    supabase: auth.supabase,
    userId: auth.userId,
    jobId: id,
    checkOnline: (job) => stillOnlineCached(job, service),
    service,
    automatic: body.auto === true,
  });
  return Response.json(result.body, { status: result.status });
}
