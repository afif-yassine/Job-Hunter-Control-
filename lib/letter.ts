/**
 * Turns the stored letter text into the parts of a real French business
 * letter: subject line, salutation, paragraphs, closing formula.
 *
 * New letters are generated with blank lines between paragraphs. Older ones
 * were saved as one single block of text, so a sentence-based fallback splits
 * them into readable paragraphs.
 */

export type LetterParts = {
  subject: string | null;
  salutation: string;
  paragraphs: string[];
  closing: string | null;
};

const SALUTATION =
  /^(madame,?\s*monsieur|madame|monsieur|bonjour|chers?\s+[^,]{2,40}|cher\s+[^,]{2,40})\s*,?$/i;
const SALUTATION_INLINE =
  /(Madame,\s*Monsieur,?|Bonjour\s*,|Madame,|Monsieur,)/;
const CLOSING_START =
  /^(veuillez\s+agr[ée]er|je\s+vous\s+prie\s+d['’]agr[ée]er|dans\s+l['’]attente|en\s+vous\s+remerciant|cordialement|bien\s+cordialement|je\s+reste\s+[àa]\s+votre)/i;

const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();

function sentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Ý«"“(])/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Groups sentences in ~3 balanced paragraphs. */
function chunk(list: string[]): string[] {
  if (list.length <= 2) return [list.join(" ")];
  const groups = Math.min(3, Math.ceil(list.length / 2));
  const size = Math.ceil(list.length / groups);
  const out: string[] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size).join(" "));
  return out;
}

export function parseLetter(raw: string, fallbackSubject?: string | null): LetterParts {
  const text = (raw || "").replace(/\r/g, "").trim();
  let subject: string | null = null;
  let salutation = "Madame, Monsieur,";
  let closing: string | null = null;
  let paragraphs: string[];

  const blocks = text
    .split(/\n\s*\n/)
    .map(clean)
    .filter(Boolean);

  if (blocks.length >= 3) {
    paragraphs = [...blocks];
    if (/^objet\s*:/i.test(paragraphs[0])) subject = paragraphs.shift()!;
    if (paragraphs.length && SALUTATION.test(paragraphs[0])) {
      salutation = paragraphs.shift()!.replace(/,?$/, ",");
    }
    const last = paragraphs[paragraphs.length - 1];
    if (last && CLOSING_START.test(last)) closing = paragraphs.pop()!;
  } else {
    let body = clean(text);
    const subj = body.match(/^(objet\s*:.*?)(?=\s*(?:Madame,\s*Monsieur|Bonjour|Madame,|Monsieur,)|$)/i);
    if (subj && subj[1].length < 220) {
      subject = subj[1].trim();
      body = body.slice(subj[0].length).trim();
    }
    const sal = body.match(SALUTATION_INLINE);
    if (sal && sal.index !== undefined && sal.index < 8) {
      salutation = sal[1].replace(/,?$/, ",");
      body = body.slice(sal.index + sal[0].length).trim();
    }
    const list = sentences(body);
    const closeIndex = list.findIndex((s) => CLOSING_START.test(s));
    // Keep the courtesy formula whole: from its first sentence to the end,
    // unless it is the very first sentence of the body.
    if (closeIndex > 0) {
      closing = list.slice(closeIndex).join(" ");
      list.length = closeIndex;
    }
    paragraphs = chunk(list);
  }

  if (subject) subject = subject.replace(/^objet\s*:\s*/i, "Objet : ");
  else if (fallbackSubject) subject = `Objet : ${fallbackSubject}`;
  return { subject, salutation, paragraphs: paragraphs.filter(Boolean), closing };
}
