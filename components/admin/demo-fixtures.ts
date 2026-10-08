import type { GatewayCredits } from "@/lib/admin/gateway-credits";
import type { AccountsPage } from "@/lib/admin/users";

/**
 * Made-up data for the admin demo page (DEMO_MODE=1 only, never served in production).
 * Every figure and address below is fictitious; the note says so on screen.
 */
export const demoGateway: GatewayCredits = {
  at: "2026-10-20T10:00:00.000Z",
  gateway: {
    available: true,
    balanceUsd: 8.42,
    totalUsedUsd: 3.58,
    origin: "measured",
    scope: "Démo : données factices, pas le solde d’une vraie clé.",
  },
  recorded: { usd: 3.1, calls: 412, unpricedCalls: 6, origin: "measured_or_estimated" },
  gapUsd: 0.48,
  note: "Démo : données factices.",
};

/** Three fictitious accounts (addresses on a reserved domain), with unknown values on purpose to show the dashes. */
export const demoAccounts: AccountsPage = {
  at: "2026-10-20T10:00:00.000Z",
  page: 1,
  perPage: 25,
  total: 3,
  hasMore: false,
  aiCostOrigin: "measured_or_estimated",
  accounts: [
    { userId: "demo-1", email: "etudiante-1@exemple.invalid", createdAt: "2026-09-12T09:00:00.000Z", lastSignInAt: "2026-10-19T18:30:00.000Z", hasCv: true, plan: "free", isAdmin: false, kitsThisMonth: 2, aiCalls30d: 31, aiCostUsd30d: 0.12 },
    { userId: "demo-2", email: "etudiant-2@exemple.invalid", createdAt: "2026-10-02T14:10:00.000Z", lastSignInAt: null, hasCv: false, plan: "free", isAdmin: false, kitsThisMonth: 0, aiCalls30d: 0, aiCostUsd30d: 0 },
    { userId: "demo-3", email: null, createdAt: null, lastSignInAt: null, hasCv: null, plan: null, isAdmin: null, kitsThisMonth: null, aiCalls30d: null, aiCostUsd30d: null },
  ],
};
