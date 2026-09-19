import { z } from "zod";

/**
 * Presentation options of a CV / cover letter. The text lives in `content_text`
 * and the look is stored next to it (`design`), so a "V2 with another design"
 * really changes the PDF.
 */
export const TEMPLATES = ["classique", "moderne", "sobre"] as const;
export const ACCENTS = ["teal", "marine", "vert", "bordeaux", "graphite"] as const;
export const DENSITIES = ["compact", "normal", "aere"] as const;

export type Template = (typeof TEMPLATES)[number];
export type Accent = (typeof ACCENTS)[number];
export type Density = (typeof DENSITIES)[number];

export type Design = { template: Template; accent: Accent; density: Density };

export const DEFAULT_DESIGN: Design = {
  template: "classique",
  accent: "teal",
  density: "normal",
};

export const TEMPLATE_LABELS: Record<Template, string> = {
  classique: "Classique — titre à gauche, filet de couleur",
  moderne: "Moderne — bandeau de couleur en en-tête",
  sobre: "Sobre — centré, noir et blanc",
};
export const ACCENT_LABELS: Record<Accent, string> = {
  teal: "Turquoise",
  marine: "Bleu marine",
  vert: "Vert",
  bordeaux: "Bordeaux",
  graphite: "Graphite",
};
export const DENSITY_LABELS: Record<Density, string> = {
  compact: "Compact (plus de contenu)",
  normal: "Normal",
  aere: "Aéré (plus d'espace)",
};

/** RGB 0-255, used both by the PDF renderer and the dashboard swatches. */
export const ACCENT_RGB: Record<Accent, [number, number, number]> = {
  teal: [10, 89, 115],
  marine: [26, 51, 115],
  vert: [26, 107, 77],
  bordeaux: [128, 31, 51],
  graphite: [51, 56, 66],
};

export const designSchema = z.object({
  template: z.enum(TEMPLATES).catch(DEFAULT_DESIGN.template),
  accent: z.enum(ACCENTS).catch(DEFAULT_DESIGN.accent),
  density: z.enum(DENSITIES).catch(DEFAULT_DESIGN.density),
});

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Any value → a valid design (missing / unknown fields fall back to the base). */
export function normalizeDesign(value: unknown, base: Design = DEFAULT_DESIGN): Design {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    template: pick(v.template, TEMPLATES, base.template),
    accent: pick(v.accent, ACCENTS, base.accent),
    density: pick(v.density, DENSITIES, base.density),
  };
}

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Deterministic reading of a design request ("plus sobre", "en bleu",
 * "plus compact"...). Used on top of the model's answer so that a design
 * request is never silently ignored.
 */
export function designFromInstruction(instruction: string, current: Design): Design {
  const t = strip(instruction);
  const next = { ...current };
  if (/\b(sobre|minimal|epure|noir et blanc|classique sobre)\b/.test(t)) next.template = "sobre";
  else if (/\b(moderne|bandeau|bande|impactant|original)\b/.test(t)) next.template = "moderne";
  else if (/\b(classique|traditionnel)\b/.test(t)) next.template = "classique";

  if (/\b(bleu|marine)\b/.test(t)) next.accent = "marine";
  else if (/\b(vert|green)\b/.test(t)) next.accent = "vert";
  else if (/\b(bordeaux|rouge|rose)\b/.test(t)) next.accent = "bordeaux";
  else if (/\b(gris|graphite|noir|neutre)\b/.test(t) && next.template !== "sobre")
    next.accent = "graphite";
  else if (/\b(turquoise|teal|cyan)\b/.test(t)) next.accent = "teal";

  if (/\b(compact|dense|serre|une page|1 page|raccourci|tenir sur)\b/.test(t))
    next.density = "compact";
  else if (/\b(aere|aeree|respire|espace|lisible|moins dense)\b/.test(t))
    next.density = "aere";
  return next;
}

export function sameDesign(a: Design, b: Design) {
  return a.template === b.template && a.accent === b.accent && a.density === b.density;
}
