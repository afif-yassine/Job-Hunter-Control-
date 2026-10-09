import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageText,
  CARD_DIALOG,
  cardSpoken,
  cardsToShow,
  commonText,
  dialogPhrase,
  endPhrase,
  endTitle,
  morePhrase,
  moreTitle,
  parseTeaser,
  placeText,
  skillsText,
  type TeaserItem,
} from "../components/teaser-cards";
import { parseUnlocked } from "../components/unlock";

const item: TeaserItem = { score: 71, common: 5, skills: ["Python", "SQL"], contract: "Alternance", department: { code: "69", name: "Rhône" }, publishedAgoDays: 3 };
const raw = (over: Record<string, unknown> = {}) => ({ score: 71, common: 5, skills: ["Python", "SQL"], contract: "Alternance", department: { code: "69", name: "Rhône" }, publishedAgoDays: 3, ...over });

test("a teaser is read strictly: one malformed card makes it unusable, never a guess", () => {
  assert.deepEqual(parseTeaser({ items: [raw()], more: 5 }), { items: [item], more: 5 });
  assert.equal(parseTeaser(null), null);
  assert.equal(parseTeaser({ items: [raw({ contract: "" })], more: 5 }), null);
  assert.equal(parseTeaser({ items: [raw({ department: null })], more: 5 }), null);
  assert.equal(parseTeaser({ items: [raw()], more: "5" }), null);
  // More than two skill names: only two are kept.
  assert.equal(parseTeaser({ items: [raw({ skills: ["a", "b", "c"] })], more: 1 })?.items[0].skills.length, 2);
});

test("never a title, a company, a link or an id is read from the server", () => {
  const parsed = parseTeaser({ items: [raw({ title: "Dev", company: "Acme", link: "https://x", jobId: "j1" })], more: 1 });
  assert.deepEqual(Object.keys(parsed!.items[0]).sort(), ["common", "contract", "department", "publishedAgoDays", "score", "skills"]);
});

test("at most three cards, never more than the offers Plus would add, none when there is nothing more", () => {
  const four = { items: [item, item, item, item], more: 12 };
  assert.equal(cardsToShow(four).length, 3);
  assert.equal(cardsToShow({ items: [item, item, item], more: 2 }).length, 2);
  assert.equal(cardsToShow({ items: [item], more: 0 }).length, 0);
  assert.equal(cardsToShow(null).length, 0);
  assert.equal(cardsToShow(undefined).length, 0);
});

test("the facts are written as the plan says: real count, department, real age", () => {
  assert.equal(commonText(item), "5 compétences en commun");
  assert.equal(commonText({ ...item, common: 1 }), "1 compétence en commun");
  assert.equal(skillsText(item), "Python, SQL et 3 autres");
  assert.equal(skillsText({ ...item, common: 3 }), "Python, SQL et 1 autre");
  assert.equal(skillsText({ ...item, common: 2 }), "Python, SQL");
  assert.equal(skillsText({ ...item, skills: [] }), null);
  assert.equal(placeText(item), "Rhône (69)");
  assert.equal(ageText(3), "Publiée il y a 3 jours");
  assert.equal(ageText(1), "Publiée hier");
  assert.equal(ageText(0), "Publiée aujourd’hui");
});

test("a card is read by a screen reader in one sentence, with the department and no company", () => {
  assert.equal(cardSpoken(item), "Offre proposée avec LeBonTaf Plus : alternance · Rhône (69), 5 compétences en commun, publiée il y a 3 jours");
});

test("the words of moments 3 and 4 and of the window are the plan's", () => {
  assert.equal(moreTitle(5), "5 autres offres te correspondent aujourd’hui");
  assert.equal(moreTitle(1), "1 autre offre te correspond aujourd’hui");
  assert.equal(morePhrase(), "Elles passent le même tri que tes offres du jour. Avec LeBonTaf Plus, tu en reçois jusqu’à 20 par jour au lieu de 8.");
  assert.equal(endTitle(8), "Tu as fait le tour de tes 8 offres du jour");
  assert.equal(endTitle(5), "Tu as fait le tour de tes 5 offres du jour");
  assert.equal(endPhrase(5), "De nouvelles offres arrivent demain. Avec LeBonTaf Plus, 5 de plus dès aujourd’hui.");
  assert.equal(CARD_DIALOG.title, "Cette offre fait partie de LeBonTaf Plus");
  assert.equal(CARD_DIALOG.stay, "Rester sur mes 8 offres");
  assert.equal(dialogPhrase(item), "Alternance · Rhône (69), 5 compétences en commun avec ton CV. Avec LeBonTaf Plus, tu reçois jusqu’à 20 offres par jour au lieu de 8. Le paiement n’est pas encore ouvert.");
});

test("nothing false or pressing is written: no urgency, no countdown, no guarantee, no 'illimité'", () => {
  const all = [moreTitle(3), morePhrase(), endTitle(8), endPhrase(4), CARD_DIALOG.title, CARD_DIALOG.stay, dialogPhrase(item), cardSpoken(item)].join(" ");
  assert.doesNotMatch(all, /illimité|toutes les offres|exclusi|bientôt|dernière chance|plus que|expire|garanti|débloque/i);
});

test("the answer of the route carries the teaser, and an absent or broken one is no card", () => {
  const ok = parseUnlocked({ unlocked: [], reason: "COMPUTING", teaser: { items: [raw()], more: 4 } });
  assert.equal(ok?.teaser?.more, 4);
  assert.equal(parseUnlocked({ unlocked: [] })?.teaser, null);
  assert.equal(parseUnlocked({ unlocked: [], teaser: { items: "x", more: 1 } })?.teaser, null);
});
