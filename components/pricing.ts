import { DAILY_LIMIT, PLUS_DAILY_LIMIT } from "@/components/unlock";
import { BRAND } from "@/lib/brand";

/**
 * The pricing page is shown by default (owner's decision of 9 October); PRICING_PAGE=0 turns it off without
 * touching the code. Anything else, or nothing, leaves it on.
 */
export function pricingEnabled(value: string | undefined): boolean {
  return value?.trim() !== "0";
}

/** Kits (CV and letter) a month: the free plan's number comes from the server (plan.limit); this is Plus'. */
export const PLUS_MONTHLY_KITS = 30;

/** The words of the page, as the commercial plan of 10 October wrote them. There is no payment button: nothing is sold yet. */
export const PRICING = {
  name: "LeBonTaf Plus",
  lead: "Plus d’offres choisies pour toi chaque jour, et plus de dossiers (CV et lettre) chaque mois.",
  description: "Les tarifs de LeBonTaf Plus, en clair : plus d’offres par jour et plus de dossiers CV et lettre, paiement unique.",
  free: {
    name: "Gratuit",
    lines: [`Jusqu’à ${DAILY_LIMIT} offres par jour, choisies selon ton CV`, "2 dossiers (CV et lettre) par mois", "Le suivi de tes candidatures"],
  },
  plans: [
    { id: "30j", name: "30 jours", price: "7,99 €" },
    { id: "6m", name: "6 mois", price: "34,99 €" },
  ],
  plusLines: [`Jusqu’à ${PLUS_DAILY_LIMIT} offres par jour, choisies selon ton CV`, `${PLUS_MONTHLY_KITS} dossiers (CV et lettre) par mois`],
  truth: `Certains jours, moins de ${PLUS_DAILY_LIMIT} offres te correspondent : on ne complète jamais avec des offres qui ne te vont pas. Ces annonces sont publiques sur leur site d’origine ; Plus t’en trie davantage et te prépare plus de dossiers. Il ne garantit ni réponse, ni entretien, ni embauche.`,
  terms: "Paiement unique, TTC, sans abonnement. Réservé aux personnes de 18 ans et plus.",
  notOpen: "Le paiement n’est pas encore ouvert.",
  action: "Demander l’accès anticipé",
  /** In the offer panel, when the kits of the month are used. */
  panelLink: "Voir LeBonTaf Plus",
} as const;

/** The sentence of the panel's note when the kits of the month are used: why they are limited, and what Plus gives. */
export function whyKitsLimited(freeKits: number): string {
  return `Chaque dossier est écrit par une IA qui nous coûte de l’argent : ${freeKits} sont offerts chaque mois, ${PLUS_MONTHLY_KITS} avec LeBonTaf Plus.`;
}

/** Where every "Voir LeBonTaf Plus" leads; `moment` says which proposal it came from (a counter, no account id). */
export function pricingHref(moment?: string): string {
  return moment ? `/tarifs?de=${encodeURIComponent(moment)}` : "/tarifs";
}

export function pricingMailto(): string {
  return `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent("Accès anticipé à LeBonTaf Plus")}`;
}
