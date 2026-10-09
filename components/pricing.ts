import { BRAND } from "@/lib/brand";

/**
 * The pricing page is shown by default (owner's decision of 9 October); PRICING_PAGE=0 turns it off without
 * touching the code. Anything else, or nothing, leaves it on.
 */
export function pricingEnabled(value: string | undefined): boolean {
  return value?.trim() !== "0";
}

/** The words of the page, exactly as the business judgment wrote them. There is no payment button: nothing is sold yet. */
export const PRICING = {
  name: "LeBonTaf Plus",
  lead: "Plus de dossiers (CV et lettre) chaque mois. Tes offres du jour, elles, restent les mêmes pour tout le monde.",
  free: {
    name: "Gratuit",
    lines: ["2 dossiers (CV et lettre) par mois", "Tes offres du jour, choisies selon ton CV", "Le suivi de tes candidatures"],
  },
  plans: [
    { id: "30j", name: "30 jours", price: "7,99 €" },
    { id: "6m", name: "6 mois", price: "34,99 €" },
  ],
  terms: "Paiement unique, TTC, sans abonnement. Réservé aux personnes de 18 ans et plus.",
  notOpen: "Le paiement n’est pas encore ouvert.",
  action: "Demander l’accès anticipé",
  /** In the offer panel, when the kits of the month are used. */
  panelLink: "Voir LeBonTaf Plus",
  why: "Chaque dossier est écrit par une IA qui nous coûte de l’argent. Deux sont offerts chaque mois.",
} as const;

export function pricingMailto(): string {
  return `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent("Accès anticipé à LeBonTaf Plus")}`;
}
