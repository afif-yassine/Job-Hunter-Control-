import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { designSchema } from "@/lib/design";
import { generated } from "@/lib/generated";
import type { RenderContext } from "@/lib/pdf";

/** Text of the CV plus its look (template, colour, density). */
export const cvSchema = generated.shape.cv.extend({ design: designSchema.optional() });
export const letterSchema = z.object({
  letter: z.string().min(20).max(6000),
  design: designSchema.optional(),
});

/** CV_x.pdf → CV_x_v2.pdf (and CV_x_v2.pdf → CV_x_v3.pdf). */
export function versionedFilename(filename: string, version: number) {
  const base = filename.replace(/\.pdf$/i, "").replace(/_v\d+$/i, "");
  return `${base}${version > 1 ? `_v${version}` : ""}.pdf`;
}

export function parseContent(text: string | null): unknown {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

/** Job details printed in the letter header (company, location). */
export async function renderContextFor(
  supabase: SupabaseClient,
  userId: string,
  doc: { job_id?: string | null },
): Promise<RenderContext> {
  if (!doc.job_id) return {};
  const { data } = await supabase
    .from("jobs")
    .select("company,title,location")
    .eq("id", doc.job_id)
    .eq("user_id", userId)
    .maybeSingle();
  return data
    ? { company: data.company, jobTitle: data.title, location: data.location }
    : {};
}
