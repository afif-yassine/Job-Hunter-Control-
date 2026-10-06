import { embeddingBackfill } from "@/lib/embedding-backfill";
import { serviceClient } from "@/lib/supabase/admin";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return embeddingBackfill(req, { env: process.env, db: serviceClient });
}
