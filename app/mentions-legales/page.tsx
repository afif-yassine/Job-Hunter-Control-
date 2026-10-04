import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/jinnjob/legal";
import { BRAND, HOSTS } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Mentions légales — ${BRAND.name}`,
  description: `Éditeur, hébergeurs et contact du site ${BRAND.name}.`,
};

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      lead={<p>Qui publie ce site, qui l’héberge et comment nous joindre (loi pour la confiance dans l’économie numérique, article 6).</p>}
    >
      <h2>Éditeur du site</h2>
      <p>
        {BRAND.name} est publié par <strong>{BRAND.publisher}</strong>, {BRAND.publisherStatus.toLowerCase()}. Le service est
        gratuit pendant sa phase de test.
      </p>
      <ul>
        <li>Adresse du site : <a href={BRAND.siteUrl}>{BRAND.siteUrl.replace("https://", "")}</a></li>
        <li>Contact : <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a></li>
        <li>Directeur de la publication : {BRAND.publisher}</li>
      </ul>
      <p className="jj-note">
        L’adresse postale de l’éditeur est communiquée à l’hébergeur et à toute autorité qui la demande. Avant toute offre payante,
        l’éditeur sera immatriculé et ces mentions seront complétées (forme, numéro SIREN, adresse).
      </p>

      <h2>Hébergement</h2>
      <div className="jj-table-wrap">
        <table>
          <thead>
            <tr><th>Rôle</th><th>Prestataire</th><th>Adresse</th></tr>
          </thead>
          <tbody>
            {HOSTS.map((h) => (
              <tr key={h.name}>
                <td>{h.role}</td>
                <td><a href={h.url} target="_blank" rel="noreferrer">{h.name}</a></td>
                <td>{h.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Offres d’emploi</h2>
      <p>
        Les offres affichées proviennent de sources publiques (France Travail, Adzuna, pages carrières des entreprises). Elles
        restent la propriété de leurs auteurs ; {BRAND.name} les résume et renvoie toujours vers l’annonce d’origine. Une entreprise
        qui souhaite faire retirer une offre peut écrire à <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, le logo et le design du site appartiennent à l’éditeur. Les polices utilisées sont publiées sous licence libre
        (SIL Open Font License). Les CV et lettres que tu génères t’appartiennent.
      </p>

      <h2>Signaler un contenu</h2>
      <p>
        Pour signaler un contenu illicite ou une offre trompeuse, écris à{" "}
        <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a> en indiquant l’adresse de la page et la raison. Nous
        répondons rapidement.
      </p>

      <p>
        Voir aussi la <Link href="/confidentialite">politique de confidentialité</Link> et les{" "}
        <Link href="/conditions">conditions d’utilisation</Link>.
      </p>
    </LegalPage>
  );
}
