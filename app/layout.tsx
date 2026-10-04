import type { Metadata } from "next";
import "./globals.css";
import "./jinnjob.css";
import { fontVariables } from "./fonts";

// Every page is rendered per request: the CSP nonce (proxy.ts) changes each time.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "JinnJob — fais un vœu, on trouve ton alternance",
  description: "Stages, alternances et CDD en informatique, numérique et bureautique, partout en France. JinnJob trouve les offres qui ressemblent à ton CV et écrit ton CV et ta lettre pour chacune.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr" className={fontVariables}><body>{children}</body></html>;
}
