import assert from "node:assert/strict";
import { test } from "node:test";
import { PRICING, pricingEnabled, pricingMailto } from "../components/pricing";

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
  const all = [PRICING.lead, PRICING.why, PRICING.terms, ...PRICING.free.lines].join(" ");
  assert.doesNotMatch(all, /\bPro\b|illimité|garanti|embauch|décroche|offres? en plus|toutes les offres/i);
});
