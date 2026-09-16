import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Job Hunter Control", description: "Safe control plane for Yassine's job search" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
