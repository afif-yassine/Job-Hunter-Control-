import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readCvPdf } from "../lib/cv-pdf";
import { generateJsonFromPdf } from "../lib/ai";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
async function cv(pages: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pages) pdf.addPage().drawText(text, { x: 50, y: 600, size: 12, font });
  return pdf.save();
}
const TEXT = "Sara Martin — Recherche de stage\nMaster informatique 2024-2026\nPython, SQL, React\nProjet : API de suivi des stocks".replace("—", "-");

test("local PDF extraction keeps facts across pages", async () => {
  const text = await readCvPdf(await cv([TEXT, "Experience : stage chez Acme en 2025. Developpement Python et SQL."]));
  assert.match(text, /Sara Martin/);
  assert.match(text, /2024-2026/);
  assert.match(text, /Acme/);
});

test("digital CV uses exactly one configured Gateway call without a Gemini key", async () => {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://ai-gateway.vercel.sh/v1/chat/completions");
    const request = JSON.parse(String(init?.body));
    assert.equal(request.model, "openai/gpt-6-luna");
    assert.match(request.messages[0].content, /Sara Martin/);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"identity":{"full_name":"Sara Martin"}}' } }] });
  };
  const result = await generateJsonFromPdf("Extract facts only", await cv([TEXT]), "writing", { AI_PROVIDER: "gateway", AI_GATEWAY_API_KEY: "synthetic" });
  assert.match(result.text, /Sara Martin/);
  assert.equal(calls, 1);
});

test("corrupt, scanned, mixed and oversized CVs never reach the paid provider", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("must not call"); };
  const inputs = [new Uint8Array(), Buffer.from("%PDF-invalid"), await cv([""]), await cv([TEXT, ""]), await cv(Array(11).fill(TEXT)), new Uint8Array(5 * 1024 * 1024 + 1)];
  for (const pdf of inputs) await assert.rejects(generateJsonFromPdf("Extract", pdf, "writing", { AI_PROVIDER: "gateway", AI_GATEWAY_API_KEY: "synthetic" }));
  assert.equal(calls, 0);
});
