import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { getDocumentProxy } from "unpdf";
import { namePart } from "../lib/pipeline/generate";
import { renderContentPdf, type RenderContext } from "../lib/pdf";

/** Everything a person could read in the PDF. */
async function textOf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 });
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n");
}

// Details of the platform's owner: they must never appear in anybody else's document.
const OWNER = [/yassine/i, /afif/i, /gmail/i, /linkedin\.com\/in\//i, /github\.com/i, /paris 20/i];
const TEMPLATES = ["classique", "moderne", "sobre"] as const;
const NOW = new Date("2026-10-08T10:00:00Z");

const cv = (template: string) => ({
  design: { template },
  title: "Développeuse web",
  summary: "Étudiante en informatique, alternance.",
  experience: [{ heading: "Stage — Atelier Web", bullets: ["Développement d'une interface en React."] }],
  projects: [],
  skills: ["Python", "SQL"],
  education: ["Licence informatique"],
  languages: "Français, anglais",
});
const letter = (template: string) => ({
  design: { template },
  letter: "Objet : Candidature\n\nMadame, Monsieur,\n\nJe candidate pour votre alternance.\n\nCordialement,",
});

async function render(kind: "TAILORED_CV" | "COVER_LETTER", template: string, ctx: RenderContext) {
  const bytes = await renderContentPdf({ kind, content: kind === "COVER_LETTER" ? letter(template) : cv(template), ctx: { now: NOW, ...ctx } });
  return textOf(bytes);
}

test("an account with no identity at all gets a neutral document, never the owner's details", async () => {
  for (const template of TEMPLATES)
    for (const kind of ["TAILORED_CV", "COVER_LETTER"] as const) {
      const text = await render(kind, template, {});
      for (const pattern of OWNER) assert.doesNotMatch(text, pattern, `${kind} ${template} shows ${pattern}`);
      assert.match(text, /candidat/i, `${kind} ${template} uses the neutral name`);
    }
});

test("a profile with only a name prints only that name: no city, e-mail or links, and no stray separators", async () => {
  for (const template of TEMPLATES) {
    const text = await render("TAILORED_CV", template, { identity: { name: "Léa Martin" } });
    assert.match(text, /L[ÉE]A MARTIN/i);
    for (const pattern of OWNER) assert.doesNotMatch(text, pattern);
    assert.doesNotMatch(text, /\|/);
  }
  // Fields that are present but empty or blank count as missing too.
  const blank = await render("TAILORED_CV", "classique", { identity: { name: "  ", city: " ", email: "", links: ["", ""] } });
  assert.match(blank, /candidat/i);
  assert.doesNotMatch(blank, /\|/);
  for (const pattern of OWNER) assert.doesNotMatch(blank, pattern);
});

test("the letter has a date line without a leading comma when the city is unknown, and uses the account's own city otherwise", async () => {
  const noCity = await render("COVER_LETTER", "classique", { identity: { name: "Léa Martin" } });
  assert.match(noCity, /Le 8 octobre 2026/);
  assert.doesNotMatch(noCity, /,\s*le 8 octobre/);
  const lyon = await render("COVER_LETTER", "classique", { identity: { name: "Léa Martin", city: "Lyon 3e" } });
  assert.match(lyon, /Lyon, le 8 octobre 2026/);
});

test("another account's own details are printed as given, and only theirs", async () => {
  const text = await render("TAILORED_CV", "moderne", { identity: { name: "Léa Martin", city: "Lyon", email: "lea.martin@example.org", links: ["github.com/lea-martin"] } });
  assert.match(text, /lea\.martin@example\.org/);
  assert.match(text, /github\.com\/lea-martin/);
  assert.match(text, /Lyon/);
  assert.doesNotMatch(text, /yassine|afif|gmail/i);
});

test("a file name never falls back to a real person", () => {
  assert.equal(namePart(null), "Candidat");
  assert.equal(namePart(undefined), "Candidat");
  assert.equal(namePart("   "), "Candidat");
  assert.equal(namePart("Lea Martin"), "Lea_Martin");
});

test("no real personal detail of the owner is written in the application's code or prompts", () => {
  const forbidden = [/yassine\.afif/i, /afif-yassine/i, /yassine-afif/i, /Paris 20e/, /demande de Yassine/i];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx|mjs|js)$/.test(name)) files.push(path);
    }
  };
  for (const dir of ["lib", "app", "components", "worker"]) walk(dir);
  assert.ok(files.length > 100, "the scan really covers the code");
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`);
  }
});
