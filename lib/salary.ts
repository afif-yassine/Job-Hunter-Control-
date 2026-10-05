/** Salary as the sources give it, turned into one short French line ("1 400 – 1 600 € / mois"). */

const PERIOD: Record<string, string> = {
  YEAR: "an",
  YEARLY: "an",
  ANNUAL: "an",
  MONTH: "mois",
  MONTHLY: "mois",
  WEEK: "semaine",
  DAY: "jour",
  HOUR: "heure",
  HOURLY: "heure",
};

const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")}`;

/** A min/max pair (either may be missing) with an optional period. */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  period?: string | null,
  currency = "EUR",
): string | null {
  const lo = typeof min === "number" && Number.isFinite(min) && min > 0 ? min : null;
  const hi = typeof max === "number" && Number.isFinite(max) && max > 0 ? max : null;
  if (lo === null && hi === null) return null;
  const sign = currency === "EUR" || !currency ? "€" : currency;
  const per = period ? PERIOD[period.toUpperCase()] : null;
  const amount = lo !== null && hi !== null && Math.round(lo) !== Math.round(hi) ? `${euros(lo)} – ${euros(hi)}` : euros((lo ?? hi) as number);
  return `${amount} ${sign}${per ? ` / ${per}` : ""}`;
}

/** Free text from a source ("Mensuel de 1400.00 Euros à 1600.00 Euros sur 12 mois"), cleaned and shortened. */
export function cleanSalaryText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text || /^(n\/a|nc|non communiqu[ée]e?|-)$/i.test(text)) return null;
  // France Travail: "Mensuel de 1400.00 Euros à 1600.00 Euros sur 12 mois".
  const ft = text.match(/^(Annuel|Mensuel|Horaire)\s+de\s+([\d.,]+)\s*Euros?(?:\s+à\s+([\d.,]+)\s*Euros?)?/i);
  if (ft) {
    const per = { annuel: "YEAR", mensuel: "MONTH", horaire: "HOUR" }[ft[1].toLowerCase()];
    const num = (s?: string) => (s ? Number(s.replace(",", ".")) : null);
    const formatted = formatSalaryRange(num(ft[2]), num(ft[3]), per);
    if (formatted) return formatted;
  }
  text = text.replace(/Euros?/g, "€");
  return text.length > 80 ? `${text.slice(0, 77).trimEnd()}…` : text;
}
