import { authenticatedClient } from "@/lib/api";
import { onboardingStatus } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/** Where the sign-up stands: profile confirmed, search chosen, vector state (read only). */
export async function GET() {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  try {
    return Response.json(await onboardingStatus(auth.supabase, auth.userId));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "État de l’inscription illisible" }, { status: 500 });
  }
}
