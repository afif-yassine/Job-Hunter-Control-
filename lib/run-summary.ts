import type { AgentRun } from "@/lib/types";

const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count > 1 ? many : one}`;

/** One short sentence saying what a journal entry did. Empty when there is nothing to say. */
export function runSummary(run: AgentRun): string {
  const c = run.counters || {};
  switch (run.run_type) {
    case "PIPELINE": {
      if (c.noSource) return "Aucune source d’offres connectée.";
      const parts = [
        plural(n(c.inserted), "nouvelle offre", "nouvelles offres"),
        n(c.analyzed) ? `${plural(n(c.analyzed), "analysée")}` : "",
        n(c.strong) ? `${plural(n(c.strong), "très bonne")}` : "",
        n(c.generated) ? `${plural(n(c.generated), "dossier")} prêt${n(c.generated) > 1 ? "s" : ""}` : "",
        n(c.prepared) ? `${plural(n(c.prepared), "formulaire")} lu${n(c.prepared) > 1 ? "s" : ""}` : "",
        n(c.needsDescription) ? `${plural(n(c.needsDescription), "offre")} à compléter` : "",
      ].filter(Boolean);
      return parts.join(" · ");
    }
    case "OFFER_SCAN":
      return `${plural(n(c.found), "offre")} trouvée${n(c.found) > 1 ? "s" : ""}, ${plural(n(c.inserted), "nouvelle")}, ${plural(n(c.duplicates), "doublon")} ignoré${n(c.duplicates) > 1 ? "s" : ""}.`;
    case "PLAYWRIGHT_PREPARE":
    case "PLAYWRIGHT_INSPECT": {
      if (run.status === "RUNNING") return "Lecture du formulaire en cours…";
      if (run.status === "FAILED") return "";
      const questions = n(c.questions);
      return `${plural(n(c.fields), "champ")} détecté${n(c.fields) > 1 ? "s" : ""}${questions ? `, ${plural(questions, "question")} à traiter` : ""}. Rien n’a été envoyé.`;
    }
    default:
      return "";
  }
}
