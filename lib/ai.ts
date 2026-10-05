import { GoogleGenAI } from "@google/genai";

/**
 * The only place that talks to an AI provider. Changing model or provider is
 * a configuration change (AI_PROVIDER / AI_MODEL…), never a code hunt, and
 * every result says which model produced it so history stays readable.
 *
 * - AI_MODEL_ANALYSIS: scoring (high volume → a cheap model is fine)
 * - AI_MODEL_WRITING: CV, letter, revisions (quality matters more)
 * - AI_MODEL_READING: reading each offer once for everybody (cheapest)
 * - AI_MODEL: default for analysis and writing
 */

export const DEFAULT_MODEL = "gemini-3.6-flash";

export type AiTask = "analysis" | "writing" | "reading";
export const DEFAULT_READING_MODEL = "gemini-2.5-flash-lite";
/** The detailed analysis is on demand and short: the cheap model is enough. */
export const DEFAULT_ANALYSIS_MODEL = "gemini-2.5-flash-lite";
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
  if (task === "reading") return env.AI_MODEL_READING?.trim() || DEFAULT_READING_MODEL;
  if (task === "analysis") return env.AI_MODEL_ANALYSIS?.trim() || env.AI_MODEL?.trim() || DEFAULT_ANALYSIS_MODEL;
  return env.AI_MODEL_WRITING?.trim() || env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

export const AI_NOT_CONFIGURED = "GEMINI_API_KEY is not configured";

/**
 * Provider errors in plain French. The raw JSON of Gemini ("prepayment
 * credits are depleted"…) is never shown as such.
 */
export function explainAiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/prepay|credits? (are )?depleted|billing|\b402\b/i.test(raw))
    return "Crédit IA épuisé : le compte Google AI Studio de la plateforme n’a plus de crédit. L’administrateur doit le recharger (ai.studio > Billing).";
  if (/RESOURCE_EXHAUSTED|\b429\b|quota|rate.?limit/i.test(raw))
    return "Limite de l’IA atteinte pour le moment : réessaie dans quelques minutes.";
  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|\b40[13]\b/i.test(raw))
    return "Clé IA refusée : vérifie GEMINI_API_KEY dans Vercel.";
  if (/\b50[0-9]\b|UNAVAILABLE|overloaded|INTERNAL/i.test(raw)) return "L’IA est momentanément indisponible : réessaie dans un instant.";
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

export class AiUnavailable extends Error {
  constructor(error: unknown) {
    super(explainAiError(error));
    this.name = "AiUnavailable";
  }
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new AiUnavailable(error);
  }
}

/** One prompt in, one JSON text out. */
export async function generateJson(prompt: string, task: AiTask, env: Env = process.env): Promise<AiResult> {
  const provider = (env.AI_PROVIDER || "gemini").trim().toLowerCase();
  if (provider !== "gemini") throw new Error(`Fournisseur IA non pris en charge : ${provider}`);
  if (!aiConfigured(env)) throw new Error(AI_NOT_CONFIGURED);
  const model = modelFor(task, env);
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const result = await call(() =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    }),
  );
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
  const result = await call(() =>
    ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType: "application/pdf", data: Buffer.from(pdf).toString("base64") } }, { text: prompt }],
        },
      ],
      config: { responseMimeType: "application/json" },
    }),
  );
  const meta = result.usageMetadata;
  return {
    text: result.text || "",
    model,
    usage: meta ? { input: meta.promptTokenCount ?? 0, output: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0) } : undefined,
  };
}

/** Injected in tests: (prompt, pdf) → JSON text. */
export type PdfAiCall = (prompt: string, pdf: Uint8Array) => Promise<AiResult>;
