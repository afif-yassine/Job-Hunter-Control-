import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Landing } from "@/components/jinnjob/landing";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Public homepage, also accessible to signed-in users reviewing the identity. */
export default async function PublicHome() {
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
