import { getDocumentProxy } from "unpdf";

/** Digital CVs are read locally. Never send an incomplete extraction to the AI. */
export async function readCvPdf(bytes: Uint8Array): Promise<string> {
  if (bytes.length > 5 * 1024 * 1024) throw new Error("PDF trop lourd (5 Mo maximum).");
  if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") throw new Error("Ce fichier n’est pas un PDF.");
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes.slice(), { verbosity: 0 });
  } catch {
    throw new Error("PDF illisible ou protégé par un mot de passe. Exporte une nouvelle copie PDF depuis ton traitement de texte.");
  }
  try {
    if (pdf.numPages > 10) throw new Error("CV trop long (10 pages maximum).");
    const pages: string[] = [];
    let length = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "").join("").trim();
      page.cleanup();
      if (text.replace(/\s/g, "").length < 40)
        throw new Error(`La page ${n} n’a pas assez de texte lisible. Les CV scannés nécessitent une version avec texte sélectionnable ; exporte ton CV en PDF depuis Word ou ton éditeur.`);
      length += text.length;
      if (length > 30_000) throw new Error("CV trop volumineux en texte. Utilise une version de 30 000 caractères maximum.");
      pages.push(text);
    }
    return pages.join("\n\n");
  } finally {
    await pdf.loadingTask.destroy();
  }
}
