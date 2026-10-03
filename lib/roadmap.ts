/**
 * What the app can do today and what is coming, sprint by sprint — the same
 * list as the "Plan et sprints" tab of the roadmap document. Shown in
 * Plus > Feuille de route, and as "Bientôt" cards where a feature will land.
 * Update the state here when a step ships.
 */

export type FeatureState = "done" | "doing" | "soon";

export type Feature = { id: string; label: string; state: FeatureState; sprint?: number; detail?: string };

export const FEATURES: Feature[] = [
  // Already in the app
  { id: "sources", label: "Recherche multi-sources (France Travail, JSearch, Adzuna, Jooble, pages carrière)", state: "done" },
  { id: "discovery", label: "Découverte automatique des entreprises sur les pages carrière", state: "done" },
  { id: "dedupe", label: "Dédoublonnage et « Déjà postulé ailleurs »", state: "done" },
  { id: "scams", label: "Offres suspectes mises de côté", state: "done" },
  { id: "score", label: "Score de compatibilité avec ton profil", state: "done" },
  { id: "documents", label: "CV et lettre adaptés (PDF, LaTeX, modification par une phrase)", state: "done" },
  { id: "server-run", label: "Recherche automatique sur le serveur", state: "done" },
  // Sprint 1
  { id: "catalogue", label: "Catalogue d’offres commun : une recherche ne coûte plus par compte", state: "done", sprint: 1, detail: "Chaque recherche est mise en cache par requête et partagée entre les comptes." },
  { id: "lba", label: "La bonne alternance", state: "doing", sprint: 1, detail: "Branchée, active après l’accord d’usage commercial." },
  { id: "availability", label: "Offres expirées détectées et retirées", state: "done", sprint: 1, detail: "Retirée de la page carrière, plus vue depuis 21 jours, ou signalée « plus disponible »." },
  { id: "security", label: "Sécurité renforcée et coût IA suivi par compte", state: "soon", sprint: 1 },
  // Sprint 2
  { id: "cv-import", label: "Import du CV en PDF, une seule fois", state: "soon", sprint: 2 },
  { id: "ranking", label: "Toutes les offres classées pour ton profil (embeddings)", state: "soon", sprint: 2 },
  { id: "summary", label: "Résumé court de chaque offre", state: "soon", sprint: 2 },
  // Sprint 3
  { id: "design", label: "Nouveau design, thème clair et sombre, mobile", state: "soon", sprint: 3 },
  { id: "filters", label: "Filtres et catégories", state: "soon", sprint: 3 },
  { id: "versions", label: "Historique et comparaison des versions de CV", state: "soon", sprint: 3 },
  // Sprint 4
  { id: "tracking", label: "Suivi des candidatures en colonnes", state: "soon", sprint: 4 },
  { id: "extension", label: "Extension Chrome pour enregistrer une candidature faite ailleurs", state: "soon", sprint: 4 },
  { id: "follow-up", label: "Relances proposées", state: "soon", sprint: 4 },
  { id: "interview", label: "Fiche de préparation d’entretien", state: "soon", sprint: 4 },
  // Sprint 5
  { id: "gmail-replies", label: "Réponses des recruteurs lues dans Gmail", state: "soon", sprint: 5 },
  { id: "response-rates", label: "Taux de réponse par entreprise", state: "soon", sprint: 5 },
];

export const STATE_LABEL: Record<FeatureState, string> = { done: "Disponible", doing: "En cours", soon: "Bientôt" };

export function feature(id: string): Feature {
  const f = FEATURES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown feature ${id}`);
  return f;
}
