import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiResult, AiTask } from "@/lib/ai";

/** Remembers the tokens of one AI call for this account (Admin: cost per account). Never throws. */
export async function recordAiUsage(supabase: SupabaseClient, userId: string, task: AiTask, result: AiResult): Promise<void> {
  if (!result.usage) return;
  try {
    await supabase.from("ai_usage").insert({
      user_id: userId,
      task,
      model: result.model,
      input_tokens: result.usage.input,
      output_tokens: result.usage.output,
    });
  } catch {
    // Accounting must never break the feature.
  }
}
