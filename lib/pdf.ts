import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";
import { ACCENT_RGB, normalizeDesign, type Design } from "@/lib/design";
import { parseLetter } from "@/lib/letter";

type StoredDocument = {
  kind: string;
  filename: string;
  content_text: string | null;
};

export type Identity = {
  name: string;
  city: string;
  email: string;
  links: string[];
};

export type RenderContext = {
  /** Company / job the document is written for (used in the letter header). */
  company?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  identity?: Partial<Identity>;
  now?: Date;
};

const DEFAULT_IDENTITY: Identity = {
  name: "Yassine AFIF",
  city: "Paris 20e",
  email: "yassine.afif.ma@gmail.com",
  links: ["linkedin.com/in/yassine-afif", "github.com/afif-yassine"],
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 46;
const MARGIN_TOP = 42;
const MARGIN_BOTTOM = 40;
const INK = rgb(0.11, 0.14, 0.2);
const MUTED = rgb(0.38, 0.42, 0.48);
const HAIRLINE = rgb(0.82, 0.85, 0.88);

const REPLACEMENTS: Record<string, string> = {
  "\u2192": "->",
  "\u2190": "<-",
  "\u2265": ">=",
  "\u2264": "<=",
  "\u00d7": "x",
  "\u2713": "-",
  "\u2714": "-",
  "\u25aa": "-",
  "\u25cf": "\u2022",
  "\u00a0": " ",
  "\u202f": " ",
  "\u2009": " ",
  "\u200b": "",
};

/** Standard PDF fonts only cover WinAnsi: anything else is mapped or dropped. */
function makeSafe(font: PDFFont) {
  const allowed = new Set(font.getCharacterSet());
  return (text: string) => {
    let out = "";
    for (const ch of text) {
      const code = ch.codePointAt(0)!;
      if (ch === "\n" || ch === "\t") out += " ";
      else if (REPLACEMENTS[ch] !== undefined) out += REPLACEMENTS[ch];
      else if (allowed.has(code)) out += ch;
      else if (code >= 0x20) out += "";
    }
    return out;
  };
}

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
  safe: (t: string) => string;
};

function color([r, g, b]: [number, number, number]): RGB {
  return rgb(r / 255, g / 255, b / 255);
}

class Writer {
  page: PDFPage | null = null;
  y = 0;
  pages = 0;

  constructor(
    private pdf: PDFDocument,
    private fonts: Fonts,
    private draw: boolean,
    readonly scale: number,
    private spacing: number,
  ) {
    this.newPage();
  }

  /** Font size and vertical gaps follow the fit-to-page scale. */
  size(n: number) {
    return n * this.scale;
  }
  gapOf(n: number) {
    return n * this.spacing * this.scale;
  }

  newPage() {
    this.pages += 1;
    if (this.draw) this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN_TOP;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN_BOTTOM) this.newPage();
  }

  space(n: number) {
    this.y -= this.gapOf(n);
  }

  width(text: string, size: number, bold = false) {
    return (bold ? this.fonts.bold : this.fonts.regular).widthOfTextAtSize(text, size);
  }

  wrap(text: string, size: number, maxWidth: number, bold = false): string[] {
    const words = this.fonts.safe(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && this.width(candidate, size, bold) > maxWidth) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    return lines;
  }

  /** Draws (or only measures) a wrapped paragraph. Returns its line count. */
  text(
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: RGB;
      x?: number;
      width?: number;
      lineHeight?: number;
      align?: "left" | "center" | "right";
    } = {},
  ) {
    const size = this.size(opts.size ?? 9.5);
    const x0 = opts.x ?? MARGIN_X;
    const maxWidth = opts.width ?? PAGE_W - MARGIN_X - x0;
    const step = size * (opts.lineHeight ?? 1.32);
    const lines = this.wrap(text, size, maxWidth, opts.bold);
    for (const line of lines) {
      this.ensure(step);
      const w = this.width(line, size, opts.bold);
      const x =
        opts.align === "center"
          ? x0 + (maxWidth - w) / 2
          : opts.align === "right"
            ? x0 + maxWidth - w
            : x0;
      if (this.draw && this.page)
        this.page.drawText(line, {
          x,
          y: this.y - size,
          size,
          font: opts.bold ? this.fonts.bold : this.fonts.regular,
          color: opts.color ?? INK,
        });
      this.y -= step;
    }
    return lines.length;
  }

  bullet(text: string, opts: { size?: number; color?: RGB; accent?: RGB } = {}) {
    const size = this.size(opts.size ?? 9);
    const indent = 12;
    const lines = this.wrap(text, size, PAGE_W - 2 * MARGIN_X - indent);
    const step = size * 1.32;
    lines.forEach((line, i) => {
      this.ensure(step);
      if (this.draw && this.page) {
        if (i === 0)
          this.page.drawText("•", {
            x: MARGIN_X + 3,
            y: this.y - size,
            size,
            font: this.fonts.bold,
            color: opts.accent ?? INK,
          });
        this.page.drawText(line, {
          x: MARGIN_X + indent,
          y: this.y - size,
          size,
          font: this.fonts.regular,
          color: opts.color ?? INK,
        });
      }
      this.y -= step;
    });
  }

  rule(colorValue: RGB, thickness = 0.6, x1 = MARGIN_X, x2 = PAGE_W - MARGIN_X) {
    if (this.draw && this.page)
      this.page.drawLine({
        start: { x: x1, y: this.y },
        end: { x: x2, y: this.y },
        thickness,
        color: colorValue,
      });
  }

  rect(x: number, y: number, w: number, h: number, colorValue: RGB) {
    if (this.draw && this.page)
      this.page.drawRectangle({ x, y, width: w, height: h, color: colorValue });
  }
}

function contactLine(id: Identity) {
  return [id.city, id.email, ...id.links].filter(Boolean).join("  |  ");
}

/** Page header, drawn according to the chosen template. */
function header(w: Writer, design: Design, id: Identity, title: string | null) {
  const accent = color(ACCENT_RGB[design.accent]);
  const contact = contactLine(id);
  if (design.template === "moderne") {
    const nameSize = w.size(23);
    const titleSize = w.size(11.5);
    const contactSize = w.size(8.5);
    const titleLines = title ? w.wrap(title, titleSize, PAGE_W - 2 * MARGIN_X, true).length : 0;
    const contactLines = w.wrap(contact, contactSize, PAGE_W - 2 * MARGIN_X).length;
    const height =
      26 * w.scale + nameSize * 1.2 + (titleLines ? 4 + titleLines * titleSize * 1.3 : 0) +
      6 + contactLines * contactSize * 1.35 + 18 * w.scale;
    w.rect(0, PAGE_H - height, PAGE_W, height, accent);
    w.y = PAGE_H - 26 * w.scale;
    w.text(id.name.toUpperCase(), { size: 23, bold: true, color: rgb(1, 1, 1), lineHeight: 1.2 });
    if (title) {
      w.y -= 4;
      w.text(title, { size: 11.5, bold: true, color: rgb(0.92, 0.96, 0.97), lineHeight: 1.3 });
    }
    w.y -= 6;
    w.text(contact, { size: 8.5, color: rgb(0.88, 0.94, 0.96), lineHeight: 1.35 });
    w.y = PAGE_H - height - w.gapOf(16);
    return;
  }
  if (design.template === "sobre") {
    w.text(id.name.toUpperCase(), { size: 20, bold: true, align: "center", lineHeight: 1.2 });
    if (title) {
      w.y -= 3;
      w.text(title, { size: 10.5, color: MUTED, align: "center" });
    }
    w.y -= 3;
    w.text(contact, { size: 8.5, color: MUTED, align: "center" });
    w.y -= w.gapOf(6);
    w.rule(INK, 0.8);
    w.y -= w.gapOf(12);
    return;
  }
  // classique
  w.text(id.name.toUpperCase(), { size: 22, bold: true, color: accent, lineHeight: 1.2 });
  if (title) {
    w.y -= 3;
    w.text(title, { size: 11, bold: true });
  }
  w.y -= 3;
  w.text(contact, { size: 8.5, color: MUTED });
  w.y -= w.gapOf(6);
  w.rule(accent, 1.6);
  w.y -= w.gapOf(12);
}

function sectionTitle(w: Writer, design: Design, label: string) {
  const accent = color(ACCENT_RGB[design.accent]);
  const size = w.size(10);
  w.ensure(size * 3);
  w.space(5);
  if (design.template === "moderne") {
    w.rect(MARGIN_X, w.y - size + 1, 5, 5, accent);
    w.text(label, { size: 10, bold: true, color: accent, x: MARGIN_X + 11 });
    w.y -= 2;
    return;
  }
  w.text(label, {
    size: 10,
    bold: true,
    color: design.template === "sobre" ? INK : accent,
  });
  w.y += 1;
  w.rule(design.template === "sobre" ? INK : HAIRLINE, design.template === "sobre" ? 0.5 : 0.8);
  w.y -= w.gapOf(4);
}

type Block = { heading: string; bullets: string[] };
type CvContent = {
  title?: string;
  summary?: string;
  experience?: Block[];
  projects?: Block[];
  skills?: string[];
  education?: string[];
  languages?: string;
};

function drawCv(w: Writer, design: Design, id: Identity, cv: CvContent) {
  const accent = color(ACCENT_RGB[design.accent]);
  header(w, design, id, cv.title || null);

  if (cv.summary) {
    sectionTitle(w, design, "PROFIL");
    w.text(cv.summary, { size: 9.5, lineHeight: 1.38 });
  }
  const blocks: [string, Block[] | undefined][] = [
    ["EXPÉRIENCE", cv.experience],
    ["PROJETS", cv.projects],
  ];
  for (const [label, items] of blocks) {
    if (!items?.length) continue;
    sectionTitle(w, design, label);
    items.forEach((item, index) => {
      if (index) w.space(3.5);
      if (item.heading) w.text(item.heading, { size: 9.5, bold: true });
      for (const bullet of item.bullets || []) w.bullet(bullet, { accent });
    });
  }
  if (cv.skills?.length) {
    sectionTitle(w, design, "COMPÉTENCES");
    w.text(cv.skills.join("  ·  "), { size: 9, lineHeight: 1.4 });
  }
  if (cv.education?.length) {
    sectionTitle(w, design, "FORMATION");
    for (const item of cv.education) w.text(item, { size: 9 });
  }
  if (cv.languages) {
    sectionTitle(w, design, "LANGUES");
    w.text(cv.languages, { size: 9 });
  }
}

function frenchDate(now: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(now);
}

function drawLetter(
  w: Writer,
  design: Design,
  id: Identity,
  letter: string,
  ctx: RenderContext,
) {
  const parts = parseLetter(letter, ctx.jobTitle ? `Candidature - ${ctx.jobTitle}` : null);
  header(w, design, id, null);

  // Recipient block (right column) and date, as in a French business letter.
  const colX = PAGE_W / 2 + 20;
  const colW = PAGE_W - MARGIN_X - colX;
  w.text("Service recrutement", { size: 10.5, bold: true, x: colX, width: colW });
  if (ctx.company) w.text(ctx.company, { size: 10.5, x: colX, width: colW });
  if (ctx.location) w.text(ctx.location, { size: 10.5, x: colX, width: colW, color: MUTED });
  w.space(8);
  w.text(`${id.city.replace(/\s+\d+\w*$/, "")}, le ${frenchDate(ctx.now ?? new Date())}`, {
    size: 10.5,
    x: colX,
    width: colW,
    color: MUTED,
  });
  w.space(14);

  if (parts.subject) {
    w.text(parts.subject, { size: 10.5, bold: true, lineHeight: 1.4 });
    w.space(12);
  }
  w.text(parts.salutation, { size: 10.5 });
  w.space(8);
  for (const p of parts.paragraphs) {
    w.text(p, { size: 10.5, lineHeight: 1.5 });
    w.space(8);
  }
  if (parts.closing) {
    w.text(parts.closing, { size: 10.5, lineHeight: 1.5 });
    w.space(8);
  }
  w.space(10);
  w.ensure(w.size(10.5) * 3);
  w.text(id.name, {
    size: 11,
    bold: true,
    color: design.template === "sobre" ? INK : color(ACCENT_RGB[design.accent]),
  });
}

const DENSITY_SCALE = { compact: 0.92, normal: 1, aere: 1.06 } as const;
const DENSITY_SPACING = { compact: 0.85, normal: 1, aere: 1.3 } as const;
/** Tried from the largest to the smallest: short content gets bigger, readable text. */
const STEPS = [1.12, 1.08, 1.04, 1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72];
const MAX_SCALE = 1.15;

export type RenderInput = {
  kind: string;
  content: unknown;
  ctx?: RenderContext;
};

export async function renderContentPdf({ kind, content, ctx = {} }: RenderInput) {
  const data =
    content && typeof content === "object" ? (content as Record<string, unknown>) : {};
  const design = normalizeDesign(data.design);
  const id: Identity = { ...DEFAULT_IDENTITY, ...(ctx.identity ?? {}) } as Identity;

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { regular, bold, safe: makeSafe(regular) };

  const run = (scale: number, draw: boolean) => {
    const w = new Writer(pdf, fonts, draw, scale, DENSITY_SPACING[design.density]);
    if (kind === "COVER_LETTER")
      drawLetter(w, design, id, typeof data.letter === "string" ? data.letter : "", ctx);
    else drawCv(w, design, id, data as CvContent);
    return w.pages;
  };

  // Largest font scale that keeps the document on a single page.
  const base = DENSITY_SCALE[design.density];
  const floor = kind === "COVER_LETTER" ? 0.8 : 0.72;
  let chosen = STEPS[0];
  for (const step of STEPS) {
    if (step !== STEPS[0] && base * step < floor) break;
    chosen = step;
    if (run(Math.min(base * step, MAX_SCALE), false) === 1) break;
  }
  run(Math.min(base * chosen, MAX_SCALE), true);
  return Buffer.from(await pdf.save());
}

export async function renderDocumentPdf(doc: StoredDocument, ctx: RenderContext = {}) {
  let content: unknown = {};
  try {
    content = JSON.parse(doc.content_text || "{}");
  } catch {
    content = {};
  }
  return renderContentPdf({ kind: doc.kind, content, ctx });
}
