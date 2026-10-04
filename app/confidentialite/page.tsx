import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/jinnjob/legal";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Politique de confidentialité — ${BRAND.name}`,
  description: `Quelles données ${BRAND.name} utilise, pourquoi, avec qui, combien de temps, et comment exercer tes droits.`,
};

const mail = <a href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      lead={
        <p>
          {BRAND.name} t’aide à trouver un stage, une alternance ou un CDD et à préparer tes candidatures. Pour cela, il a besoin de
          ton CV et de tes choix de recherche. Cette page dit, sans jargon, ce que nous en faisons. En bref : pas de publicité, pas de
          revente, rien n’est envoyé à un recruteur sans ton accord, et tu peux tout supprimer en un clic.
        </p>
      }
    >
      <h2>1. Qui est responsable de tes données</h2>
      <p>
        Le responsable du traitement est {BRAND.publisher} ({BRAND.publisherStatus.toLowerCase()}). Pour toute question ou pour exercer
        tes droits : {mail}.
      </p>

      <h2>2. Les données que nous utilisons</h2>
      <div className="jj-table-wrap">
        <table>
          <thead>
            <tr><th>Données</th><th>D’où elles viennent</th><th>Pourquoi</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Adresse e-mail ; nom et photo du compte Google si tu te connectes avec Google</td>
              <td>Toi, ou Google au moment de la connexion</td>
              <td>Créer ton compte et te connecter</td>
            </tr>
            <tr>
              <td>Ton CV et ton profil : expériences, formations, projets, compétences, langues, coordonnées écrites dans le CV</td>
              <td>Le PDF que tu déposes, puis tes corrections</td>
              <td>Classer les offres selon ton profil, écrire tes CV et lettres</td>
            </tr>
            <tr>
              <td>Tes choix de recherche : métiers, contrats, villes</td>
              <td>Toi</td>
              <td>Te montrer les bonnes offres</td>
            </tr>
            <tr>
              <td>Tes offres gardées, tes candidatures, leurs statuts, tes notes et les documents générés</td>
              <td>Ton usage du service</td>
              <td>Suivre tes candidatures</td>
            </tr>
            <tr>
              <td>Tes réponses aux questions des formulaires (par exemple disponibilité, permis, nationalité)</td>
              <td>Toi, seulement si tu choisis d’y répondre</td>
              <td>Ne pas te reposer la même question à chaque candidature</td>
            </tr>
            <tr>
              <td>Clés d’accès à des sources d’offres que tu saisis toi-même</td>
              <td>Toi</td>
              <td>Interroger ces sources pour toi ; elles sont chiffrées et jamais réaffichées</td>
            </tr>
            <tr>
              <td>Données techniques : journaux de connexion et d’erreurs, nombre de recherches et d’appels à l’IA</td>
              <td>Le fonctionnement du site</td>
              <td>Sécurité, prévention des abus, maîtrise des coûts</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Nous ne te demandons jamais de données sensibles (santé, opinions, religion…). Ne les mets pas dans ton CV si tu ne veux pas
        qu’elles soient traitées.
      </p>

      <h2>3. Sur quelle base légale</h2>
      <ul>
        <li><strong>L’exécution du service que tu demandes</strong> en créant ton compte : compte, profil, recherche, documents, suivi.</li>
        <li><strong>Notre intérêt légitime</strong> à protéger le service et à maîtriser ses coûts : journaux techniques, limites de requêtes.</li>
        <li><strong>Une obligation légale</strong> quand la loi nous oblige à conserver ou transmettre une donnée.</li>
      </ul>

      <h2>4. L’intelligence artificielle</h2>
      <p>
        Pour lire ton CV, résumer les offres et écrire tes CV et lettres, le texte de ton profil et de l’offre est envoyé à l’API Gemini
        de Google. Rien n’est inventé : les documents ne reprennent que ce qui figure dans ton profil, et tu les relis avant tout envoi.
        Aucune décision automatique ne produit d’effet juridique à ton égard : tu choisis seul où et quand postuler.
      </p>
      <p className="jj-note">
        Phase de test : tant que le service n’est pas ouvert au public, il utilise l’offre gratuite de Gemini, dont Google peut se
        servir pour améliorer ses produits. Avant l’ouverture, nous passerons à l’offre payante, pour laquelle Google s’engage à ne pas
        utiliser ces contenus pour entraîner ses modèles. N’importe pas de CV pendant la phase de test si cela te gêne.
      </p>

      <h2>5. Qui reçoit tes données</h2>
      <p>Personne ne les achète et nous ne les montrons à aucun recruteur sans ton accord. Elles passent seulement par nos prestataires techniques :</p>
      <ul>
        <li><strong>Supabase</strong> : base de données et comptes, serveurs dans l’Union européenne (Irlande).</li>
        <li><strong>Vercel</strong> : hébergement du site (États-Unis et réseau mondial).</li>
        <li><strong>Railway</strong> : service qui lit les formulaires de candidature quand tu le demandes.</li>
        <li><strong>Google</strong> : connexion avec Google et IA Gemini.</li>
      </ul>
      <p>
        Quand des données quittent l’Union européenne, ces prestataires s’engagent par les clauses contractuelles types de la
        Commission européenne. Les offres d’emploi viennent de France Travail, d’Adzuna et des pages carrières des entreprises : nous
        ne leur envoyons aucune donnée te concernant.
      </p>

      <h2>6. Combien de temps</h2>
      <ul>
        <li>Ton compte, ton profil, tes documents et ton suivi : tant que ton compte existe. Ils sont effacés dès que tu supprimes ton compte.</li>
        <li>Les journaux techniques : selon la durée de nos hébergeurs, de quelques jours à 30 jours.</li>
        <li>Les offres d’emploi du catalogue ne sont pas des données personnelles : elles sont fermées puis effacées quand l’annonce disparaît.</li>
      </ul>

      <h2>7. Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les corriger, les effacer, les récupérer dans un fichier, t’opposer à un traitement ou en
        demander la limitation. Le plus simple :
      </p>
      <ul>
        <li><strong>Corriger</strong> ton profil dans Réglages.</li>
        <li><strong>Télécharger</strong> toutes tes données dans Réglages › Ton compte.</li>
        <li><strong>Supprimer ton compte</strong> et tout ce qu’il contient dans Réglages › Ton compte : c’est immédiat et définitif.</li>
      </ul>
      <p>
        Pour tout le reste, écris à {mail} : nous répondons sous un mois. Si tu estimes que tes droits ne sont pas respectés, tu peux
        saisir la CNIL (<a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noreferrer">cnil.fr/plaintes</a>).
      </p>

      <h2>8. Cookies et stockage</h2>
      <p>
        Nous n’utilisons ni cookie publicitaire, ni mesure d’audience, ni pixel de suivi. Le site dépose seulement ce qui est
        indispensable à son fonctionnement, ce qui ne demande pas ton consentement :
      </p>
      <ul>
        <li>les cookies de session de ta connexion (nom commençant par « sb- »), effacés quand tu te déconnectes ;</li>
        <li>deux petites informations dans le stockage de ton navigateur, le temps de ta visite : l’animation d’ouverture déjà vue et une recherche déjà lancée.</li>
      </ul>

      <h2>9. Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), chaque compte ne peut lire que ses propres données, clés d’accès chiffrées, politique de
        sécurité du contenu, limites de requêtes contre les abus. Aucune mesure n’est parfaite : si tu remarques un problème, écris-nous.
      </p>

      <h2>10. Connexion avec Google</h2>
      <p>
        Avec « Continuer avec Google », nous recevons seulement ton nom, ton adresse e-mail et ta photo de profil. Ils servent
        uniquement à créer ton compte et à te connecter. Nous n’accédons ni à tes e-mails, ni à tes fichiers, ni à tes contacts, et
        nous ne transmettons pas ces informations à des tiers. Leur usage respecte le règlement de Google sur les données
        utilisateur des services d’API, y compris ses exigences d’usage limité.
      </p>

      <h2>11. Âge</h2>
      <p>Le service est destiné aux étudiants. Il faut avoir au moins 15 ans pour créer un compte seul.</p>

      <h2>12. Changements</h2>
      <p>
        Si cette politique change, la date en haut de page change aussi ; pour un changement important, nous te prévenons à la
        connexion ou par e-mail. Voir aussi les <Link href="/conditions">conditions d’utilisation</Link> et les{" "}
        <Link href="/mentions-legales">mentions légales</Link>.
      </p>
    </LegalPage>
  );
}
