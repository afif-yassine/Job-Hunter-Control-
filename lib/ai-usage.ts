import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiResult, AiTask } from "@/lib/ai";
import { callCost } from "@/lib/economics";

/**
 * Remembers the tokens and the cost of one AI call (Admin: costs per account
 * and per model). `userId` is null for the platform's shared work (reading
 * and embedding the catalogue). Never throws.
 */
export async function recordAiUsage(
  supabase: SupabaseClient,
  userId: string | null,
  task: AiTask | "embedding",
  result: { model: string; usage?: AiResult["usage"]; text?: string; costUsd?: number },
): Promise<void> {
  if (!result.usage) return;
  try {
    await supabase.from("ai_usage").insert({
      user_id: userId,
      task,
      model: result.model,
      input_tokens: result.usage.input,
      output_tokens: result.usage.output,
      cost_usd: typeof result.costUsd === "number" && Number.isFinite(result.costUsd) && result.costUsd >= 0 ? result.costUsd : Number(callCost(result.model, result.usage).toFixed(6)),
    });
  } catch {
    // Accounting must never break the feature.
  }
}
