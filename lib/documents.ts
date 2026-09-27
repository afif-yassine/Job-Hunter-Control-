import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { designSchema } from "@/lib/design";
import { generated } from "@/lib/generated";
import type { Identity, RenderContext } from "@/lib/pdf";

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

const shortLink = (url: string | null | undefined) =>
  url ? url.trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "") : "";

/**
 * Name and contact line of the account's own profile. Every field comes from
 * that profile (empty when missing), so one account never prints another's details.
 */
export async function identityFor(supabase: SupabaseClient, userId: string): Promise<Identity | null> {
  const { data } = await supabase
    .from("candidate_profiles")
    .select("full_name,email,location,linkedin_url,github_url,portfolio_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.full_name) return null;
  return {
    name: data.full_name,
    city: data.location || "",
    email: data.email || "",
    links: [data.linkedin_url, data.github_url, data.portfolio_url].map(shortLink).filter(Boolean),
  };
}

/** Header of the documents: the account's identity + the job (company, location). */
export async function renderContextFor(
  supabase: SupabaseClient,
  userId: string,
  doc: { job_id?: string | null },
): Promise<RenderContext> {
  const [identity, job] = await Promise.all([
    identityFor(supabase, userId),
    doc.job_id
      ? supabase
          .from("jobs")
          .select("company,title,location")
          .eq("id", doc.job_id)
          .eq("user_id", userId)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);
  return {
    ...(identity ? { identity } : {}),
    ...(job ? { company: job.company, jobTitle: job.title, location: job.location } : {}),
  };
}
