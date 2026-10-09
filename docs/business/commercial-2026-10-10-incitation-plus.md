# Commercial — plan d'incitation à LeBonTaf Plus

Date : 10 octobre 2026. Auteur : agent Commercial. Demande : coordination, sur trois décisions du propriétaire du 10 octobre.

## À lire d'abord

- **Trois décisions du propriétaire, prises le 10 octobre, que ce rapport exécute sans les rediscuter** : (1) proposer Plus plusieurs fois quand les dossiers gratuits du mois sont épuisés ; (2) 3 ou 4 cartes d'autres offres floutées sous la sélection du jour, avec des informations partielles envoyées par le serveur ; (3) Plus donne davantage d'offres par jour, en plus des 30 dossiers par mois.
- **Une ligne à régler avant d'encaisser** : la décision (3) fait payer pour recevoir plus d'offres, ce que le jugement du 8 octobre avait écarté (BIZ-18) ; avant le premier euro, il faut l'avis écrit d'un juriste sur ce point précis (France Travail, article 5.1, question Q8), la réponse écrite d'Adzuna (Q1), La bonne alternance éteinte, et le reste de la liste BIZ-26 (entreprise, conditions de vente, Stripe, Vercel Pro).
- Le paiement n'est pas ouvert. Le seul geste possible reste « Demander l'accès anticipé ».
- Rien de ce plan n'est codé. Rien n'a été vu à l'écran. Aucune conversion n'a jamais été mesurée (4 inscrits, 0 payant) : le classement « du plus rentable au moins rentable » est **mon opinion**, pas un chiffre.
- Je ne suis pas juriste. La section D rapporte ce que j'ai lu, pas un avis de droit.
- Je n'ai modifié ni le code, ni le backlog, ni le registre. Les propositions à inscrire sont en section 7.

## Résumé en cinq lignes

1. Six moments proposent Plus. Une seule fenêtre par jour (au clic, quand les dossiers sont épuisés) ; tout le reste est écrit dans la page, sans rien bloquer.
2. Sous la sélection : **3 cartes**, chacune une vraie offre que Plus donnerait aujourd'hui. Lisible : compétences en commun, contrat, ville, ancienneté. Jamais envoyés par le serveur : titre, entreprise, lien, identifiant.
3. Chiffre recommandé : **jusqu'à 8 offres par jour en gratuit, jusqu'à 20 avec Plus**. Le compteur « N autres offres » est compté par le serveur et plafonné à 12.
4. Trois textes actuels deviennent faux et doivent changer en même temps, dont « Tes offres du jour, elles, restent les mêmes pour tout le monde » sur la page de tarifs.
5. On suit quatre chiffres par jour, sans identifiant de compte dans les compteurs. Si les retours du lendemain baissent, on réduit la fréquence.

---

## A. Les six moments où proposer Plus

### Règles communes (à coder une seule fois)

| Règle | Détail |
| --- | --- |
| Qui ne voit jamais rien | Compte Plus ou en accès anticipé, administrateur, démonstration, inscription guidée en cours, et tout cas de doute (formule inconnue, compteur de dossiers non lu, sélection en cours de calcul ou en échec). Dans le doute : aucune proposition. |
| Une seule fenêtre | Le moment 1 est la seule fenêtre qui se pose par-dessus la page. Au plus **une par jour** (jour de Paris), donc jamais deux dans la même session. |
| Le reste est dans la page | Les moments 2 à 6 sont des blocs écrits dans la page. Ils ne couvrent rien et ne décalent pas le contenu déjà affiché. |
| Une proposition par écran | Jamais deux blocs Plus visibles en même temps sur le même écran. Priorité : le numéro le plus petit gagne. |
| Jamais pendant un travail | Aucune proposition pendant la lecture d'une fiche qui vient de s'ouvrir, pendant la préparation d'un dossier, ni pendant le calcul de la sélection. |
| Destination | Tous les boutons « Voir LeBonTaf Plus » mènent à `/tarifs?de=<moment>`. Le bouton « Demander l'accès anticipé » n'existe que sur la page de tarifs. |
| Si `PRICING_PAGE=0` | Aucun des six moments ne s'affiche (pas de bouton vers une page éteinte). |
| Dates | « le 1er novembre » est calculé (1er du mois suivant). C'est une vraie date, pas une urgence. |

« Plusieurs fois » veut dire ici : un étudiant qui a épuisé ses dossiers peut croiser Plus jusqu'à quatre fois dans la journée (bandeau, cartes, note dans la fiche, fenêtre au clic), mais une seule de ces quatre l'arrête.

### Moment 1 — Dossiers du mois épuisés, au clic

- **Endroit** : fiche d'une offre, au clic sur le bouton qui prépare le CV et la lettre.
- **Déclencheur** : le compteur du mois est à zéro (ou le serveur refuse pour quota mensuel) **et** aucune fenêtre n'a été montrée aujourd'hui.
- **Forme** : fenêtre centrée (feuille en bas de l'écran à 390 px), croix visible en haut à droite, touche Échap, clic à côté pour fermer.
- **Titre** : « Tes 2 dossiers du mois sont utilisés »
- **Phrase** : « Les 2 prochains arrivent le 1er novembre. Avec LeBonTaf Plus : 30 dossiers par mois et jusqu'à 20 offres par jour. Le paiement n'est pas encore ouvert, tu peux demander l'accès anticipé. »
- **Bouton principal** : « Voir LeBonTaf Plus »
- **Bouton secondaire, même taille** : « Attendre le 1er novembre »
- **Fréquence** : une fois par jour au plus. Aux clics suivants du même jour, pas de fenêtre : la note du moment 2 est déjà sous les yeux.

### Moment 2 — Dossiers du mois épuisés, dans la fiche

- **Endroit** : dans la fiche, à la place du bouton de préparation (c'est la note actuelle de `components/panel-notes.ts`).
- **Déclencheur** : compteur du mois à zéro, à chaque ouverture d'une fiche de la sélection.
- **Titre** (inchangé) : « Tes 2 dossiers du mois sont utilisés »
- **Phrase** : « Les prochains arrivent le 1er novembre. D'ici là, tu peux toujours garder et suivre tes offres, et modifier tes dossiers. Chaque dossier est écrit par une IA qui nous coûte de l'argent : 2 sont offerts chaque mois, 30 avec LeBonTaf Plus. »
- **Bouton** : « Voir LeBonTaf Plus »
- **Fréquence** : permanente tant que le compteur est à zéro. C'est une note, pas une fenêtre.
- Changement par rapport au texte actuel : le mot « chercher » sort de la phrase (le compte gratuit ne voit plus que sa sélection depuis le 9 octobre).

### Moment 3 — Cartes floutées sous la sélection du jour

- **Endroit** : vue « Pour toi », sous la dernière offre du jour. Détail en section B.
- **Déclencheur** : le serveur annonce au moins une offre de plus pour aujourd'hui (N ≥ 1).
- **Titre** : « 5 autres offres te correspondent aujourd'hui » (le nombre vient du serveur ; « 1 autre offre te correspond aujourd'hui » au singulier)
- **Phrase** : « Elles passent le même tri que tes offres du jour. Avec LeBonTaf Plus, tu en reçois jusqu'à 20 par jour au lieu de 8. »
- **Bouton** : « Voir LeBonTaf Plus »
- **Fréquence** : permanente, sans fenêtre. Au clic sur une carte : voir B.

### Moment 4 — Fin de la sélection du jour

- **Endroit** : même zone que le moment 3 ; seul le titre et la phrase changent (donc jamais deux blocs).
- **Déclencheur** : chaque offre du lot du jour a été ouverte, gardée ou écartée, **et** N ≥ 1.
- **Titre** : « Tu as fait le tour de tes 8 offres du jour » (nombre réel du lot : « de tes 5 offres du jour »)
- **Phrase** : « De nouvelles offres arrivent demain. Avec LeBonTaf Plus, 5 de plus dès aujourd'hui. » (même nombre N que le serveur)
- **Bouton** : « Voir LeBonTaf Plus »
- **Fréquence** : une fois par jour, jusqu'au lot du lendemain.
- Si N = 0 : texte actuel de `teaserText`, sans aucun mot sur Plus.

### Moment 5 — Dernier dossier restant

- **Endroit** : sous le message de réussite du dossier qui vient d'être préparé, dans la fiche.
- **Déclencheur** : un dossier vient d'être créé et il en reste exactement 1 ce mois-ci. Jamais avant ni pendant la préparation.
- **Titre** : « Il te reste 1 dossier ce mois-ci »
- **Phrase** : « Garde-le pour l'offre qui compte le plus. Avec LeBonTaf Plus : 30 dossiers par mois. »
- **Lien** (pas un bouton plein) : « Voir LeBonTaf Plus »
- **Fréquence** : une fois par mois.

### Moment 6 — Dossiers du mois épuisés, à l'accueil

- **Endroit** : bandeau en haut de « Pour toi », au-dessus de la sélection, avec une croix.
- **Déclencheur** : compteur du mois à zéro, première visite du jour.
- **Titre** : « Tes 2 dossiers du mois sont utilisés »
- **Phrase** : « Prochains dossiers le 1er novembre. Tu peux toujours suivre tes offres et modifier tes dossiers. »
- **Bouton** : « Voir LeBonTaf Plus »
- **Fréquence** : une fois par jour. Fermé par la croix : il ne revient pas avant le lendemain. Fermé trois jours de suite : il ne revient plus avant le mois suivant.

### Classement et raison

| Rang | Moment | Pourquoi ce rang (opinion) |
| --- | --- | --- |
| 1 | Clic avec dossiers épuisés | L'étudiant veut un dossier à cet instant et vient d'en voir deux : c'est le seul moment où le besoin est certain |
| 2 | Note dans la fiche | Même besoin, vu à chaque fiche, sans gêner |
| 3 | Cartes floutées | Vu tous les jours par tous les comptes gratuits : le plus de vues, un besoin moins sûr |
| 4 | Fin de la sélection | L'étudiant a tout regardé et en veut peut-être d'autres |
| 5 | Dernier dossier | Prépare la suite, mais l'étudiant a encore ce qu'il lui faut |
| 6 | Bandeau d'accueil | Rappel sans besoin immédiat ; le plus facile à ignorer |

- **Constat** : la demande du propriétaire tient en une fenêtre par jour et cinq blocs dans la page.
- **Preuve ou source** : textes actuels de `components/pricing.ts`, `components/unlock.ts`, `components/panel-notes.ts` ; jugement du 8 octobre (point 3) pour le ton. Aucune donnée de conversion.
- **Effort** : moyen pour le front (six blocs, une règle de fréquence commune). Le serveur doit donner le nombre de dossiers restants (déjà tenu par lui) et le nombre N.
- **Effet attendu** : des demandes d'accès anticipé venant surtout des moments 1 et 2. Hypothèse à vérifier avec les chiffres de la section E.

---

## B. Les cartes floutées

### Nombre : 3 cartes

Trois, pas quatre. À 390 px, trois cartes tiennent sur un écran avec le titre et le bouton ; la quatrième pousse le bouton hors de vue. Et le serveur aura plus souvent trois vraies offres que quatre. S'il n'y en a que 1 ou 2, on en montre 1 ou 2. S'il n'y en a aucune : pas de carte, pas de mot sur Plus.

### Règle de vérité

Chaque carte est **une vraie offre ouverte que Plus donnerait à ce compte aujourd'hui** : les rangs 9, 10 et 11 du même tri (contrat voulu et seuil de compétences en commun), pas des offres prises au hasard, pas des silhouettes dessinées.

### Ce que le serveur envoie pour une carte

| Élément | Envoyé | Affiché | Exemple |
| --- | --- | --- | --- |
| Nombre de compétences en commun | Oui | Lisible | « 5 compétences en commun » |
| Deux de ces compétences | Oui (deux au plus) | Lisible | « Python, SQL et 3 autres » |
| Type de contrat | Oui | Lisible | « Alternance » |
| Ville | Oui | Lisible | « Lyon » |
| Ancienneté de l'annonce | Oui | Lisible | « Publiée il y a 3 jours » |
| Titre du poste | **Non** | Barre grise dessinée | — |
| Entreprise | **Non** | Barre grise dessinée | — |
| Lien, identifiant de l'offre, texte, salaire, source | **Non** | Absent | — |

- Les barres grises sont un dessin. Il n'y a aucun vrai texte sous un flou : rien à lire en ouvrant les outils du navigateur.
- **Sans identifiant d'offre.** Tout compte connecté peut encore lire la table des offres (limite connue, audit E4) : avec l'identifiant, la carte se dévoilerait en une requête.
- Le score reste « compétences en commun », jamais une chance d'être pris (BIZ-02).
- L'ancienneté est la vraie date. Jamais « expire bientôt », jamais « plus que 2 jours ».
- Pas de mention de source sur la carte : aucune annonce n'y est affichée. À faire confirmer par le juriste avec le reste.
- Lecteurs d'écran : la carte se lit en une phrase, « Offre proposée avec LeBonTaf Plus : alternance à Lyon, 5 compétences en commun, publiée il y a 3 jours ». Les barres grises sont masquées.

### Textes

- **Au-dessus** : titre et phrase du moment 3 (ou du moment 4 en fin de sélection).
- **Étiquette sur chaque carte** : « Avec Plus »
- **Bouton sous les cartes** : « Voir LeBonTaf Plus »

### Le compteur

Oui, mais sous cette forme : « 5 autres offres te correspondent aujourd'hui ».

- N est **compté par le serveur** : les offres qui passent le même seuil et que Plus ajouterait aujourd'hui.
- N est **plafonné à 12** (20 moins 8). Afficher « + 47 offres » promettrait plus que Plus ne donne.
- Si le lot gratuit du jour fait moins de 8, N vaut 0 : il n'y a rien de plus à donner ce jour-là.
- Le nombre de cartes ne dépasse jamais N.

### Au clic sur une carte

Petite fenêtre (feuille en bas à 390 px), fermable par la croix, Échap et un clic à côté. Elle ne compte pas dans la limite d'une fenêtre par jour, parce que c'est l'étudiant qui l'ouvre.

- **Titre** : « Cette offre fait partie de LeBonTaf Plus »
- **Phrase** : « Alternance à Lyon, 5 compétences en commun avec ton CV. Avec LeBonTaf Plus, tu reçois jusqu'à 20 offres par jour au lieu de 8. Le paiement n'est pas encore ouvert. »
- **Bouton principal** : « Voir LeBonTaf Plus »
- **Bouton secondaire, même taille** : « Rester sur mes 8 offres »

Le clic ne mène jamais directement à un paiement ni à un e-mail.

- **Constat** : une carte qui montre nos calculs (compétences, contrat, ville, date) donne envie sans rien inventer ; ce qui tromperait, c'est un faux nombre ou une fausse offre.
- **Preuve ou source** : Tinder floute les photos de la grille « Likes You » pour les comptes sans Gold ou Platinum (centre d'aide Tinder, voir D) ; LinkedIn montre gratuitement les trois derniers visiteurs du profil et des totaux, la liste entière est payante (aide LinkedIn, voir D).
- **Effort** : moyen à élevé côté serveur (une réponse nouvelle : cartes partielles et N, calculés avec le lot), moyen côté front. Le code actuel dessine 4 à 6 silhouettes sans donnée (`silhouetteCount`) : à remplacer.
- **Effet attendu** : le bloc Plus le plus vu de l'application. Effet sur les demandes inconnu.

---

## C. Ce que promet Plus côté offres

### Chiffre recommandé : jusqu'à 8 par jour en gratuit, jusqu'à 20 avec Plus

| Raison | Détail |
| --- | --- |
| Cohérent avec le plafond déjà codé | 20 offres × 30 jours = 600, soit exactement les 600 analyses détaillées par mois du compte payant. Trente par jour ferait 900 et obligerait à relever ce plafond. |
| Tenable par le tri | Le lot ne se remplit jamais avec de mauvaises offres. Plus le chiffre est haut, plus il sera rarement atteint, et plus « jusqu'à » ressemble à une fausse promesse. |
| Assez loin de 8 | 2,5 fois plus : l'écart se comprend sans calcul. |

**Ce que je n'ai pas** : combien d'offres passent réellement le seuil chaque jour pour un profil. La mesure demandée au backend le 8 octobre (BIZ-28, trois profils aux jours 1, 5 et 10) n'apparaît dans aucun rapport que j'ai lu. **Tant qu'elle manque, 20 est une hypothèse.** Si les trois profils reçoivent rarement plus de 12 à 15 offres valables, écrire 15.

**Coût (estimation, à confirmer par la finance)** : le tri utilise des calculs déjà faits pour le catalogue ; le coût viendrait des analyses détaillées, déjà plafonnées à 600 par mois. Je n'ai pas vérifié si afficher une offre déclenche une analyse.

### Textes exacts pour la page de tarifs (`components/pricing.ts`)

- **Phrase d'en-tête (`lead`)** : « Plus d'offres choisies pour toi chaque jour, et plus de dossiers (CV et lettre) chaque mois. »
- **Gratuit** :
  - « Jusqu'à 8 offres par jour, choisies selon ton CV »
  - « 2 dossiers (CV et lettre) par mois »
  - « Le suivi de tes candidatures »
- **LeBonTaf Plus** (sous chaque prix, à la place de « Plus de dossiers (CV et lettre) chaque mois ») :
  - « Jusqu'à 20 offres par jour, choisies selon ton CV »
  - « 30 dossiers (CV et lettre) par mois »
- **Phrase de vérité, sous les deux colonnes** : « Certains jours, moins de 20 offres te correspondent : on ne complète jamais avec des offres qui ne te vont pas. Ces annonces sont publiques sur leur site d'origine ; Plus t'en trie davantage et te prépare plus de dossiers. Il ne garantit ni réponse, ni entretien, ni embauche. »
- Inchangés : « Paiement unique, TTC, sans abonnement. Réservé aux personnes de 18 ans et plus. », « Le paiement n'est pas encore ouvert. », bouton « Demander l'accès anticipé ».

### Textes actuels qui deviennent faux (à changer dans la même livraison)

| Fichier | Texte actuel | Problème |
| --- | --- | --- |
| `components/pricing.ts`, `lead` | « Tes offres du jour, elles, restent les mêmes pour tout le monde. » | Contraire à la décision (3) |
| `app/tarifs/page.tsx`, description de la page | « plus de dossiers CV et lettre, paiement unique » | Incomplet : proposer « plus d'offres par jour et plus de dossiers, paiement unique » |
| `components/panel-notes.ts`, note du mois | « tu peux toujours chercher, garder et suivre » | Le compte gratuit ne cherche plus dans le catalogue |
| Pages légales (non relues pour ce rapport) | Le commit `641e4f5e` y a écrit ce que Plus est | À relire : elles ne doivent pas dire que Plus ne change rien aux offres |

### Mots à ne pas écrire

« illimité », « toutes les offres », « toutes les offres de France Travail », « offres exclusives », « introuvables ailleurs », « débloque », « décroche ton stage », « garanti », un pourcentage de chances, le logo ou le mot « partenaire » de France Travail, un prix barré.

- **Constat** : la page de tarifs doit dire le nouveau contenu de Plus avec un chiffre que le tri peut tenir.
- **Preuve ou source** : plafonds codés (backlog, état au 9 octobre : 30 dossiers, 90 modifications, 600 analyses) ; seuil de qualité du lot (même paragraphe).
- **Effort** : faible côté front (textes), moyen côté serveur (lot de 20 pour un compte payant ; aujourd'hui il reçoit le même lot que le gratuit).
- **Effet attendu** : une promesse simple, « 8 ou 20 », que l'étudiant vérifie dès le premier jour.

---

## D. Les limites à ne pas franchir

### Ce que font les applications grand public (consulté le 10 octobre 2026)

| Application | Ce que j'ai lu | Source | Fiabilité |
| --- | --- | --- | --- |
| Tinder | Sans Gold ou Platinum, les photos de la grille « Likes You » sont floutées. L'étudiant continue d'utiliser l'application gratuitement. | [Centre d'aide Tinder, « Recently Active »](https://www.help.tinder.com/hc/en-us/articles/360040914992-Recently-Active) | Page officielle, lue par un résumé de recherche : elle a refusé ma lecture directe (403) |
| Tinder | Le flou se retirait par les outils du navigateur, parce que la vraie image était envoyée | [The Next Web, 4 mars 2020](https://thenextweb.com/apps/2020/03/04/its-painfully-easy-to-see-whos-liked-you-on-tinder-without-paying-for-gold/) | Presse. C'est la raison de la règle « le serveur n'envoie pas le titre » |
| Tinder | En mars 2024, engagement pris devant la Commission européenne de dire aux utilisateurs que ses réductions sont personnalisées et pourquoi | [La Libre, 7 mars 2024](https://www.lalibre.be/economie/digital/2024/03/07/tinder-va-devoir-expliquer-ses-differences-de-tarif-dans-lue-PFDXL3GEEVF5LMRUTAFBE6F6MI/) | Presse. Communiqué officiel de la Commission non retrouvé |
| LinkedIn | Compte gratuit : les trois derniers visiteurs du profil et des totaux. Premium : la liste entière. | [Aide LinkedIn, réponse 4508](https://www.linkedin.com/help/billing/answer/4508) | Page officielle, lue par un résumé de recherche |

**Ce que je n'ai pas vérifié** : le texte et la fréquence réels des fenêtres payantes de Tinder, LinkedIn, Duolingo ou Spotify (je n'ai trouvé aucune page officielle qui les décrive, et je n'ai ouvert aucune de ces applications) ; Duolingo et Spotify ne sont donc pas cités comme modèles. « Comme les grandes entreprises » ne prouve pas que c'est permis : Tinder a justement dû prendre des engagements.

### Ce que disent les textes français

- **DGCCRF**, fiche « Pièges sur les sites de commerce en ligne : attention aux dark patterns » (8 novembre 2023) : les comptes à rebours et les messages d'urgence sont cités parmi les interfaces trompeuses. [Page](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/pieges-sur-les-sites-de-commerce-en-ligne-attention-aux-dark-patterns), lue par un résumé de recherche (403 en lecture directe). La presse rapporte que la DGCCRF en fait une priorité pour 2025 à 2028 ([FashionNetwork](https://fr.fashionnetwork.com/news/-dark-patterns-quel-horizon-pour-les-pratiques-trompeuses-du-e-commerce-,1822021.html)).
- **Code de la consommation, article L. 121-2** ([Légifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563114), version en vigueur depuis le 28 mai 2022, lue) : une pratique est trompeuse notamment quand elle repose sur des indications fausses ou de nature à induire en erreur sur l'existence, les caractéristiques ou le prix du service.
- **Article L. 121-4, 7°** ([Légifrance](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563107), lu par un résumé de recherche) : est réputé trompeur le fait de déclarer faussement qu'un service ne sera disponible que pendant une période très limitée pour obtenir une décision immédiate.

**En une ligne, et je ne suis pas juriste** : le droit français de la consommation interdit de vendre avec une information fausse ou qui induit en erreur sur ce que le service contient, sur son prix ou sur sa disponibilité, fausse urgence comprise.

Non vérifié : si le règlement européen sur les services numériques (article 25, interfaces trompeuses) s'applique à LeBonTaf ; les sanctions exactes.

### Les limites, traduites pour l'écran

1. **Aucune fausse urgence** : pas de « plus que 3 places », pas de « offre valable aujourd'hui ». Les « 20 premiers » de l'accès anticipé ne s'écrivent que si le propriétaire compte vraiment et retire la phrase au vingt et unième.
2. **Aucun compte à rebours.** La seule date affichée est celle du retour des dossiers gratuits, et elle est vraie.
3. **Aucune fenêtre qui bloque la lecture** : une seule fenêtre par jour, jamais à l'arrivée, jamais sur une fiche en cours de lecture.
4. **Fermeture toujours visible** : croix d'au moins 44 px, touche Échap, clic à côté, et un bouton de refus de la même taille que le bouton Plus.
5. **Continuer gratuitement est toujours possible** et dit en clair : « Attendre le 1er novembre », « Rester sur mes 8 offres ». Pas de phrase qui culpabilise (« Non, je ne veux pas de stage »).
6. **Tout nombre affiché est compté par le serveur** au moment de l'affichage : N, le nombre de compétences, l'ancienneté.
7. **Chaque carte est une vraie offre que Plus donnerait aujourd'hui.**
8. **Le même prix pour tout le monde** : pas de réduction qui apparaît après un refus, pas de prix barré.
9. **Dire que le paiement n'est pas ouvert** partout où Plus est proposé par une fenêtre.
10. **Ne rien retirer au gratuit pour faire de la place** : 8 offres par jour et 2 dossiers par mois restent ce qu'ils sont.

- **Constat** : le flou et la répétition sont des pratiques courantes ; ce qui expose, c'est le faux (nombre, urgence, offre inventée) et la fenêtre dont on ne sort pas.
- **Preuve ou source** : tableaux ci-dessus.
- **Effort** : nul en plus, si les règles communes de la section A sont codées.
- **Effet attendu** : aucune plainte du type « on m'a forcé » ou « c'était faux », et un texte que le juriste pourra relire tel quel.

---

## E. Comment mesurer

### Les quatre chiffres

| Chiffre | Ce qu'on compte | Comment, sans donnée personnelle en plus |
| --- | --- | --- |
| 1. Vues | Nombre d'affichages de chaque moment (1 à 6), par jour | Compteur par jour et par moment, **sans identifiant de compte** |
| 2. Clics | Clics sur « Voir LeBonTaf Plus », par moment, par jour (c'est le `?de=` de l'adresse) | Même compteur |
| 3. Demandes d'accès anticipé | Clics sur « Demander l'accès anticipé », et e-mails réellement reçus | Compteur pour le clic ; les e-mails sont comptés à la main par le propriétaire. Un clic n'est pas un e-mail envoyé |
| 4. Retours le lendemain | Parmi les comptes gratuits venus le jour J, combien reviennent le jour J+1 | Calculé à partir de ce que le serveur enregistre déjà (un lot du jour par compte et par jour de visite). À confirmer par le backend : je n'ai pas vérifié que le lot n'est créé qu'à la visite |

### Règles

- Une seule petite table : jour, moment, événement, nombre. Pas d'identifiant, pas d'adresse IP, pas de cookie, pas d'outil d'analyse externe.
- Les rapports ne donnent que des totaux. Jamais un nom, une adresse ou un CV.
- Le chiffre 4 se lit avant et après la mise en ligne. S'il baisse, on réduit la fréquence (d'abord le bandeau, puis la fenêtre).
- Avec moins de 30 comptes actifs, ces chiffres ne sont pas des statistiques : ils se lisent comme des cas, pas comme des taux.
- Le propriétaire regarde les quatre chiffres une fois par semaine.

- **Constat** : quatre compteurs suffisent pour savoir quel moment rapporte et si l'insistance fait fuir.
- **Preuve ou source** : raisonnement ; aucune mesure n'existe aujourd'hui.
- **Effort** : faible (une table de compteurs, une requête pour les retours).
- **Effet attendu** : pouvoir dire après quatre semaines quel moment garder et lequel retirer.

---

## 6. Questions aux autres agents

**Au critique**

- Avec 20 offres par jour, le compte payant épuise 2,5 fois plus vite les bonnes offres de son profil. Que voit-il au jour 10 ?
- Une carte qui montre contrat, ville, deux compétences et la date permet-elle de retrouver l'annonce ailleurs en une minute ? Si oui, est-ce un défaut ou une preuve d'honnêteté ?
- Les 4 inscrits actuels ont tout vu gratuitement. Comment réagissent-ils aux cartes ?

**À la finance**

- Coût d'un compte à 20 offres par jour : le tri coûte-t-il de l'IA à chaque offre, ou seulement les analyses détaillées ?
- Le plafond de 600 analyses par mois suffit-il à 20 offres par jour, ou faut-il le relever ?
- Avec le plafond de 2 USD qui ne se renouvelle pas, combien de comptes en accès anticipé à 20 offres par jour peut-on servir ?

**À la valorisation** (jamais lancée)

- Un taux de clic sur les cartes, sans paiement ouvert, a-t-il une valeur pour un tiers ?

**Au backend**

- Combien d'offres passent le seuil chaque jour, au-delà des 8, sur trois profils dont un hors informatique ? C'est ce qui dit si « 20 » et le compteur N tiennent.
- Peut-on renvoyer les cartes partielles et N dans la même réponse que le lot, sans identifiant d'offre ?

**Au propriétaire**

- Comptes-tu vraiment les « 20 premiers » de l'accès anticipé ? Sinon la phrase doit partir.
- L'adresse de contact reçoit-elle bien les e-mails (point déjà ouvert au backlog) ? Sans cela, le chiffre 3 vaut zéro.

---

## 7. Propositions à inscrire au registre (statut `proposée`)

Numéros à attribuer par la coordination. Fait nouveau : décisions du propriétaire du 10 octobre. La décision (3) remplace la règle « limite de 8 identique pour tous » de BIZ-18 ; le registre doit le noter sans effacer la ligne.

| Proposition | Effort | Condition |
| --- | --- | --- |
| Six moments de proposition de Plus, une seule fenêtre par jour, textes de la section A | Moyen | Page de tarifs allumée |
| Trois cartes partielles, vraies offres des rangs 9 à 11, sans titre, entreprise, lien ni identifiant ; compteur N compté par le serveur et plafonné à 12 | Moyen à élevé | Réponse du backend sur la faisabilité |
| Plus = jusqu'à 20 offres par jour (gratuit : jusqu'à 8) ; textes de la section C | Faible (textes), moyen (serveur) | Mesure du backend sur trois profils ; sinon 15 |
| Correction des textes devenus faux (page de tarifs, note du mois, pages légales) dans la même livraison | Faible | Aucune |
| Dix limites de la section D, à faire relire par le juriste avec les textes | Nul | Avant d'encaisser |
| Quatre compteurs sans identifiant de compte, lecture hebdomadaire | Faible | Aucune |
| Avis du juriste demandé sur « payer pour recevoir plus d'offres par jour » (Q8), réponse d'Adzuna (Q1) | Démarche du propriétaire | Avant d'encaisser |
