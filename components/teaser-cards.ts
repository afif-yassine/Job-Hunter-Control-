import { DAILY_LIMIT, PLUS_DAILY_LIMIT } from "@/components/unlock-limits";

/**
 * The blurred cards under the day's selection: real offers that LeBonTaf Plus would give today, described by what
 * the server computed (never a title, a company, a link or an id). The server sends
 * `teaser: { items: [{ score, common, skills, contract, department: { code, name }, publishedAgoDays }], more }`.
 * Everything here is pure; an absent or unreadable teaser is "no card".
 */

export type TeaserItem = {
  score: number;
  /** Skills in common with the student's CV. */
  common: number;
  /** Two names at most. */
  skills: string[];
  contract: string;
  department: { code: string; name: string };
  publishedAgoDays: number;
};
export type Teaser = { items: TeaserItem[]; more: number };

/** At most three cards (three fit on a phone with their title and button). */
export const MAX_CARDS = 3;

const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const count = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** A well-formed teaser, or null. One malformed card makes the whole teaser unusable (a doubt shows nothing). */
export function parseTeaser(body: unknown): Teaser | null {
  if (typeof body !== "object" || body === null) return null;
  const { items, more } = body as { items?: unknown; more?: unknown };
  if (!Array.isArray(items) || !count(more)) return null;
  const parsed: TeaserItem[] = [];
  for (const raw of items) {
    const i = raw as Record<string, unknown> | null;
    const d = (i?.department ?? null) as Record<string, unknown> | null;
    if (!i || !count(i.score) || !count(i.common) || !str(i.contract) || !d || !str(d.code) || !str(d.name) || !count(i.publishedAgoDays)) return null;
    const skills = Array.isArray(i.skills) ? i.skills.filter(str).slice(0, 2) : [];
    parsed.push({ score: i.score, common: Math.floor(i.common), skills, contract: i.contract.trim(), department: { code: d.code, name: d.name }, publishedAgoDays: Math.floor(i.publishedAgoDays) });
  }
  return { items: parsed, more: Math.floor(more) };
}

/** The cards to draw: never more than three, never more than the offers Plus would add, none when there is nothing more. */
export function cardsToShow(teaser: Teaser | null | undefined): TeaserItem[] {
  if (!teaser || teaser.more <= 0) return [];
  return teaser.items.slice(0, Math.min(MAX_CARDS, teaser.more));
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** "5 compétences en commun" */
export const commonText = (item: TeaserItem) => `${plural(item.common, "compétence", "compétences")} en commun`;

/** "Python, SQL et 3 autres" (null when the server named none). */
export function skillsText(item: TeaserItem): string | null {
  if (item.skills.length === 0) return null;
  const rest = Math.max(0, item.common - item.skills.length);
  const names = item.skills.join(", ");
  return rest > 0 ? `${names} et ${rest} autre${rest > 1 ? "s" : ""}` : names;
}

/** "Publiée il y a 3 jours", the real date, never an urgency. */
export function ageText(days: number): string {
  if (days <= 0) return "Publiée aujourd’hui";
  if (days === 1) return "Publiée hier";
  return `Publiée il y a ${days} jours`;
}

/** "Rhône (69)": the department, never the town. */
export const placeText = (item: TeaserItem) => `${item.department.name} (${item.department.code})`;

/** "Alternance · Rhône (69)" */
export const whatWhere = (item: TeaserItem) => `${item.contract} · ${placeText(item)}`;

/** What a screen reader says for a card, in one sentence. */
export function cardSpoken(item: TeaserItem): string {
  return `Offre proposée avec LeBonTaf Plus : ${item.contract.toLowerCase()} · ${placeText(item)}, ${commonText(item)}, ${ageText(item.publishedAgoDays).toLowerCase()}`;
}

/* ------------------------------------------------------------------ the words (commercial plan, moments 3 and 4) */

export const CARD_LABEL = "Avec Plus";
export const PLUS_BUTTON = "Voir LeBonTaf Plus";

/** Moment 3. `more` comes from the server. */
export function moreTitle(more: number): string {
  return more > 1 ? `${more} autres offres te correspondent aujourd’hui` : "1 autre offre te correspond aujourd’hui";
}
export const morePhrase = () =>
  `Elles passent le même tri que tes offres du jour. Avec LeBonTaf Plus, tu en reçois jusqu’à ${PLUS_DAILY_LIMIT} par jour au lieu de ${DAILY_LIMIT}.`;

/** Moment 4: every offer of the day was opened, kept or put aside. `batch` is the real size of the day's batch. */
export function endTitle(batch: number): string {
  return batch > 1 ? `Tu as fait le tour de tes ${batch} offres du jour` : "Tu as fait le tour de ton offre du jour";
}
export const endPhrase = (more: number) => `De nouvelles offres arrivent demain. Avec LeBonTaf Plus, ${more} de plus dès aujourd’hui.`;

/** The small window opened by a card. */
export const CARD_DIALOG = {
  title: "Cette offre fait partie de LeBonTaf Plus",
  stay: `Rester sur mes ${DAILY_LIMIT} offres`,
  close: "Fermer",
} as const;
export function dialogPhrase(item: TeaserItem): string {
  return `${whatWhere(item)}, ${commonText(item)} avec ton CV. Avec LeBonTaf Plus, tu reçois jusqu’à ${PLUS_DAILY_LIMIT} offres par jour au lieu de ${DAILY_LIMIT}. Le paiement n’est pas encore ouvert.`;
}
