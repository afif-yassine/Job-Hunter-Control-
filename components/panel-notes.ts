/**
 * The notes written INSIDE the offer panel where the "CV et lettre" button would be, with the exact words
 * of the business judgment (no toast: the student reads them where he is looking).
 */

/** The offer is readable but not in the student's selection: no kit can be written on it. */
export const LOCKED_NOTE = {
  title: "Cette offre n’est pas dans ta sélection",
  text: "Tu peux la lire et ouvrir l’annonce sur son site. Les dossiers se préparent sur les offres de ta sélection et sur celles que tu ajoutes toi-même.",
  action: "Voir l’annonce",
} as const;

/** Moment "clic": the day's one window, when the server refuses a kit because the month's are used. */
export function monthWindow(limit: number, resetsOn: string, plusKits: number, plusDaily: number): { title: string; text: string; stay: string } {
  return {
    title: limit > 1 ? `Tes ${limit} dossiers du mois sont utilisés` : "Ton dossier du mois est utilisé",
    text: `Les ${limit} prochains arrivent le ${resetsOn}. Avec LeBonTaf Plus : ${plusKits} dossiers par mois et jusqu’à ${plusDaily} offres par jour. Le paiement n’est pas encore ouvert, tu peux demander l’accès anticipé.`,
    stay: `Attendre le ${resetsOn}`,
  };
}

/** Moment "dernier": under the success message of the kit that leaves exactly one. */
export function lastKitBlock(plusKits: number): { title: string; text: string } {
  return { title: "Il te reste 1 dossier ce mois-ci", text: `Garde-le pour l’offre qui compte le plus. Avec LeBonTaf Plus : ${plusKits} dossiers par mois.` };
}

/** Moment "bandeau" (top of "Pour toi") when the kits of the month are used. */
export function monthBanner(limit: number, resetsOn: string): { title: string; text: string } {
  return {
    title: limit > 1 ? `Tes ${limit} dossiers du mois sont utilisés` : "Ton dossier du mois est utilisé",
    text: `Prochains dossiers le ${resetsOn}. Tu peux toujours suivre tes offres et modifier tes dossiers.`,
  };
}

/** The kits of the month are used. `resetsOn` is the French label of the next date ("1er novembre"). */
export function monthFullNote(limit: number, resetsOn: string): { title: string; text: string } {
  return {
    title: limit > 1 ? `Tes ${limit} dossiers du mois sont utilisés` : "Ton dossier du mois est utilisé",
    // No "chercher": a free account only sees its selection.
    text: `Les prochains arrivent le ${resetsOn}. D’ici là, tu peux toujours garder et suivre tes offres, et modifier tes dossiers.`,
  };
}
