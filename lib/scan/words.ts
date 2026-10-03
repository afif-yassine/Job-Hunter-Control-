import { normalizeText } from "@/lib/questions";

/** Normalisation of job words, shared by the cache, the catalogue and the categories. */

/** Words that do not change what a search finds. */
export const QUERY_NOISE = new Set("de d du des la le les l en et a au aux pour h f x hf fh".split(" "));

/** Different words, same job: they share one cached search. */
export const QUERY_SYNONYMS: Record<string, string> = {
  dev: "developpeur",
  developer: "developpeur",
  developpeuse: "developpeur",
  engineer: "ingenieur",
  ingenieure: "ingenieur",
  alternant: "alternance",
  alternante: "alternance",
  apprentissage: "alternance",
  apprenti: "alternance",
  apprentie: "alternance",
  apprenticeship: "alternance",
  apprentice: "alternance",
  trainee: "stage",
  software: "developpeur",
  stagiaire: "stage",
  internship: "stage",
  intern: "stage",
  professionnalisation: "alternance",
  reseaux: "reseau",
  ai: "intelligence artificielle",
  ia: "intelligence artificielle",
  fullstack: "full stack",
  frontend: "front end",
  backend: "back end",
};

/** Normalised, canonical words of a text (same rules as the cache identity). */
export function searchWords(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    // Plural → singular ("développeurs", "analysts"), same rule on both sides.
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .flatMap((w) => (QUERY_SYNONYMS[w] ?? w).split(" "))
    .filter((w) => w && !QUERY_NOISE.has(w));
}
