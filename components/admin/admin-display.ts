import { ORIGIN_LABELS, type CostOrigin } from "@/lib/admin/origin";

/** What is shown for a fact the server could not read: never 0, never "non". */
export const UNKNOWN = "—";

/** A number that may be unknown: the dash, not zero. */
export function orDash(value: number | null | undefined, format: (n: number) => string): string {
  return typeof value === "number" && Number.isFinite(value) ? format(value) : UNKNOWN;
}

/** A yes/no fact that may be unknown: the dash, not "non". */
export function yesNoOrDash(value: boolean | null | undefined, yes: string, no: string): string {
  return value === true ? yes : value === false ? no : UNKNOWN;
}

const usd2 = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

/** An amount in dollars with cents, or the dash when it is unknown. */
export function usdFixed(value: number | null | undefined): string {
  return orDash(value, usd2);
}

/** The gap between what the Gateway says and what the app recorded: signed, or the dash when one side is unknown. */
export function gapText(gap: number | null | undefined): string {
  return orDash(gap, (n) => `${n > 0 ? "+" : ""}${usd2(n)}`);
}

/** Why the balance of the key cannot be read, in French. Never turned into a zero balance. */
export function gatewayReasonText(reason: "not_configured" | "unauthorized" | "unavailable"): string {
  if (reason === "not_configured") return "la clé du Gateway n’est pas configurée sur ce serveur";
  if (reason === "unauthorized") return "le Gateway a refusé la clé";
  return "le Gateway n’a pas répondu";
}

/** The French label of where an amount comes from (null when the server gave none). */
export function originText(origin: CostOrigin | null | undefined): string | null {
  return origin ? ORIGIN_LABELS[origin] : null;
}

/** "réelle" is said only when every line was read from the provider. */
export function spendTitle(origins: CostOrigin[]): string {
  return origins.length > 0 && origins.every((o) => o === "measured") ? "Dépense réelle par modèle" : "Dépense par modèle";
}

/**
 * The catalogue bar says "Vectorisées" only when it counts the current (Perplexity) column; when the server
 * could only count the legacy column, the figure is said to be that column's, not the number of vectorised offers.
 */
export function vectorBarLabel(counted: "semantic_embedding" | "legacy_embedding"): string {
  return counted === "legacy_embedding" ? "Ancienne colonne" : "Vectorisées";
}

/** Calls of the month with no stored cost: counted as calls and tokens, never as dollars. */
export function unpricedText(calls: number): string | null {
  if (!Number.isFinite(calls) || calls <= 0) return null;
  return `${calls} appel${calls > 1 ? "s" : ""} sans coût enregistré : compté${calls > 1 ? "s" : ""} en appels et en jetons, pas en dollars.`;
}
