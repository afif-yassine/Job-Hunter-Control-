/**
 * LaTeX version of a CV or letter, for people who want to edit the source
 * themselves (Overleaf or any LaTeX editor). ATS-friendly on purpose: one
 * column, real text, standard section names, no tables, icons or images.
 */

export type LatexIdentity = {
  name: string;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  links?: string[];
};

export type LatexCv = {
  title?: string;
  summary?: string;
  experience?: { heading: string; bullets: string[] }[];
  projects?: { heading: string; bullets: string[] }[];
  skills?: string[];
  education?: string[];
  languages?: string;
};

/** Escapes text so any character prints as itself. */
export function tex(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\\/g, "\u0000")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/\u0000/g, "\\textbackslash{}")
    .replace(/[\u2013]/g, "--")
    .replace(/[\u2014]/g, "---")
    .replace(/[\u2192]/g, "$\\rightarrow$")
    .replace(/\u2248/g, "$\\approx$")
    .replace(/\u2265/g, "$\\geq$")
    .replace(/\u2264/g, "$\\leq$")
    .replace(/\u00d7/g, "$\\times$")
    .replace(/[\u2022\u25cf\u25aa]/g, "\\textbullet{}")
    .replace(/[\u2713\u2714]/g, "-")
    .replace(/\u00a0/g, "~")
    .replace(/\u2026/g, "\\ldots{}")
    // Emoji and symbols pdflatex cannot print are dropped.
    .replace(/[\u2190-\u21ff\u2300-\u27bf\u2b00-\u2bff\ufe0f]|[\ud800-\udfff]/g, "")
    .replace(/\r?\n/g, " ")
    .trim();
}

const PREAMBLE = String.raw`\documentclass[10pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[scaled=0.92]{helvet}
\renewcommand{\familydefault}{\sfdefault}
\usepackage[margin=1.4cm]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=1.2em, itemsep=1pt, topsep=2pt}
\titleformat{\section}{\large\bfseries}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{8pt}{4pt}
`;

function contact(id: LatexIdentity): string {
  const parts = [id.city, id.phone, id.email ? `\\href{mailto:${id.email}}{${tex(id.email)}}` : null]
    .filter(Boolean)
    .map((p) => (p!.startsWith("\\href") ? p! : tex(p)));
  for (const link of id.links ?? []) {
    const url = /^https?:\/\//.test(link) ? link : `https://${link}`;
    parts.push(`\\href{${url.replace(/([%#])/g, "\\$1")}}{${tex(link.replace(/^https?:\/\/(www\.)?/, ""))}}`);
  }
  return parts.join(" \\,|\\, ");
}

function entries(items: { heading: string; bullets: string[] }[]): string {
  return items
    .map((e) => {
      const bullets = e.bullets.filter(Boolean);
      return `\\textbf{${tex(e.heading)}}\n${bullets.length ? `\\begin{itemize}\n${bullets.map((b) => `  \\item ${tex(b)}`).join("\n")}\n\\end{itemize}` : ""}`;
    })
    .join("\n\\medskip\n");
}

export function cvToLatex(cv: LatexCv, id: LatexIdentity): string {
  const out: string[] = [PREAMBLE, "\\begin{document}", ""];
  out.push(`{\\LARGE\\bfseries ${tex(id.name)}}\\\\[2pt]`);
  if (cv.title) out.push(`{\\large ${tex(cv.title)}}\\\\[2pt]`);
  out.push(`{\\small ${contact(id)}}`, "");
  if (cv.summary) out.push("\\section*{Profil}", tex(cv.summary), "");
  if (cv.experience?.length) out.push("\\section*{Expérience}", entries(cv.experience), "");
  if (cv.projects?.length) out.push("\\section*{Projets}", entries(cv.projects), "");
  if (cv.skills?.length) out.push("\\section*{Compétences}", cv.skills.map(tex).join(" \\textbullet{} "), "");
  if (cv.education?.length)
    out.push("\\section*{Formation}", `\\begin{itemize}\n${cv.education.map((e) => `  \\item ${tex(e)}`).join("\n")}\n\\end{itemize}`, "");
  if (cv.languages) out.push("\\section*{Langues}", tex(cv.languages), "");
  out.push("\\end{document}", "");
  return out.join("\n");
}

export function letterToLatex(
  letter: string,
  id: LatexIdentity,
  ctx: { company?: string | null; location?: string | null; date?: Date } = {},
): string {
  const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(ctx.date ?? new Date());
  const paragraphs = letter
    .split(/\n\s*\n/)
    .map((p) => tex(p))
    .filter(Boolean);
  return [
    PREAMBLE,
    "\\begin{document}",
    `{\\large\\bfseries ${tex(id.name)}}\\\\`,
    `{\\small ${contact(id)}}`,
    "",
    "\\bigskip",
    "\\begin{flushright}",
    ctx.company ? `${tex(ctx.company)}${ctx.location ? `, ${tex(ctx.location)}` : ""}\\\\[4pt]` : "",
    `${tex(id.city || "")}${id.city ? ", le " : "Le "}${date}`,
    "\\end{flushright}",
    "",
    "\\bigskip",
    paragraphs.join("\n\n\\medskip\n"),
    "",
    "\\bigskip",
    `\\begin{flushright}${tex(id.name)}\\end{flushright}`,
    "\\end{document}",
    "",
  ].join("\n");
}
