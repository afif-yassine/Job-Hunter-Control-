import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { designFromInstruction, normalizeDesign, DEFAULT_DESIGN } from "../lib/design";
import { parseLetter } from "../lib/letter";
import { renderContentPdf } from "../lib/pdf";

const BLOB =
  "Objet : Candidature au poste de Dev Madame, Monsieur, Je suis étudiant en Master. J'ai conçu un agent IA. J'ai fait un stage chez TVIS. Je maîtrise Python et React. Je suis disponible dès février. Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.";

test("parseLetter splits a legacy single-block letter into letter parts", () => {
  const p = parseLetter(BLOB);
  assert.equal(p.subject, "Objet : Candidature au poste de Dev");
  assert.equal(p.salutation, "Madame, Monsieur,");
  assert.ok(p.paragraphs.length >= 2);
  assert.match(p.closing ?? "", /^Veuillez agréer/);
  assert.ok(!p.paragraphs.join(" ").includes("Madame, Monsieur"));
});

test("parseLetter keeps paragraphs written with blank lines", () => {
  const p = parseLetter(
    "Objet : Candidature\n\nMadame, Monsieur,\n\nPremier paragraphe.\n\nSecond paragraphe.\n\nVeuillez agréer, Madame, Monsieur, mes salutations.",
  );
  assert.equal(p.subject, "Objet : Candidature");
  assert.deepEqual(p.paragraphs, ["Premier paragraphe.", "Second paragraphe."]);
  assert.match(p.closing ?? "", /^Veuillez agréer/);
});

test("parseLetter falls back to the job title for the subject", () => {
  const p = parseLetter("Bonjour à tous. Voici ma candidature.", "Candidature - Dev IA");
  assert.equal(p.subject, "Objet : Candidature - Dev IA");
});

test("design requests are read from the instruction", () => {
  const d = designFromInstruction("Fais une version plus sobre en bleu, plus aérée", DEFAULT_DESIGN);
  assert.deepEqual(d, { template: "sobre", accent: "marine", density: "aere" });
  const same = designFromInstruction("Mets Python en premier", DEFAULT_DESIGN);
  assert.deepEqual(same, DEFAULT_DESIGN);
});

test("normalizeDesign ignores unknown values", () => {
  assert.deepEqual(normalizeDesign({ template: "x", accent: "vert" }), {
    ...DEFAULT_DESIGN,
    accent: "vert",
  });
});

test("PDF renders letters and CVs, survives unsupported characters, stays on one page", async () => {
  const letter = await renderContentPdf({
    kind: "COVER_LETTER",
    content: { letter: `${BLOB} → ≥ 😀`, design: { template: "moderne" } },
    ctx: { company: "Alan", jobTitle: "Dev" },
  });
  assert.equal(letter.subarray(0, 4).toString(), "%PDF");

  const bullets = Array.from({ length: 6 }, (_, i) => `Réalisation ${i} avec Python, React et TypeScript pour un produit en production.`);
  const cv = await renderContentPdf({
    kind: "TAILORED_CV",
    content: {
      title: "Dev",
      summary: "Profil.",
      experience: Array.from({ length: 4 }, (_, i) => ({ heading: `Poste ${i}`, bullets })),
      projects: [],
      skills: ["Python"],
      education: ["Master"],
      languages: "Français",
    },
  });
  assert.equal((await PDFDocument.load(cv)).getPageCount(), 1);
  assert.equal((await PDFDocument.load(letter)).getPageCount(), 1);
});
