import assert from "node:assert/strict";
import { test } from "node:test";
import { PRICING, pricingEnabled, pricingHref, pricingMailto, whyKitsLimited } from "../components/pricing";
import { DAILY_LIMIT, PLUS_DAILY_LIMIT } from "../components/unlock";

test("the page is on unless PRICING_PAGE is exactly 0", () => {
  assert.equal(pricingEnabled(undefined), true);
  assert.equal(pricingEnabled(""), true);
  assert.equal(pricingEnabled("1"), true);
  assert.equal(pricingEnabled("0"), false);
  assert.equal(pricingEnabled(" 0 "), false);
});

test("the prices, the terms and the not-open line are the judgment's", () => {
  assert.deepEqual(PRICING.plans.map((p) => `${p.name} ${p.price}`), ["30 jours 7,99 €", "6 mois 34,99 €"]);
  assert.match(PRICING.terms, /Paiement unique, TTC/);
  assert.match(PRICING.terms, /18 ans et plus/);
  assert.equal(PRICING.notOpen, "Le paiement n’est pas encore ouvert.");
  assert.equal(PRICING.action, "Demander l’accès anticipé");
});

test("the request is a mail to the contact address, never a payment", () => {
  assert.match(pricingMailto(), /^mailto:support@lebontaf\.com\?subject=/);
});

test("nothing promised that is forbidden", () => {
  const all = [PRICING.lead, PRICING.description, whyKitsLimited(2), PRICING.terms, PRICING.truth, ...PRICING.free.lines, ...PRICING.plusLines].join(" ");
  assert.doesNotMatch(all, /\bPro\b|illimité|exclusi|introuvable|débloque|décroche|toutes les offres|partenaire|barré/i);
  // The promise of "no guarantee" is written, not forbidden: only a promise of result would be wrong.
  assert.match(PRICING.truth, /ne garantit ni réponse, ni entretien, ni embauche/);
});

test("the numbers come from one place and the page says 8 or 20, 2 or 30", () => {
  assert.deepEqual(PRICING.free.lines.slice(0, 2), [`Jusqu’à ${DAILY_LIMIT} offres par jour, choisies selon ton CV`, "2 dossiers (CV et lettre) par mois"]);
  assert.deepEqual(PRICING.plusLines, [`Jusqu’à ${PLUS_DAILY_LIMIT} offres par jour, choisies selon ton CV`, "30 dossiers (CV et lettre) par mois"]);
  assert.equal(PRICING.lead, "Plus d’offres choisies pour toi chaque jour, et plus de dossiers (CV et lettre) chaque mois.");
  assert.doesNotMatch(PRICING.lead, /les mêmes pour tout le monde/);
  assert.equal(whyKitsLimited(2), "Chaque dossier est écrit par une IA qui nous coûte de l’argent : 2 sont offerts chaque mois, 30 avec LeBonTaf Plus.");
});

test("every link to the page says where it comes from", () => {
  assert.equal(pricingHref("fiche"), "/tarifs?de=fiche");
  assert.equal(pricingHref(), "/tarifs");
});
