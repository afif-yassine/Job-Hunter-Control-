import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROVIDERS, providerById, type ProviderDef } from "@/lib/providers";

/**
 * API keys typed in the dashboard are encrypted (AES-256-GCM) with
 * INTEGRATIONS_SECRET before they reach the database, and are never sent back
 * to the browser: the UI only learns "configured or not" and the last 4 chars.
 */
const PREFIX = "v1:";

function key(secret: string | undefined) {
  if (!secret) throw new Error("INTEGRATIONS_SECRET n’est pas défini dans Vercel.");
  return createHash("sha256").update(secret).digest();
}

export function encryptValues(values: Record<string, string>, secret = process.env.INTEGRATIONS_SECRET) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(values), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decryptValues(
  stored: string,
  secret = process.env.INTEGRATIONS_SECRET,
): Record<string, string> {
  if (!stored.startsWith(PREFIX)) throw new Error("Format de secret inconnu.");
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  return JSON.parse(text) as Record<string, string>;
}

type Row = { provider: string; secret_enc: string; updated_at?: string };

async function rows(supabase: SupabaseClient, userId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("provider,secret_enc,updated_at")
    .eq("user_id", userId);
  if (error) return []; // table not migrated yet: behave as "nothing saved"
  return (data ?? []) as Row[];
}

/** Environment-style map (FRANCE_TRAVAIL_CLIENT_ID → value) from saved keys. */
export async function loadIntegrationEnv(
  supabase: SupabaseClient,
  userId: string,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const row of await rows(supabase, userId)) {
    try {
      Object.assign(out, decryptValues(row.secret_enc));
    } catch {
      // Unreadable (secret rotated): ignored, shown as "à reconfigurer".
    }
  }
  return out;
}

export type ProviderStatus = {
  id: ProviderDef["id"];
  configured: boolean;
  origin: "app" | "env" | null;
  /** "••••abcd" for the first secret field, so the user recognises the key. */
  hint: string | null;
  updatedAt: string | null;
  needsReset: boolean;
};

function mask(value: string | undefined) {
  return value && value.length >= 4 ? `••••${value.slice(-4)}` : value ? "••••" : null;
}

export async function integrationStatus(
  supabase: SupabaseClient | null,
  userId: string | null,
  env: Record<string, string | undefined> = process.env,
): Promise<ProviderStatus[]> {
  const saved = supabase && userId ? await rows(supabase, userId) : [];
  return PROVIDERS.map((provider) => {
    const row = saved.find((r) => r.provider === provider.id);
    let values: Record<string, string> | null = null;
    let needsReset = false;
    if (row) {
      try {
        values = decryptValues(row.secret_enc);
      } catch {
        needsReset = true;
      }
    }
    const complete = (source: Record<string, string | undefined>) =>
      provider.fields.every((f) => Boolean(source[f.key]?.trim()));
    const fromApp = values && complete(values);
    const fromEnv = complete(env);
    const first = provider.fields.find((f) => f.secret) ?? provider.fields[0];
    return {
      id: provider.id,
      configured: Boolean(fromApp || fromEnv),
      origin: fromApp ? "app" : fromEnv ? "env" : null,
      hint: fromApp ? mask(values?.[first.key]) : null,
      updatedAt: row?.updated_at ?? null,
      needsReset,
    };
  });
}

/**
 * Keys are often copied straight from the provider's e-mail, where they sit
 * between quotes followed by a period (Jooble: `Votre clé API unique : "…".`).
 * Only a value wrapped in quotes is touched: an ordinary key stays as typed.
 */
export function cleanKey(raw: string): string {
  const value = raw.trim();
  const quoted = value.match(/^["'“”«»‘’`]\s*([\s\S]*?)\s*["'“”«»‘’`][.,;:!]?$/);
  return quoted ? quoted[1] : value;
}

export async function saveIntegration(
  supabase: SupabaseClient,
  userId: string,
  providerId: string,
  input: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const provider = providerById(providerId);
  if (!provider) return { ok: false, error: "Source inconnue." };
  const values: Record<string, string> = {};
  for (const field of provider.fields) {
    const value = typeof input[field.key] === "string" ? cleanKey(input[field.key] as string) : "";
    if (!value) return { ok: false, error: `Champ manquant : ${field.label}.` };
    if (value.length > 600) return { ok: false, error: `${field.label} est trop long.` };
    values[field.key] = value;
  }
  let secret_enc: string;
  try {
    secret_enc = encryptValues(values);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chiffrement impossible." };
  }
  const { error } = await supabase.from("integrations").upsert(
    { user_id: userId, provider: provider.id, secret_enc, updated_at: new Date().toISOString() },
    { onConflict: "user_id,provider" },
  );
  if (error)
    return {
      ok: false,
      error: /relation|does not exist|schema cache/i.test(error.message)
        ? "La table « integrations » n’existe pas : applique la migration Supabase 20260921090000."
        : error.message,
    };
  return { ok: true };
}

export async function deleteIntegration(supabase: SupabaseClient, userId: string, providerId: string) {
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", providerId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
