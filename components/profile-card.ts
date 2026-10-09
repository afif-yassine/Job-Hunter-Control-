import type { ProfileSummary } from "@/lib/profile-store";

/** Said wherever the saved CV is shown, so nobody uploads it again by habit. */
export const CV_SAVED_NOTE = "Ton CV est enregistré : tu n’as pas besoin de le déposer à nouveau, sauf pour le remplacer.";

/** The confirmation after a saved profile, with the suggested jobs ticked or without. It promises no offer. */
export function profileSavedMessage(input: { picked: number }): string {
  if (!input.picked) return "Profil enregistré : tes prochains CV et lettres partiront de lui.";
  return `Profil enregistré. ${input.picked} métier(s) coché(s).`;
}

/** The size the server accepts for a CV (PDF). */
export const CV_MAX_BYTES = 5 * 1024 * 1024;

/** Said on the screen itself (not in a toast) when a CV could not be read, with what to do next. */
export function readFailedMessage(file: { size: number }, serverText?: string): string {
  if (file.size > CV_MAX_BYTES) return "Ce fichier fait plus de 5 Mo. Réexporte ton CV en PDF plus léger, puis réessaie.";
  const base = serverText && !/^HTTP \d+$/.test(serverText) ? serverText : "Ton CV n’a pas pu être lu.";
  return `${base} Si c’est un PDF scanné (une photo), exporte-le depuis ton traitement de texte, puis réessaie.`;
}

/** The profile is saved but the suggested jobs could not be ticked: say so plainly, and where to do it by hand. */
export function categoriesFailedMessage(): string {
  return "Profil enregistré. Les métiers suggérés n’ont pas pu être cochés : choisis-les dans « 2 · Ce que tu cherches ».";
}

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
