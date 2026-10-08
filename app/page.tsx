import { Dashboard } from "@/components/dashboard";
import { Landing } from "@/components/jinnjob/landing";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  if (!supabase) return <Dashboard />;
  const { data } = await supabase.auth.getClaims();
  // Visitors who are not signed in see the public LeBonTaf home page.
  if (!data?.claims?.sub) return <Landing />;
  // The id of the account this page is rendered for: the browser reloads if its session later belongs to another one.
  return <Dashboard userEmail={String(data.claims.email ?? "")} userId={String(data.claims.sub)} />;
}
