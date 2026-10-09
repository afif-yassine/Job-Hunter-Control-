import type { Metadata } from "next";
import { Landing } from "@/components/jinnjob/landing";
import { pricingEnabled } from "@/components/pricing";

export const metadata: Metadata = { alternates: { canonical: "/" } };
// PRICING_PAGE decides whether the footer lists the pricing page: read at each request.
export const dynamic = "force-dynamic";

/** Public homepage, also reachable by signed-in users who want to see it. */
export default function PublicHome() {
  return <Landing pricing={pricingEnabled(process.env.PRICING_PAGE)} />;
}
