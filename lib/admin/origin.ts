/**
 * Where an amount shown to the administrator comes from.
 * - measured: read from the provider (e.g. the Gateway's balance).
 * - measured_or_estimated: the cost stored per AI call, which is the Gateway's own figure when
 *   the answer carried one and a coded price otherwise; the table cannot tell which.
 * - estimated: computed here from tokens × coded prices, or a projection.
 * - assumption: a hypothesis (simulator, hosting, Pro price, exchange rate), never an invoice.
 */
export type CostOrigin = "measured" | "measured_or_estimated" | "estimated" | "assumption";

export const ORIGIN_LABELS: Record<CostOrigin, string> = {
  measured: "mesuré",
  measured_or_estimated: "mesuré ou estimé, non distingué",
  estimated: "estimé",
  assumption: "hypothèse",
};
