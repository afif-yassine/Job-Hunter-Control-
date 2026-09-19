import { z } from "zod";
import { generated } from "@/lib/generated";

export const cvSchema = generated.shape.cv;
export const letterSchema = z.object({ letter: z.string().min(20).max(6000) });

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
