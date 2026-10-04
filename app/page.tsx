import { Dashboard } from "@/components/dashboard";
import { Landing } from "@/components/jinnjob/landing";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  if (!supabase) return <Dashboard />;
  const { data } = await supabase.auth.getClaims();
  // Visitors who are not signed in see the public JinnJob home page.
  if (!data?.claims?.sub) return <Landing />;
  return <Dashboard userEmail={String(data.claims.email ?? "")} />;
}
