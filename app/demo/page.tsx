import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { demoAdmin, demoData, demoStatus } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

// Screenshot fixture: only served when DEMO_MODE=1 (never set in production).
export default function Demo() {
  if (process.env.DEMO_MODE !== "1") notFound();
  return <Dashboard userEmail="yassine@example.com" demo={{ data: demoData, status: demoStatus, admin: demoAdmin }} />;
}
