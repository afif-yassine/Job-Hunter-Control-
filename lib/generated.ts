import { z } from "zod";

export const generated = z.object({
  cv: z.object({
    title: z.string(),
    summary: z.string(),
    experience: z.array(
      z.object({ heading: z.string(), bullets: z.array(z.string()) }),
    ),
    projects: z.array(
      z.object({ heading: z.string(), bullets: z.array(z.string()) }),
    ),
    skills: z.array(z.string()),
    education: z.array(z.string()),
    languages: z.string(),
  }),
  cover_letter: z.string().nullable(),
  unresolved_questions: z.array(
    z.object({ question: z.string(), category: z.string() }),
  ),
});

export type Generated = z.infer<typeof generated>;

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}

export function asTextList(value: unknown): string[] {
  if (Array.isArray(value))
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        const record = asRecord(item);
        return asText(
          record.name ??
            record.title ??
            record.label ??
            record.text ??
            record.description,
        );
      })
      .filter(Boolean);
  const text = asText(value);
  return text ? [text] : [];
}

export function asSections(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") {
      const heading = item.trim();
      return heading ? [{ heading, bullets: [] as string[] }] : [];
    }
    const record = asRecord(item);
    const heading = asText(
      record.heading ?? record.title ?? record.role ?? record.name,
    );
    const bullets = asTextList(
      record.bullets ?? record.items ?? record.highlights ?? record.description,
    );
    return heading || bullets.length ? [{ heading, bullets }] : [];
  });
}

export function parseJson(text: string): unknown {
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function normaliseGenerated(value: unknown): Generated | null {
  const root = asRecord(value);
  const source = asRecord(root.cv ?? root.CV ?? root.resume ?? root);
  const cv = {
    title: asText(source.title ?? source.name) || "CV ciblé",
    summary: asText(source.summary ?? source.profile ?? source.about),
    experience: asSections(
      source.experience ?? source.experiences ?? source.work_experience,
    ),
    projects: asSections(source.projects ?? source.project),
    skills: asTextList(source.skills ?? source.competencies),
    education: asTextList(source.education ?? source.education_history),
    languages: Array.isArray(source.languages)
      ? asTextList(source.languages).join(" | ")
      : asText(source.languages ?? source.language),
  };
  const coverValue =
    root.cover_letter ?? root.coverLetter ?? root.letter ?? root.coverLetterText;
  const coverRecord = asRecord(coverValue);
  const cover_letter =
    coverValue == null
      ? null
      : asText(coverRecord.text ?? coverRecord.content ?? coverValue) || null;
  const unresolved = root.unresolved_questions ?? root.unresolvedQuestions ?? [];
  const unresolved_questions = Array.isArray(unresolved)
    ? unresolved.flatMap((item) => {
        if (typeof item === "string") {
          const question = item.trim();
          return question
            ? [{ question, category: "UNSPECIFIED" }]
            : [];
        }
        const record = asRecord(item);
        const question = asText(record.question ?? record.text ?? record.prompt);
        const category = asText(record.category ?? record.type) || "UNSPECIFIED";
        return question ? [{ question, category }] : [];
      })
    : [];
  const result = generated.safeParse({ cv, cover_letter, unresolved_questions });
  if (!result.success) return null;
  const hasCvContent = Boolean(
    result.data.cv.summary ||
      result.data.cv.experience.length ||
      result.data.cv.projects.length ||
      result.data.cv.skills.length ||
      result.data.cv.education.length,
  );
  return hasCvContent ? result.data : null;
}
