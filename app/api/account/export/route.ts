import { exportTables } from "@/lib/account-export";
import { authenticatedClient } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { serviceClient } from "@/lib/supabase/admin";

/** "Télécharger mes données" (RGPD art. 15 and 20): one JSON file with everything the account owns. */
export async function GET() {
  const auth = await authenticatedClient("probe");
  if ("error" in auth) return auth.error;
  const { data: me } = await auth.supabase.auth.getUser();
  // The service client reads tables the account cannot list itself (usage counters…), always filtered on its id.
  const db = serviceClient() ?? auth.supabase;
  const { tables, notes, incomplete } = await exportTables(db, auth.userId);
  const payload = {
    service: BRAND.name,
    exportedAt: new Date().toISOString(),
    account: {
      id: auth.userId,
      email: me.user?.email ?? null,
      createdAt: me.user?.created_at ?? null,
      lastSignInAt: me.user?.last_sign_in_at ?? null,
      providers: Array.from(new Set((me.user?.identities ?? []).map((i) => i.provider))),
    },
    notes,
    incomplete,
    tables,
  };
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${BRAND.name.toLowerCase()}-mes-donnees-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
