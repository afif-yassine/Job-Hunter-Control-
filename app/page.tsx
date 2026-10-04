import { Dashboard } from "@/components/dashboard";
import { Landing } from "@/components/jinnjob/landing";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export default async function Home() {
  const supabase = await createClient();
  if (!supabase) return <Dashboard />;
  const { data } = await supabase.auth.getClaims();
  // Visitors who are not signed in see the public LeBonTaf home page.
  if (!data?.claims?.sub) {
    const cookieStore = await cookies();
    const theme =
      cookieStore.get("lbt-home-theme")?.value === "dark" ? "dark" : "light";
    return (
      <Landing
        initialTheme={theme}
        initialOpening={cookieStore.get("lbt-home-intro")?.value !== "1"}
      />
    );
  }
  return <Dashboard userEmail={String(data.claims.email ?? "")} />;
}
