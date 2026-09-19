import type { ScannedOffer } from "./types";

/**
 * Job-alert e-mails (LinkedIn, Indeed, Welcome to the Jungle, Hellowork, APEC)
 * are the compliant way to cover platforms that forbid scraping: the platform
 * itself sends the offers, we only read them.
 *
 * Alert layouts change often, so this parser is deliberately conservative: it
 * keeps only links that look like a job page, cleans them (no tracking), and
 * guesses company / location from the text that follows the link. Anything
 * uncertain is left empty ("À compléter") instead of invented.
 */

type Platform = "linkedin" | "indeed" | "wttj" | "hellowork" | "apec";

const PLATFORMS: {
  id: Platform;
  label: string;
  match: (u: URL) => string | null; // returns the canonical URL or null
}[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    match: (u) => {
      if (!/(^|\.)linkedin\.com$/.test(u.hostname)) return null;
      const m = u.pathname.match(/\/(?:comm\/)?jobs\/view\/(?:[^/]*-)?(\d{6,})/);
      return m ? `https://www.linkedin.com/jobs/view/${m[1]}/` : null;
    },
  },
  {
    id: "indeed",
    label: "Indeed",
    match: (u) => {
      if (!/(^|\.)indeed\.com$/.test(u.hostname)) return null;
      const jk = u.searchParams.get("jk");
      return jk && /^[a-f0-9]{8,}$/i.test(jk)
        ? `https://fr.indeed.com/viewjob?jk=${jk}`
        : null;
    },
  },
  {
    id: "wttj",
    label: "Welcome to the Jungle",
    match: (u) => {
      if (!/(^|\.)welcometothejungle\.com$/.test(u.hostname)) return null;
      const m = u.pathname.match(/^\/(fr|en)\/companies\/([^/]+)\/jobs\/([^/?#]+)/);
      return m
        ? `https://www.welcometothejungle.com/${m[1]}/companies/${m[2]}/jobs/${m[3]}`
        : null;
    },
  },
  {
    id: "hellowork",
    label: "Hellowork",
    match: (u) => {
      if (!/(^|\.)hellowork\.com$/.test(u.hostname)) return null;
      const m = u.pathname.match(/\/emplois\/(\d+)\.html/);
      return m ? `https://www.hellowork.com/fr-fr/emplois/${m[1]}.html` : null;
    },
  },
  {
    id: "apec",
    label: "APEC",
    match: (u) => {
      if (!/(^|\.)apec\.fr$/.test(u.hostname)) return null;
      const m = u.pathname.match(/detail-offre\/([A-Za-z0-9]+)/);
      return m
        ? `https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/${m[1]}`
        : null;
    },
  },
];

const NOISE =
  /^(voir|view|postuler|apply|see|afficher|d[ée]tails?|en savoir|consulter|unsubscribe|d[ée]sinscri|modifier|manage|plus d'offres|more jobs|easy apply|candidature simplifi)/i;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&rsquo;": "’",
  "&eacute;": "é",
  "&egrave;": "è",
};

export function decodeEntities(text: string) {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|rsquo|eacute|egrave|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Text of an HTML fragment, split into readable segments (one per block). */
export function textSegments(html: string): string[] {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/?(?:p|div|td|tr|br|li|h\d|span|a|table)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function titleFromSlug(slug: string) {
  return decodeURIComponent(slug)
    .replace(/_[A-Za-z0-9]{6,}$/, "") // WTTJ appends an id
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function parseAlertHtml(html: string, receivedAt: Date | null = null): ScannedOffer[] {
  const offers = new Map<string, ScannedOffer>();
  const anchor = /<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchor.exec(html))) {
    let url: URL;
    try {
      url = new URL(decodeEntities(m[1]));
    } catch {
      continue;
    }
    const platform = PLATFORMS.map((p) => ({ p, canonical: p.match(url) })).find(
      (x) => x.canonical,
    );
    if (!platform?.canonical) continue;

    const anchorText = textSegments(m[2]).join(" ");
    const following = textSegments(html.slice(anchor.lastIndex, anchor.lastIndex + 700));
    const good = (s: string) => s.length > 1 && s.length < 90 && !NOISE.test(s);

    let title = NOISE.test(anchorText) || anchorText.length < 4 ? "" : anchorText;
    let company = "";
    let location: string | null = null;

    if (platform.p.id === "wttj") {
      const parts = url.pathname.split("/");
      company = titleFromSlug(parts[3] || "");
      title = title || titleFromSlug(parts[5] || "");
    } else {
      const extra = following.filter(good);
      // Typical alert layout: title, then company, then location.
      company = extra[0] || "";
      location = extra[1] || null;
    }
    if (!title) {
      // A "Voir l'offre" style button: the title is the closest previous text.
      const before = textSegments(html.slice(Math.max(0, m.index - 500), m.index)).filter(good);
      title = before[before.length - 1] || "";
    }
    if (!title) continue;

    const previous = offers.get(platform.canonical);
    if (previous && previous.title.length >= title.length) continue;
    offers.set(platform.canonical, {
      source: `alert:${platform.p.id}`,
      company: company || "À compléter",
      title,
      location,
      contract_type: null,
      description: null,
      url: platform.canonical,
      applyUrl: null,
      publishedAt: receivedAt ? receivedAt.toISOString() : null,
    });
  }
  return [...offers.values()];
}
