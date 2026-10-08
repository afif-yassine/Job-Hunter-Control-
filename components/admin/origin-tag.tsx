import type { CostOrigin } from "@/lib/admin/origin";
import { originText } from "./admin-display";

/**
 * Where an amount comes from, next to the figure: mesuré, estimé, hypothèse… Said in words
 * (not only by a colour) and announced by screen readers.
 */
export function OriginTag({ origin }: { origin: CostOrigin | null | undefined }) {
  const label = originText(origin);
  if (!origin || !label) return null;
  return (
    <span className={`grow-origin is-${origin.replace(/_/g, "-")}`}>
      <span className="sr">Origine du chiffre : </span>
      {label}
    </span>
  );
}
