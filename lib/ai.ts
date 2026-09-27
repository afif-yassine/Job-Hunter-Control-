import { GoogleGenAI } from "@google/genai";

/**
 * The only place that talks to an AI provider. Changing model or provider is
 * a configuration change (AI_PROVIDER / AI_MODEL…), never a code hunt, and
 * every result says which model produced it so history stays readable.
 *
 * - AI_MODEL_ANALYSIS: scoring (high volume → a cheap model is fine)
 * - AI_MODEL_WRITING: CV, letter, revisions (quality matters more)
 * - AI_MODEL: default for both
 */

export const DEFAULT_MODEL = "gemini-3.6-flash";

export type AiTask = "analysis" | "writing";
export type AiResult = { text: string; model: string };
/** Injected in tests; defaults to the configured provider. */
export type AiCall = (prompt: string, task: AiTask) => Promise<AiResult>;

type Env = Record<string, string | undefined>;

export function aiConfigured(env: Env = process.env): boolean {
  return Boolean(env.GEMINI_API_KEY?.trim());
}

export function modelFor(task: AiTask, env: Env = process.env): string {
  const specific = task === "analysis" ? env.AI_MODEL_ANALYSIS : env.AI_MODEL_WRITING;
  return specific?.trim() || env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

export const AI_NOT_CONFIGURED = "GEMINI_API_KEY is not configured";

/** One prompt in, one JSON text out. */
export async function generateJson(prompt: string, task: AiTask, env: Env = process.env): Promise<AiResult> {
  const provider = (env.AI_PROVIDER || "gemini").trim().toLowerCase();
  if (provider !== "gemini") throw new Error(`Fournisseur IA non pris en charge : ${provider}`);
  if (!aiConfigured(env)) throw new Error(AI_NOT_CONFIGURED);
  const model = modelFor(task, env);
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return { text: result.text || "", model };
}

export const defaultAi: AiCall = (prompt, task) => generateJson(prompt, task);
