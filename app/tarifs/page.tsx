import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/jinnjob/legal";
import { PRICING, pricingEnabled, pricingMailto } from "@/components/pricing";
import { BRAND } from "@/lib/brand";

// PRICING_PAGE is read at each request, so turning it off needs no new build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRICING.name} — ${BRAND.name}`,
  description: PRICING.description,
};

export default function PricingPage() {
  if (!pricingEnabled(process.env.PRICING_PAGE)) notFound();
  return (
    <LegalPage title={PRICING.name} lead={<p>{PRICING.lead}</p>}>
      <div className="pricing-grid">
        <section className="pricing-card" aria-labelledby="pr-free">
          <h2 id="pr-free">{PRICING.free.name}</h2>
          <ul>
            {PRICING.free.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        {PRICING.plans.map((plan) => (
          <section key={plan.id} className="pricing-card is-plus" aria-labelledby={`pr-${plan.id}`}>
            <h2 id={`pr-${plan.id}`}>{plan.name}</h2>
            <p className="pricing-price">{plan.price}</p>
            <ul>
              {PRICING.plusLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p>{PRICING.truth}</p>
      <p>{PRICING.terms}</p>
      <p>
        <strong>{PRICING.notOpen}</strong>
      </p>
      <p>
        <a className="jj-ribbon" href={pricingMailto()}>
          {PRICING.action}
        </a>
      </p>
    </LegalPage>
  );
}
