import { Dashboard } from "@/components/dashboard";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  if (!supabase) return <Dashboard />;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return <Dashboard userEmail={String(data.claims.email ?? "")} />;
}
