import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { Logo, Wordmark } from "./logo";

export const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/conditions", label: "Conditions d’utilisation" },
] as const;

/** Shared frame of the public legal pages: readable column, table of contents, same header and footer as the home page. */
export function LegalPage({ title, lead, children }: { title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <div className="jj">
      <header className="jj-nav is-stuck">
        <div className="jj-wrap jj-nav-in">
          <Link href="/" className="jj-brand" aria-label={`${BRAND.name}, accueil`}>
            <Logo size={38} />
          </Link>
          <nav className="jj-nav-links" aria-label="Pages légales">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} className="jj-nav-a is-optional" href={l.href}>{l.label}</Link>
            ))}
            <Link className="jj-ribbon is-small" href="/login">Se connecter <span className="arr" aria-hidden="true">→</span></Link>
          </nav>
        </div>
      </header>
      <main className="jj-wrap jj-legal">
        <p className="jj-label">Mis à jour le {BRAND.legalUpdatedAt}</p>
        <h1 className="jj-fell">{title}</h1>
        <div className="jj-legal-lead">{lead}</div>
        <article className="jj-legal-body">{children}</article>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  return (
    <footer className="jj-footer">
      <div className="jj-wrap jj-footer-in">
        <Wordmark size={22} />
        <nav style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px" }} aria-label="Informations légales">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
          <a href={`mailto:${BRAND.contactEmail}`}>Contact</a>
        </nav>
      </div>
    </footer>
  );
}
