import localFont from "next/font/local";

/** LeBonTaf type: an old printing face for stories, a clean sans to read fast, a typewriter for labels. */
export const fell = localFont({
  src: [
    { path: "./fonts/im-fell-english-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/im-fell-english-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-fell",
  display: "swap",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
});

export const fellSc = localFont({
  src: "./fonts/im-fell-english-sc-latin-400-normal.woff2",
  variable: "--font-fell-sc",
  display: "swap",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
});

export const sans = localFont({
  src: [
    { path: "./fonts/instrument-sans-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/instrument-sans-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/instrument-sans-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/instrument-sans-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

export const mono = localFont({
  src: [
    { path: "./fonts/courier-prime-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/courier-prime-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["Courier New", "monospace"],
});

export const fontVariables = [fell.variable, fellSc.variable, sans.variable, mono.variable].join(" ");
