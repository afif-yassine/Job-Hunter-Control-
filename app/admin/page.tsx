import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminApp } from "@/components/admin/admin-app";
import { demoGateway } from "@/components/admin/demo-fixtures";
import { growthFrom } from "@/lib/admin/growth";
import { demoAdmin, demoGrowthRaw, demoQuests } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin — LeBonTaf", robots: { index: false, follow: false } };

/** The admin space, apart from the students' one. Admins only. */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.demo === "1") {
    // Screenshot fixture: only served when DEMO_MODE=1 (never set in production).
    if (process.env.DEMO_MODE !== "1") notFound();
    const env = { ...process.env, AI_MODEL_ANALYSIS: "gemini-2.5-flash-lite" };
    return (
      <AdminApp
        email="yassine@example.com"
        demo={{ growth: growthFrom(demoGrowthRaw, demoQuests, env, new Date("2026-10-20T10:00:00Z")), overview: demoAdmin, gateway: demoGateway }}
      />
    );
  }
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/");
  return <AdminApp email={String(data.claims.email ?? "")} />;
}
