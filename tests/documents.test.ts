import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { designFromInstruction, normalizeDesign, DEFAULT_DESIGN } from "../lib/design";
import { parseLetter } from "../lib/letter";
import { renderContentPdf } from "../lib/pdf";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cvToLatex, letterToLatex, tex } from "../lib/latex";

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


test("LaTeX export: special characters are escaped, emoji dropped, sections standard", () => {
  assert.equal(tex("C# & .NET 100% {ok} x_y ~ ^"), "C\\# \\& .NET 100\\% \\{ok\\} x\\_y \\textasciitilde{} \\textasciicircum{}");
  assert.equal(tex("a\\b"), "a\\textbackslash{}b");
  assert.equal(tex("Top ≥ 90 🚀"), "Top $\\geq$ 90");
  const source = cvToLatex(
    { title: "Dev", summary: "Résumé", experience: [{ heading: "Poste", bullets: ["Fait A"] }], skills: ["Java"], education: ["Master"], languages: "Français" },
    { name: "Prénom NOM", city: "Paris", email: "a@b.fr", links: ["github.com/x"] },
  );
  for (const section of ["Profil", "Expérience", "Compétences", "Formation", "Langues"]) assert.ok(source.includes(`\\section*{${section}}`));
  assert.ok(!source.includes("\\section*{Projets}"));
  assert.ok(source.includes("\\href{https://github.com/x}"));
});

test("LaTeX export compiles to one page (when pdflatex is installed)", (t) => {
  try {
    execFileSync("pdflatex", ["--version"], { stdio: "ignore" });
  } catch {
    t.skip("pdflatex not installed");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "cv-"));
  const bullets = ["Conception d'APIs REST & tests (couverture 80 %)", "Pipeline CI/CD — Docker, GitLab", "Migration ≈ 2 M lignes"];
  writeFileSync(
    join(dir, "cv.tex"),
    cvToLatex(
      {
        title: "Alternance Développeur Backend",
        summary: "Étudiant ingénieur, backend & IA.",
        experience: [1, 2, 3].map((i) => ({ heading: `Poste ${i} — Entreprise — 202${i}`, bullets })),
        projects: [1, 2].map((i) => ({ heading: `Projet ${i}`, bullets })),
        skills: ["Java", "Spring Boot", "Python", "C#", "SQL"],
        education: ["Master — École — 2026"],
        languages: "Français, Anglais",
      },
      { name: "Prénom NOM", city: "Paris", email: "prenom@example.com", links: ["linkedin.com/in/x"] },
    ),
  );
  writeFileSync(join(dir, "letter.tex"), letterToLatex("Objet : Test\n\nMadame, Monsieur,\n\nTexte & 100%.", { name: "Prénom NOM", city: "Paris" }, { company: "Acme" }));
  for (const f of ["cv", "letter"]) {
    const log = execFileSync("pdflatex", ["-interaction=nonstopmode", "-halt-on-error", `${f}.tex`], { cwd: dir, encoding: "utf8" });
    assert.match(log, /Output written on .*\(1 page/);
  }
});
