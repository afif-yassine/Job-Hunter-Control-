import type { GatewayCredits } from "@/lib/admin/gateway-credits";

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
