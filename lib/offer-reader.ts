import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AiUnavailable, aiConfigured, generateJson, type AiCall } from "@/lib/ai";
import { recordAiUsage } from "@/lib/ai-usage";
import { normalizeSkills } from "@/lib/skills";
import type { OfferSummary } from "@/lib/types";

/**
 * The shared reader: every open offer is read ONCE, for every student, by
 * the cheapest model. It writes the summary shown on the offer (missions,
 * tools, conditions) and the facts the free comparison needs (skills, level,
 * remote work). Then no student's visit ever pays to read it again.
 */

type Env = Record<string, string | undefined>;

const card = z.object({
  missions: z.array(z.string()).catch([]),
  stack: z.array(z.string()).catch([]),
  conditions: z.string().catch(""),
  skills: z.array(z.string()).catch([]),
  level: z.string().nullable().catch(null),
  remote: z.enum(["non", "partiel", "total"]).nullable().catch(null),
});

export const READER_VERSION = 1;

export function readerPrompt(o: { title: string; company?: string | null; location?: string | null; contract_type?: string | null; description: string }): string {
  return `Lis cette offre d'emploi et réponds en JSON, en français, en n'utilisant QUE ce qui est écrit dans l'offre (n'invente rien) :
{
 "missions": 3 phrases courtes max sur ce que la personne fera,
 "stack": outils et technologies cités (8 max, leur nom usuel),
 "conditions": une ligne avec contrat, durée, rythme, lieu, télétravail et salaire SEULEMENT s'ils sont écrits,
 "skills": 12 compétences demandées max, en minuscules, forme courte usuelle (ex : "python", "sql", "excel", "gestion de projet", "anglais", "comptabilité"),
 "level": niveau d'études demandé ("bac", "bac+2", "bac+3", "bac+5") ou null,
 "remote": "non", "partiel", "total" ou null s'il n'est pas indiqué
}
OFFRE=${JSON.stringify({ title: o.title, company: o.company, location: o.location, contract: o.contract_type, description: o.description.replace(/\s+/g, " ").slice(0, 6000) })}`;
}

/** The stored summary of one offer (offers.summary). */
export function parseCard(text: string): (OfferSummary & { skills: string[]; level: string | null; remote: string | null; v: number }) | null {
  try {
    const parsed = card.safeParse(JSON.parse(text || "{}"));
    if (!parsed.success) return null;
    const c = parsed.data;
    return {
      missions: c.missions.filter(Boolean).slice(0, 3),
      stack: c.stack.filter(Boolean).slice(0, 8),
      conditions: c.conditions.slice(0, 300),
      skills: normalizeSkills(c.skills, 12),
      level: c.level && /^bac(\+\d)?$/i.test(c.level.trim()) ? c.level.trim().toLowerCase() : null,
      remote: c.remote,
      v: READER_VERSION,
    };
  } catch {
    return null;
  }
}

type Pending = { id: string; title: string; company: string | null; location: string | null; contract_type: string | null; description: string | null; reader_token?: string };

/**
 * Reads open offers that have no summary yet, newest first (service client).
 * Returns how many were read. Stops cleanly when time runs out.
 */
export async function readPendingOffers(
  db: SupabaseClient,
  opts: { env?: Env; ai?: AiCall; limit?: number; concurrency?: number; timeLeft?: () => number } = {},
): Promise<{ read: number; failed: number }> {
  const env = opts.env ?? process.env;
  if (!opts.ai && !aiConfigured(env)) return { read: 0, failed: 0 };
  const ai: AiCall = opts.ai ?? ((prompt, task) => generateJson(prompt, task, env));
  const leased = env.AI_READER_LEASES === "1";
  if (opts.timeLeft && opts.timeLeft() < 8_000) return { read: 0, failed: 0 };
  const { data, error } = leased ? await db.rpc("claim_offer_readings", { p_limit: opts.limit ?? 60 }) : await db
    .from("offers")
    .select("id,title,company,location,contract_type,description")
    .eq("status", "open")
    .is("summary", null)
    .order("first_seen_at", { ascending: false })
    .limit(opts.limit ?? 60);
  if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);
  if (!data?.length) return { read: 0, failed: 0 };
  const queue = (data as Pending[]).filter((o) => (o.description ?? "").length >= 120);
  const reservations = queue.map(o => ({ id: o.id, token: o.reader_token }));
  let read = 0;
  let failed = 0;
  let stopped: unknown;
  const worker = async () => {
    for (let o = queue.shift(); o; o = queue.shift()) {
      if (stopped || (opts.timeLeft && opts.timeLeft() < 8_000)) return;
      try {
        const result = await ai(readerPrompt({ ...o, description: o.description ?? "" }), "reading");
        await recordAiUsage(db, null, "reading", result);
        const parsed = parseCard(result.text);
        if (!parsed) {
          failed += 1;
          continue;
        }
        const summary = { ...parsed, model: result.model, processed_at: new Date().toISOString() };
        const saved = leased
          ? await db.rpc("finish_offer_reading", { p_id: o.id, p_token: o.reader_token, p_summary: summary })
          : await db.from("offers").update({ summary }).eq("id", o.id).is("summary", null);
        if (saved.error || (leased && saved.data !== true)) failed += 1;
        else read += 1;
      } catch (err) {
        failed += 1;
        // A provider problem (credit, key) stops the round instead of repeating it 60 times.
        if (err instanceof AiUnavailable || /crédit|clé|Crédit|Clé/.test(err instanceof Error ? err.message : "")) { stopped = err; return; }
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.max(1, Math.min(6, opts.concurrency ?? 6)) }, worker));
    if (stopped) throw stopped;
  } finally {
    if (leased) {
      const released = await db.rpc("release_offer_readings", { p_rows: reservations });
      if (released.error && !stopped) throw new Error("Libération des lectures impossible ; les réservations expirent sous deux minutes.");
    }
  }
  return { read, failed };
}
