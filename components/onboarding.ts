/**
 * The guided sign-up: a full-screen journey (CV, then what the student looks for, then his first selection) before the
 * dashboard. THE one place that decides whether it is shown. A doubt never closes the app: every failure to know
 * lets the student in.
 */

export type OnboardingStep = "cv" | "search" | "ready";

/** What GET /api/onboarding/status says (backend contract). */
export type ServerOnboarding = { profileConfirmed: boolean; searchChosen: boolean; vector: "ready" | "pending" | "unavailable"; ready: boolean };

/** null when the answer is not what the contract says: the caller then deduces the gate from the current routes. */
export function parseOnboardingStatus(body: unknown): ServerOnboarding | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.profileConfirmed !== "boolean" || typeof b.searchChosen !== "boolean" || typeof b.ready !== "boolean") return null;
  const vector = b.vector === "ready" || b.vector === "pending" || b.vector === "unavailable" ? b.vector : "unavailable";
  return { profileConfirmed: b.profileConfirmed, searchChosen: b.searchChosen, vector, ready: b.ready };
}

export type GateInput = {
  demo: boolean;
  /** undefined: the account status is not known yet. */
  isAdmin: boolean | undefined;
  statusFailed: boolean;
  /** The route answered: undefined = still loading, null = absent or unreadable (deduce from the other routes). */
  server: ServerOnboarding | null | undefined;
  /** undefined = unknown (loading or unreadable, see profileFailed). */
  hasProfile: boolean | undefined;
  profileFailed: boolean;
  /** undefined = unknown (loading or unreadable, see searchFailed). */
  searchChosen: boolean | undefined;
  searchFailed: boolean;
};

export type Gate = { kind: "wait" } | { kind: "open" } | { kind: "step"; step: "cv" | "search" };

export function onboardingGate(i: GateInput): Gate {
  if (i.demo || i.isAdmin === true) return { kind: "open" };
  if (i.isAdmin === undefined) return i.statusFailed ? { kind: "open" } : { kind: "wait" };
  if (i.server === undefined) return { kind: "wait" };
  if (i.server) {
    if (i.server.ready) return { kind: "open" };
    if (!i.server.profileConfirmed) return { kind: "step", step: "cv" };
    return i.server.searchChosen ? { kind: "open" } : { kind: "step", step: "search" };
  }
  // The route does not exist (yet): deduce from what the app already reads.
  if (i.hasProfile === undefined) return i.profileFailed ? { kind: "open" } : { kind: "wait" };
  if (i.hasProfile === false) return { kind: "step", step: "cv" };
  if (i.searchChosen === undefined) return i.searchFailed ? { kind: "open" } : { kind: "wait" };
  return i.searchChosen ? { kind: "open" } : { kind: "step", step: "search" };
}

export const STEPS = [
  { id: "cv", label: "Ton CV" },
  { id: "search", label: "Ce que tu cherches" },
  { id: "ready", label: "Ta première sélection" },
] as const satisfies readonly { id: OnboardingStep; label: string }[];

/** "Étape 2 sur 3 · Ce que tu cherches" */
export function stepLabel(step: OnboardingStep): string {
  const index = STEPS.findIndex((s) => s.id === step);
  return `Étape ${index + 1} sur ${STEPS.length} · ${STEPS[index].label}`;
}

/** The words of the screens, in one place. */
export const ONBOARDING_TEXT = {
  cv: {
    title: "Dépose ton CV",
    lead: "Une seule fois. Ton profil en est tiré, et tes offres sont choisies selon lui. Tu vérifies ce qui a été lu avant d’enregistrer.",
  },
  search: {
    title: "Ce que tu cherches",
    lead: "Choisis ton type de contrat, au moins un métier et ta ville. Tu pourras tout changer plus tard dans Réglages.",
    need: "Coche au moins un métier pour continuer.",
    action: "Enregistrer et continuer",
    failed: "Tes choix n’ont pas pu être enregistrés. Réessaie.",
    unreadable: "Tes réglages n’ont pas pu être lus. Recharge la page.",
  },
  ready: {
    title: "Ta première sélection",
    action: "Voir ma sélection",
  },
  logout: "Se déconnecter",
} as const;

/** What the last screen says, from the number of offers already chosen for today. */
export function readyText(batch: number | null): string {
  if (batch === null || batch <= 0) return "On prépare ta première sélection. Elle arrive dès qu’elle est prête : tu peux déjà entrer dans ton espace.";
  return `${batch} offre${batch > 1 ? "s" : ""} choisie${batch > 1 ? "s" : ""} pour toi t’attend${batch > 1 ? "ent" : ""}.`;
}
