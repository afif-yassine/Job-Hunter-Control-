/**
 * The notes written INSIDE the offer panel where the "CV et lettre" button would be, with the exact words of the
 * business judgment (no toast: the student reads them where he is looking). Nothing here sells anything.
 */

/** The offer is readable but not in the student's selection: no kit can be written on it. */
export const LOCKED_NOTE = {
  title: "Cette offre n’est pas dans ta sélection",
  text: "Tu peux la lire et ouvrir l’annonce sur son site. Les dossiers se préparent sur les offres de ta sélection et sur celles que tu ajoutes toi-même.",
  action: "Voir l’annonce",
} as const;

/** The kits of the month are used. `resetsOn` is the French label of the next date ("1er novembre"). */
export function monthFullNote(limit: number, resetsOn: string): { title: string; text: string } {
  return {
    title: limit > 1 ? `Tes ${limit} dossiers du mois sont utilisés` : "Ton dossier du mois est utilisé",
    text: `Les prochains arrivent le ${resetsOn}. D’ici là, tu peux toujours chercher, garder et suivre tes offres, et modifier tes dossiers.`,
  };
}
