import { Dashboard } from "@/components/dashboard";
import { Landing } from "@/components/jinnjob/landing";
import { pricingEnabled } from "@/components/pricing";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const pricing = pricingEnabled(process.env.PRICING_PAGE);
  const supabase = await createClient();
  if (!supabase) return <Dashboard pricing={pricing} />;
  const { data } = await supabase.auth.getClaims();
  // Visitors who are not signed in see the public LeBonTaf home page.
  if (!data?.claims?.sub) return <Landing pricing={pricing} />;
  // The id of the account this page is rendered for: the browser reloads if its session later belongs to another one.
  return <Dashboard userEmail={String(data.claims.email ?? "")} userId={String(data.claims.sub)} pricing={pricing} />;
}
