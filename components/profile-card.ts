import type { ProfileSummary } from "@/lib/profile-store";

/** Said wherever the saved CV is shown, so nobody uploads it again by habit. */
export const CV_SAVED_NOTE = "Ton CV est enregistré : tu n’as pas besoin de le déposer à nouveau, sauf pour le remplacer.";

const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** What was read from the CV, only the parts that exist; null when nothing was read. */
export function readCounts(summary: Pick<ProfileSummary, "experience" | "education" | "skills">): string | null {
  const parts = [
    summary.experience > 0 ? count(summary.experience, "expérience", "expériences") : null,
    summary.education > 0 ? count(summary.education, "formation", "formations") : null,
    summary.skills > 0 ? count(summary.skills, "compétence", "compétences") : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * The lines of the home card for a saved CV: the file, when it was updated, what was read.
 * `ago` turns a date into "il y a 3 h". Absent facts are left out, never invented.
 */
export function profileCardLines(summary: ProfileSummary, ago: (iso: string) => string): string[] {
  const lines: string[] = [summary.source ? `CV importé : « ${summary.source} »` : "CV enregistré"];
  if (summary.updated_at) lines.push(`Mis à jour ${ago(summary.updated_at)}.`);
  const counts = readCounts(summary);
  if (counts) lines.push(`Ce qui a été lu : ${counts}.`);
  return lines;
}
