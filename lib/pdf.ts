import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type StoredDocument = {
  kind: string;
  filename: string;
  content_text: string | null;
};
function wrap(text: string, max = 92) {
  const words = text.replace(/\s+/g, " ").trim().split(" "),
    lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > max) {
      lines.push(current);
      current = word;
    } else current = (current + " " + word).trim();
  }
  if (current) lines.push(current);
  return lines;
}
export async function renderDocumentPdf(doc: StoredDocument) {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([595.28, 841.89]),
    regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 806;
  const line = (
    text: string,
    size = 9,
    isBold = false,
    color = rgb(0.12, 0.17, 0.25),
  ) => {
    for (const part of wrap(text, size >= 16 ? 55 : 96)) {
      if (y < 35) break;
      page.drawText(part, {
        x: 42,
        y,
        size,
        font: isBold ? bold : regular,
        color,
      });
      y -= size + 3;
    }
  };
  const gap = (n = 6) => {
    y -= n;
  };
  const content = JSON.parse(doc.content_text || "{}");
  line("YASSINE AFIF", 20, true, rgb(0.04, 0.35, 0.45));
  line(content.title || doc.kind, 11, true);
  line(
    "Paris 20e | yassine.afif.ma@gmail.com | linkedin.com/in/yassine-afif | github.com/afif-yassine",
    8,
  );
  gap();
  if (doc.kind === "COVER_LETTER") line(content.letter || "", 10);
  else {
    line("PROFIL", 10, true);
    line(content.summary || "");
    for (const [key, label] of [
      ["experience", "EXPERIENCE"],
      ["projects", "PROJETS"],
    ] as const) {
      gap();
      line(label, 10, true);
      for (const item of content[key] || []) {
        line(item.heading, 9, true);
        for (const bullet of item.bullets || []) line(`• ${bullet}`, 8);
      }
    }
    gap();
    line("COMPETENCES", 10, true);
    line((content.skills || []).join(" | "), 8);
    gap();
    line("FORMATION", 10, true);
    for (const item of content.education || []) line(item, 8);
    gap();
    line("LANGUES", 10, true);
    line(content.languages || "", 8);
  }
  return Buffer.from(await pdf.save());
}
