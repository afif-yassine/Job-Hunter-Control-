import { isIP } from "node:net";
import { htmlToText } from "./text";

/**
 * Best-effort: reads the public ad page so that offers coming from aggregators
 * (which only give a short extract) can be scored on the full text. It makes a
 * single polite request per offer and gives up on bot walls / login pages: it
 * never tries to get around a protection.
 */
const WALL =
  /(captcha|verify you are human|are you a robot|enable javascript|access denied|just a moment|cf-browser-verification|sign in to (continue|view)|connectez-vous pour|please log in)/i;

export function isPublicHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && !u.username && !u.password && (!u.port || u.port === "443") && h !== "localhost" && !h.endsWith(".localhost") && !h.endsWith(".local") && !isIP(h.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}

type JsonLd = { "@type"?: string | string[]; description?: string; "@graph"?: JsonLd[] };

function jobPostingDescription(html: string): string | null {
  const blocks = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1].trim()) as JsonLd | JsonLd[];
      const nodes = (Array.isArray(data) ? data : [data]).flatMap((n) => [n, ...(n["@graph"] ?? [])]);
      for (const node of nodes) {
        const types = ([] as string[]).concat(node["@type"] ?? []);
        if (types.includes("JobPosting") && node.description) return htmlToText(node.description);
      }
    } catch {
      // Malformed JSON-LD: try the next block.
    }
  }
  return null;
}

export function extractJobText(html: string): string | null {
  const structured = jobPostingDescription(html);
  if (structured && structured.length >= 300) return structured.slice(0, 8000);
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const text = htmlToText(body);
  if (text.length < 500 || WALL.test(text.slice(0, 1500))) return null;
  return text.slice(0, 8000);
}

export async function fetchJobText(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!isPublicHttpsUrl(url)) return null;
  try {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; JobHunterControl/1.0; personal job assistant)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.6",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    if (!/html/i.test(response.headers.get("content-type") || "")) return null;
    const html = (await response.text()).slice(0, 1_500_000);
    return extractJobText(html);
  } catch {
    return null;
  }
}
