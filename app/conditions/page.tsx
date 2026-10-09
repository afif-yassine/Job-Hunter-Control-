import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/jinnjob/legal";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Conditions d’utilisation — ${BRAND.name}`,
  description: `Les règles d’utilisation de ${BRAND.name}, en clair.`,
};

const mail = <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>;

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions d’utilisation"
      lead={
        <p>
          Les règles du jeu, en clair. En créant un compte, tu les acceptes. Elles sont courtes : prends deux minutes pour les lire.
        </p>
      }
    >
      <h2>1. Le service</h2>
      <p>
        {BRAND.name} cherche des offres de stage, d’alternance et de CDD, les classe selon ton CV, résume chaque annonce, écrit un CV
        et une lettre de motivation adaptés à l’offre et t’aide à suivre tes candidatures. Il est édité par {BRAND.publisher} (voir les{" "}
        <Link href="/mentions-legales">mentions légales</Link>).
      </p>

      <h2>2. Phase de test et gratuité</h2>
      <p>
        Le service est gratuit aujourd’hui (2 dossiers par mois). Une formule payante, LeBonTaf Plus, est présentée sur la page{" "}
        <Link href="/tarifs">Tarifs</Link> ; le paiement n’est pas encore ouvert. Des fonctions peuvent changer, être limitées
        (par exemple un nombre de recherches ou de documents par jour) ou s’interrompre. Cette formule sera optionnelle, annoncée à
        l’avance et soumise à des conditions séparées : rien ne te sera facturé sans ton accord explicite.
      </p>

      <h2>3. Ton compte</h2>
      <ul>
        <li>Tu te connectes avec Google ou avec un lien envoyé à ton adresse e-mail. Garde l’accès à cette adresse pour toi.</li>
        <li>Un compte par personne. Il faut avoir au moins 15 ans.</li>
        <li>Les informations de ton profil doivent être vraies : ce sont elles qui servent à écrire tes candidatures.</li>
      </ul>

      <h2>4. Tu restes aux commandes</h2>
      <p>
        {BRAND.name} ne postule jamais à ta place sans ton accord. Les documents générés sont des propositions : relis-les avant de
        les utiliser. Tu es seul responsable de ce que tu envoies à un recruteur. L’IA peut se tromper (par exemple mal résumer une
        annonce) : en cas de doute, l’annonce d’origine fait foi.
      </p>

      <h2>5. Ce qui est interdit</h2>
      <ul>
        <li>Inventer des diplômes, des expériences ou des compétences dans ton profil ou tes documents.</li>
        <li>Utiliser le service pour démarcher, harceler ou tromper des entreprises ou des candidats.</li>
        <li>Aspirer le site, contourner ses limites ou tenter d’accéder aux données d’autres comptes.</li>
        <li>Revendre ou mettre à disposition d’autres personnes l’accès à ton compte.</li>
      </ul>
      <p>En cas d’abus, nous pouvons suspendre ou fermer le compte concerné, après t’avoir prévenu sauf urgence.</p>

      <h2>6. Les offres d’emploi</h2>
      <p>
        Les offres viennent de sources publiques et appartiennent à leurs auteurs. Nous ne garantissons ni qu’une offre est encore
        ouverte, ni que l’entreprise te répondra, ni que tu seras embauché. Une note de proximité avec ton CV est une aide au tri, pas
        un avis sur ta valeur.
      </p>

      <h2>7. Tes contenus</h2>
      <p>
        Ton CV, ton profil et les documents générés t’appartiennent. Tu nous autorises seulement à les traiter pour faire fonctionner
        le service, comme expliqué dans la <Link href="/confidentialite">politique de confidentialité</Link>. Tu peux les télécharger
        ou les effacer à tout moment.
      </p>

      <h2>8. Disponibilité et responsabilité</h2>
      <p>
        Nous faisons de notre mieux pour que le service fonctionne, sans pouvoir le garantir sans interruption ni erreur, surtout en
        phase de test. Pense à garder une copie de tes documents importants. Notre responsabilité ne peut pas être engagée pour une
        candidature refusée, une offre disparue ou une erreur que tu aurais pu corriger en relisant. Rien dans ces conditions ne
        limite tes droits de consommateur prévus par la loi.
      </p>

      <h2>9. Arrêter</h2>
      <p>
        Tu peux supprimer ton compte quand tu veux dans Réglages › Ton compte ; tes données sont alors effacées. Si nous devions
        arrêter le service, nous te préviendrons au moins 30 jours avant pour que tu puisses récupérer tes données.
      </p>

      <h2>10. Changements</h2>
      <p>
        Nous pouvons faire évoluer ces conditions. Pour un changement important, nous te prévenons avant qu’il s’applique ; si tu
        n’es pas d’accord, tu peux supprimer ton compte.
      </p>

      <h2>11. Droit applicable et litiges</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de désaccord, écris-nous d’abord à {mail} : nous cherchons toujours
        une solution amiable. À défaut, les tribunaux français sont compétents, sous réserve des règles qui protègent le consommateur.
      </p>
    </LegalPage>
  );
}
