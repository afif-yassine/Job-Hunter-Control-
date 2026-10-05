import type { Metadata } from "next";
import { Landing } from "@/components/jinnjob/landing";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Public homepage, also reachable by signed-in users who want to see it. */
export default function PublicHome() {
  return <Landing />;
}
