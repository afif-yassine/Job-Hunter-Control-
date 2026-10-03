import { authenticatedClient } from "@/lib/api";
import { stillOnline } from "@/lib/pipeline/availability";
import { generateForJob } from "@/lib/pipeline/generate";
import { serviceClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedClient("ai");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const result = await generateForJob({
    supabase: auth.supabase,
    userId: auth.userId,
    jobId: id,
    checkOnline: (job) => stillOnline(job),
    service: serviceClient(),
  });
  return Response.json(result.body, { status: result.status });
}
