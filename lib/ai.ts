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
export type AiResult = {
  text: string;
  model: string;
  /** Tokens billed by the provider (absent in tests or if not reported). */
  usage?: { input: number; output: number };
};
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
  const meta = result.usageMetadata;
  const usage = meta
    ? {
        input: meta.promptTokenCount ?? 0,
        // Thinking tokens are billed as output.
        output: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
      }
    : undefined;
  return { text: result.text || "", model, usage };
}

/**
 * Approximate price in US dollars per million tokens, to estimate the cost
 * per account in Admin. Defaults are those of a "flash" model; set
 * AI_PRICE_INPUT_PER_M / AI_PRICE_OUTPUT_PER_M to your model's real prices.
 */
export function aiPrices(env: Env = process.env): { input: number; output: number } {
  const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
  return { input: num(env.AI_PRICE_INPUT_PER_M, 0.3), output: num(env.AI_PRICE_OUTPUT_PER_M, 2.5) };
}

export function aiCost(tokens: { input: number; output: number }, env: Env = process.env): number {
  const p = aiPrices(env);
  return (tokens.input * p.input + tokens.output * p.output) / 1_000_000;
}

export const defaultAi: AiCall = (prompt, task) => generateJson(prompt, task);

/** Reads a PDF (a CV) and answers in JSON. The file is sent inline, never stored by us. */
export async function generateJsonFromPdf(
  prompt: string,
  pdf: Uint8Array,
  task: AiTask,
  env: Env = process.env,
): Promise<AiResult> {
  if (!aiConfigured(env)) throw new Error(AI_NOT_CONFIGURED);
  const model = modelFor(task, env);
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const result = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: "application/pdf", data: Buffer.from(pdf).toString("base64") } }, { text: prompt }],
      },
    ],
    config: { responseMimeType: "application/json" },
  });
  const meta = result.usageMetadata;
  return {
    text: result.text || "",
    model,
    usage: meta ? { input: meta.promptTokenCount ?? 0, output: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0) } : undefined,
  };
}

/** Injected in tests: (prompt, pdf) → JSON text. */
export type PdfAiCall = (prompt: string, pdf: Uint8Array) => Promise<AiResult>;
