import type { Page } from "playwright";

export type FormField = {
  tag: string;
  type: string | null;
  name: string | null;
  label: string | null;
  required: boolean;
  options?: string[];
};

export type InspectQuestion = {
  question: string;
  category: string;
  options?: string[];
};

export type InspectResult = {
  fields: FormField[];
  questions: InspectQuestion[];
  blockers: string[];
};

const BLOCKERS = [
  "captcha",
  "recaptcha",
  "hcaptcha",
  "multi-factor",
  "two-factor",
  "legal declaration",
  "certify that",
  "j'atteste",
  "je certifie",
];

/** Labels that never need a human answer (documents are attached separately). */
const SKIP_LABEL =
  /^(pr[ée]nom|nom|nom de famille|first name|last name|surname|full name|nom complet|civilit[ée]|cv|curriculum|lettre de motivation|cover letter|resume|fichier|file)\b/i;

/**
 * Browser-side script, kept as a plain JavaScript string on purpose: when the
 * worker runs through tsx/esbuild, helper functions defined inside a
 * `page.evaluate(() => ...)` callback get wrapped with an `__name` helper that
 * does not exist in the page ("ReferenceError: __name is not defined").
 *
 * Reads every visible form control: label, required flag and the choices of
 * <select> / radio groups.
 */
const READ_FIELDS_SCRIPT = `(() => {
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const visible = (el) =>
    typeof el.checkVisibility === "function"
      ? el.checkVisibility({ visibilityProperty: true })
      : Boolean(el.offsetParent);
  const legendOf = (el) => {
    const legend = el.closest("fieldset") && el.closest("fieldset").querySelector("legend");
    return legend ? clean(legend.textContent) : "";
  };
  const labelOf = (el) => {
    const byLabel = clean(el.labels && el.labels[0] && el.labels[0].innerText);
    if (byLabel) return byLabel;
    const aria = clean(el.getAttribute("aria-label"));
    if (aria) return aria;
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const text = by.split(/\\s+/).map((id) => {
        const n = document.getElementById(id);
        return n ? n.innerText : "";
      }).join(" ");
      if (clean(text)) return clean(text);
    }
    return legendOf(el) || clean(el.placeholder) || null;
  };
  const skipTypes = new Set(["hidden", "submit", "button", "image", "reset", "password", "file"]);
  const placeholder = /^(--|—|choisir|s[ée]lectionn|select|please|veuillez)/i;
  const out = [];
  const radioGroups = new Map();
  const els = Array.from(document.querySelectorAll("input, textarea, select")).slice(0, 200);
  for (const el of els) {
    const type = el.type || null;
    if (type && skipTypes.has(type)) continue;
    if (!visible(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (type === "radio") {
      const optionLabel = clean(el.labels && el.labels[0] && el.labels[0].innerText) || clean(el.value);
      const groupKey = el.name || "radio-" + out.length;
      if (radioGroups.has(groupKey)) {
        const at = out[radioGroups.get(groupKey)];
        at.options.push(optionLabel);
        at.required = at.required || Boolean(el.required);
        continue;
      }
      radioGroups.set(groupKey, out.length);
      out.push({ tag, type, name: el.name || null, label: legendOf(el) || labelOf(el), required: Boolean(el.required), options: [optionLabel] });
      continue;
    }
    const field = {
      tag, type, name: el.name || null, label: labelOf(el),
      required: Boolean(el.required) || el.getAttribute("aria-required") === "true",
    };
    if (tag === "select") {
      field.options = Array.from(el.options).map((o) => clean(o.text)).filter((t) => t && !placeholder.test(t));
    }
    out.push(field);
  }
  return out;
})()`;

async function readFields(page: Page): Promise<FormField[]> {
  return (await page.evaluate(READ_FIELDS_SCRIPT)) as FormField[];
}

export async function inspectPage(page: Page): Promise<InspectResult> {
  const fields = await readFields(page);
  const text = (await page.locator("body").innerText()).slice(0, 30_000).toLowerCase();
  const found = BLOCKERS.filter((x) => text.includes(x));
  // "recaptcha" / "hcaptcha" already contain "captcha": keep only the specific one.
  const blockers = found.filter(
    (x) => !found.some((other) => other !== x && other.includes(x)),
  );

  const questions: InspectQuestion[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    if (!f.label && !f.name) {
      questions.push({
        question: "Champ obligatoire non identifié",
        category: "UNKNOWN_FIELD",
      });
      continue;
    }
    const label = f.label || f.name || "";
    if (SKIP_LABEL.test(label)) continue;
    questions.push({
      question: label,
      category: "FORM_FIELD",
      ...(f.options?.length ? { options: f.options } : {}),
    });
  }
  for (const blocker of blockers)
    questions.push({
      question: `Intervention humaine requise: ${blocker}`,
      category: "HUMAN_VERIFICATION",
    });
  return { fields, questions, blockers };
}
