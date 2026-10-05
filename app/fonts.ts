import localFont from "next/font/local";

/** LeBonTaf type: a bold grotesque for headlines, a typewriter for case labels, a hand for the sticky notes. */
export const display = localFont({
  src: [
    { path: "./fonts/bricolage-grotesque-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/bricolage-grotesque-latin-700-normal.woff2", weight: "700" },
    { path: "./fonts/bricolage-grotesque-latin-800-normal.woff2", weight: "800" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

export const hand = localFont({
  src: [
    { path: "./fonts/caveat-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/caveat-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-hand",
  display: "swap",
  fallback: ["Segoe Print", "Comic Sans MS", "cursive"],
});

export const typewriter = localFont({
  src: "./fonts/special-elite-latin-400-normal.woff2",
  variable: "--font-type",
  display: "swap",
  fallback: ["Courier New", "monospace"],
});

export const serif = localFont({
  src: "./fonts/instrument-serif-latin-400-italic.woff2",
  style: "italic",
  weight: "400",
  variable: "--font-serif",
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

export const fontVariables = [display.variable, serif.variable, hand.variable, typewriter.variable, sans.variable, mono.variable].join(" ");
