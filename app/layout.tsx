import type { Metadata } from "next";
import "./globals.css";
import "./jinnjob.css";
import { fontVariables } from "./fonts";
import { BRAND } from "@/lib/brand";

// Every page is rendered per request: the CSP nonce (proxy.ts) changes each time.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  applicationName: BRAND.name,
  title: "LeBonTaf — ton stage, ton alternance, ton CV",
  description: "Stages, alternances et CDD en informatique, numérique et bureautique, partout en France. LeBonTaf trouve les offres qui ressemblent à ton CV et écrit ton CV et ta lettre pour chacune.",
  openGraph: { siteName: BRAND.name, locale: "fr_FR", type: "website" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr" className={fontVariables}><body>{children}</body></html>;
}
