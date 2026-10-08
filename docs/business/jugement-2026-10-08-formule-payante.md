# Jugement du 8 octobre 2026 (nuit) — les 8 offres, le flou et la formule payante : le COMMENT

Auteur : Juge business. Demande de la coordination, après la décision du propriétaire du 8 octobre au soir : « now implimenté la partie de 8 offer et les pricing et le flout et tout communicé avec judges concernat ce qui est profitable pour la marqueting et tout ».

**À lire d'abord.**

- **La décision est prise par le propriétaire** : faire maintenant les 8 offres par jour, le flou et la tarification. Mon premier jugement proposait de reporter (BIZ-15, BIZ-16). Je ne le redis pas. Ce jugement tranche seulement la manière.
- Rapports lus, tous du 8 octobre : `commercial-2026-10-08-formule-payante.md`, `finance-2026-10-08-formule-payante.md`, `critique-2026-10-08-formule-payante.md`. **L'agent valorisation n'a pas été lancé** : je ne le remplace pas (ordre BIZ-28).
- **Rien n'est vérifié en production sauf MVP-02. Tout coût est une estimation** (prix écrits dans le code, jamais comparés à une facture : BIZ-10 n'est pas fait).
- Aucun de nous n'est juriste. Les règles de droit citées viennent des rapports et des audits, pas d'une relecture des textes.
- **Les achats restent au propriétaire.** Je les recommande, je ne les décide pas : Vercel Pro, budget de la clé AI Gateway, Stripe, juriste, Supabase Pro.
- Avis de la session backend, pris comme un **fait du code** : toute la table des offres est lisible par tout compte connecté, et les offres sont déjà copiées dans la liste de chaque étudiant. Un vrai masquage par le serveur coûterait plusieurs jours et casserait le classement.
- Périmètre : seulement les décisions 2 à 5 de la spécification v1.1 (lot de 8, dossier sur offre déverrouillée, offres ajoutées à la main, catalogue conservé avec teaser flouté). L'écran d'accueil bloquant (décision 1) et l'écran « Prépare ta candidature » (décision 6) ne font pas partie de la demande du propriétaire : ils restent en pause.

## Vue d'ensemble en dix lignes

1. **Idée** : inchangée. CV lu, offres classées, CV + lettre adaptés, suivi.
2. **Produit** : beaucoup de code livré, un seul parcours prouvé (MVP-02). Le correctif « Java 17/21 » est livré en code le 8 octobre au soir, pas encore revu à l'écran (backlog, ligne 150).
3. **Ce qu'on peut vendre** : les trois rapports arrivent au même point. On vend du travail de rédaction (dossiers CV + lettre), jamais l'accès aux annonces (commercial § 1, critique « point qui commande tout », finance § 7 rang 6).
4. **Coût d'un abonné** : 0,04 € par mois en usage normal, 0,94 € au pire avec des plafonds mensuels. Estimation (finance § 1.5).
5. **Frais fixes dès qu'on affiche un prix** : Vercel Pro, environ 20 USD par mois. Le plan Hobby interdit tout usage commercial, y compris annoncer la vente d'un service (finance § 3, page Vercel lue le 8 octobre).
6. **Plafond de 2 USD** : il ne se renouvelle pas. Environ 1,60 USD restants ; le catalogue seul en consomme environ 1 USD par mois (finance § 5). Incompatible avec une vente.
7. **Marché** : les annonces sont gratuites partout ; les outils de CV se vendent 24 à 50 par mois à des adultes, et Kickresume est gratuit pour les étudiants (commercial § 2). Aucune donnée sur ce qu'un étudiant français paie.
8. **Utilisateurs** : 4 inscrits, 0 payant. Seuil de rentabilité estimé : 4 abonnés à 7,99 € avec Vercel Pro seul, soit 100 à 130 inscrits (finance § 6).
9. **Droit** : vendre des offres d'emploi ou faire payer un service de placement à un chercheur d'emploi est interdit, quelle que soit la source (critique § 1.1). Rien n'est prêt pour vendre : pas d'entreprise immatriculée, pas de conditions de vente (critique § 2).
10. **Risque principal** : pas le droit, le classement. Il n'a été vu que sur un profil, et la règle « les 8 meilleures pas encore vues » descend chaque jour dans la liste (critique § 3.2).

## Désaccords tranchés

| Sujet | Positions | Tranché | Preuve la plus solide |
| --- | --- | --- | --- |
| Ce que montre le flou | Commercial : vraies offres, score, contrat et ville visibles, classement coupé par le serveur. Critique : silhouettes sans aucune donnée réelle. | **Silhouettes sans donnée réelle.** | Fait du code (backend) : le masquage par le serveur coûte des jours et casse le classement. Un flou visuel sur de vraies données se lit en dix secondes. |
| Limite de 8 pour les payants | Commercial : classement complet dans Plus après l'avis du juriste. Critique : identique pour tous. | **Identique pour tous.** | Faire payer un rapprochement offres / candidat est exactement ce que la loi vise (critique § 1.5). Payer ne doit rien changer aux offres. |
| Prix | Commercial : 4,99 € / 19,99 €. Finance : 7,99 € / 34,99 €. | **7,99 € / 34,99 €**, avec règle de révision. | Calcul de la finance : 4,99 € doit convertir 1,66 fois plus pour rapporter autant, et demande 5 à 6 % de payants à 100 inscrits pour couvrir Vercel Pro. Aucune donnée ne montre ce gain de conversion. |
| Abonnement ou paiement unique | Commercial : mensuel sans engagement + semestre en une fois. Critique : paquet payé une fois. | **Paiement unique, sans renouvellement automatique**, pour les deux durées. | Critique § 2.2 : sans renouvellement, plus d'obligation de résiliation en ligne ni de litige de prélèvement. Le paquet de dossiers n'a été chiffré par personne : ordre à la finance. |
| Bouton payant à côté du flou | Commercial : « Découvrir LeBonTaf Plus » sur le mur. Critique : jamais de prix près du flou. | **Jamais près du flou.** L'offre payante se montre au compteur de dossiers. | Le flou sur des annonces se lit comme un mur payant, quel que soit le texte (critique § 5.1). |
| Analyses gratuites ramenées de 20 à 8 par jour | Finance : oui (FIN-03). Les autres : rien. | **Pas dans la première version.** | Gain estimé : 0,36 USD par mois au pire, sur un abus rare. À revoir après le rapprochement des factures. |
| Supabase Pro | Finance : avant le premier abonné. | **Recommandé avant l'étape (iii)**, pas avant. | Pas exigé par les conditions lues ; utile pour les sauvegardes dès qu'un client paie. |

## Les sept points

### 1. Ce qu'on vend, ce qui reste gratuit

- **Nom : « LeBonTaf Plus ».** Le mot « Pro » disparaît partout.
- **Phrase de vente : « Plus de CV + lettres préparés chaque mois. »** Pas le mot « offres ».
- **Gratuit** : jusqu'à 8 offres recommandées par jour, qui restent acquises ; tout le catalogue consultable avec recherche, filtres, lien vers l'annonce d'origine et mentions des sources ; 2 dossiers par mois ; modification d'un dossier existant ; suivi.
- **Plus** : 30 dossiers, 90 modifications et 600 analyses détaillées par mois. Les limites par jour actuelles (10 / 15 / 20) restent. Jamais « illimité ».
- **La limite de 8 est identique pour tous, payants compris.** Règle simple à tenir : payer ne change ni les offres visibles, ni les offres déverrouillées, ni leur ordre.
- Un dossier se prépare sur une offre déverrouillée ou sur une offre que l'étudiant ajoute lui-même. C'est vrai en gratuit comme en Plus.

### 2. Prix à afficher

- **Pass 30 jours : 7,99 €. Pass semestre (6 mois) : 34,99 €.** Paiement unique, **aucun renouvellement automatique**, prix toutes taxes comprises, réservé aux 18 ans et plus.
- Pas d'annuel, pas de prix barré, pas d'essai avec carte. Les 2 dossiers gratuits sont l'essai.
- **Règle de révision avant d'encaisser** : si la médiane du prix « sans hésiter » donné par les étudiants de l'accès anticipé est sous 6 €, on passe à 4,99 € / 19,99 €. Baisser un prix affiché est facile, le monter ne l'est pas.
- Estimation, pas une promesse : marge d'environ 6 € par pass de 30 jours, TVA comprise ; à 100 inscrits, aucun prix ne rapporte plus de 26 € par mois. Les premiers mois servent à apprendre.

### 3. Le mur flouté et les textes exacts

**Ce que montre le mur** : 4 à 6 silhouettes grises **dessinées**, sans titre, sans entreprise, sans score, sans lien. Zone masquée aux lecteurs d'écran, non cliquable. Un nombre réel est permis s'il est compté par le serveur. Aucun prix, aucun mot « Plus » dans cette zone, à aucune étape.

**Teaser, au-dessus des silhouettes**

> **Tes offres du jour sont là**
> Demain, de nouvelles offres choisies selon tes compétences. Celles que tu as déjà restent à toi.
> Tout le catalogue reste ouvert et gratuit.

**Bouton (le seul de la zone)** : « Explorer tout le catalogue »

**Variante quand moins de 8 offres passent le seuil de qualité**

> **Aujourd'hui, 3 offres te correspondent**
> On préfère t'en montrer peu que t'en montrer de mauvaises. Tout le catalogue reste ouvert et gratuit.

**Message dans la fiche d'une offre verrouillée** (écrit dans la fiche elle-même, pas dans une notification cachée dessous)

> **Cette offre n'est pas dans ta sélection**
> Tu peux la lire et ouvrir l'annonce sur son site. Les dossiers se préparent sur les offres de ta sélection et sur celles que tu ajoutes toi-même.

Bouton : « Voir l'annonce »

**Message quand les 2 dossiers du mois sont utilisés — étape (i), sans prix**

> **Tes 2 dossiers du mois sont utilisés**
> Les prochains arrivent le 1er novembre. D'ici là, tu peux toujours chercher, garder et suivre tes offres, et modifier tes dossiers.

(La date est calculée : le 1er du mois suivant.) Aucun bouton à l'étape (i).

**À partir de l'étape (ii) seulement**, on ajoute sous ce message :

> Chaque dossier est écrit par une IA qui nous coûte de l'argent. Deux sont offerts chaque mois.

Bouton : « Voir LeBonTaf Plus »

**Page de tarifs — étape (ii)**

> # Prépare plus de candidatures
> LeBonTaf lit ton CV et prépare un CV et une lettre adaptés à l'offre que tu choisis. Tu relis, tu corriges, et c'est toi qui envoies.
>
> **Gratuit — 0 €**
> - Jusqu'à 8 offres recommandées chaque jour
> - Tout le catalogue, avec recherche et filtres
> - 2 dossiers CV + lettre par mois
> - Suivi de tes candidatures
>
> **LeBonTaf Plus — 7,99 € pour 30 jours, ou 34,99 € pour 6 mois**
> Un seul paiement, aucun renouvellement automatique.
> - Tout ce qui est gratuit
> - 30 dossiers CV + lettre par mois
> - 90 modifications et 600 analyses détaillées par mois
>
> Les annonces sont gratuites, ici comme sur leur site d'origine. Plus ne donne accès à aucune offre de plus : il te prépare plus de dossiers. Il ne garantit ni réponse ni embauche.
>
> **Le paiement n'est pas encore ouvert.**

Bouton : « Demander l'accès anticipé »
Sous le bouton : « Gratuit pendant 30 jours pour les 20 premiers, contre trois réponses. Aucune carte demandée. »

**Interdits dans tous les textes** : « débloque les offres », « accède à toutes les offres », « offres réservées », « exclusives », « illimité », « décroche ton stage », « garanti », un pourcentage de chances, le logo ou le mot « partenaire » de France Travail, un compte à rebours, un prix barré, « on postule pour toi ».

### 4. La règle des 8

**Obligatoire dès la première version**

1. **Seuil de qualité : on ne remplit jamais à 8.** Une offre n'entre dans le lot que si son type de contrat correspond à ce que l'étudiant cherche et si elle passe un seuil de compétences en commun. Valeur de départ (opinion, à recaler par le backend) : au moins 2 compétences en commun. Moins de 8 offres, voire zéro, est un résultat normal, avec la variante de texte ci-dessus.
2. **Nouveau lot après changement de métiers**, le jour même, une fois par jour au plus. Sinon l'étudiant reste coincé avec les offres de l'ancienne cible.
3. **Repli** : si le vecteur du profil manque ou si le calcul échoue, on affiche le catalogue normal, jamais une page vide ni un faux verrou.
4. **Correctif « Java 17/21 » revu à l'écran** et message de refus visible dans la fiche (défaut D1 de l'audit MVP-05).
5. **Refus par le serveur** (403) de créer un dossier sur une offre non déverrouillée, vérifié en production et pas seulement par les tests.

**Deuxième version** : remplacement après « Pas pour moi », limité à 3 par jour. Motif : le seuil et le catalogue libre couvrent déjà le cas, et le remplacement ajoute des cas de concurrence (deux onglets, double clic) à tester avec MVP-06a. Dès la première version, on compte quand même les « Pas pour moi », les offres ouvertes et les dossiers créés sur le lot du jour : trois compteurs, sans IA.

### 5. Comptes existants

- **Toutes les offres déjà présentes dans la liste d'un compte à la date de bascule sont déverrouillées d'office**, regroupées sous « Avant le [date] », repliées. Rien de ce qui a été donné n'est repris ; le suivi en cours ne casse pas.
- Les offres ajoutées à la main restent déverrouillées d'office.
- Après la bascule, les nouvelles lignes copiées dans une liste ne sont pas déverrouillées, sauf lot du jour et ajout manuel.
- Les quatre comptes reçoivent un message **avant** la bascule (promesse des conditions actuelles, section 10).
- Migration testée sur une copie de la base, puis appliquée en production par le propriétaire.

### 6. Séquence en trois étapes

| | (i) Maintenant, sans prix | (ii) Page de tarifs + accès anticipé | (iii) Encaissement |
| --- | --- | --- | --- |
| **Ce qui peut être mis en ligne** | Lot de 8 avec seuil ; silhouettes ; refus 403 ; textes du point 3 (version sans prix) ; comptes existants déverrouillés ; trois compteurs | Page de tarifs avec « Le paiement n'est pas encore ouvert » ; bouton « Voir LeBonTaf Plus » au compteur de dossiers ; accès anticipé : 20 étudiants, 30 jours, 10 dossiers chacun, trois questions | Paiement Stripe des deux pass ; reçu ; remboursement sur simple demande pendant 14 jours |
| **Conditions techniques** | Migration `offer_unlocks` testée sur copie ; correctif Java revu ; D1 corrigé | Plafonds Plus dans le code **avant** d'activer un seul compte (aujourd'hui « pro » = sans limite mensuelle) ; compteur de dossiers écrit par le serveur seul | Paiement testé en mode test, échec et remboursement compris ; MVP-06a ; réserves PUBLIC-06 levées |
| **Ce qu'il faut du propriétaire** | Dire que cette étape passe devant la suite de MVP-03 à 06 (voir « Contrôle du registre ») ; message aux 4 comptes ; application de la migration ; `STUDENT_CATALOGUE_ONLY=1` (déjà demandé) | **Achat Vercel Pro (environ 20 USD par mois), avant la mise en ligne de la page** ; décision sur le budget de la clé AI Gateway ; activation à la main des comptes en accès anticipé ; lecture des clés de sources posées dans Vercel (Q18) | Entreprise immatriculée ; avis écrit d'un juriste sur les textes du point 3 (Q8) ; réponse écrite d'Adzuna (Q1) ou retrait de la source ; conditions de vente, rétractation, médiateur ; page de confidentialité corrigée ; compte Stripe ; budget IA renouvelable ; Supabase Pro recommandé |

**Interdit à l'étape (i), tant que Vercel est en Hobby** (page Vercel citée par la finance : annoncer la vente d'un service est déjà un usage commercial) :

- tout prix, où que ce soit sur le site ;
- les mots « Plus », « Pro », « formule payante », « bientôt payant » ;
- une page de tarifs, même marquée « bientôt » ;
- une liste d'attente ou un bouton « Ça m'intéresse » pour une offre payante ;
- tout bouton ou lien de paiement ;
- le « Pro à 7,99 € » encore affiché dans l'administration (à retirer, BIZ-11).

**Sur le budget à l'étape (ii), estimation.** L'accès anticipé coûte au plus 200 dossiers, soit 0,22 à 0,78 USD. Avec environ 1,60 USD restants sur une clé qui ne se renouvelle pas et un catalogue qui en prend 1 par mois, le plafond serait atteint en quelques semaines et tout le monde serait bloqué. Sans décision du propriétaire sur le budget, l'accès anticipé se réduit à 10 étudiants et 5 dossiers.

**Sur le juriste.** L'avis est obligatoire avant l'étape (iii). Je recommande de le demander dès l'étape (ii), textes du point 3 sous les yeux : une permanence d'avocats ou une clinique juridique d'université peut suffire (critique § 1.1, estimation non vérifiée).

### 7. Marketing : les 100 premiers inscrits

1. **Message unique** : « Chaque jour, les offres de stage et d'alternance qui collent à tes compétences, et un CV + une lettre adaptés à celle que tu choisis. » Le gratuit recrute ; on ne parle pas du prix dans l'acquisition.
2. **Semaines 1 et 2 : ta promotion et ton école.** Démonstration de dix minutes à des camarades, message dans les groupes de promotion. Objectif (hypothèse) : 20 à 40 inscrits, 0 €.
3. **Semaines 3 à 6 : 3 à 5 associations étudiantes**, avec un atelier « un CV adapté à une offre en dix minutes ». Objectif (hypothèse) : 30 à 50 inscrits. Aucun contact au nom de LeBonTaf sans ton accord.
4. **Parrainage** : « un ami inscrit qui dépose son CV = 2 dossiers de plus pour toi ». Coût estimé : moins d'un centime par parrainage. Une démonstration avant / après par semaine.
5. **Aucune publicité payante. Pas d'inconnus avant PUBLIC-06 et MVP-06b.** L'accès anticipé (étape ii) sert à mesurer le prix accepté : 20 réponses donnent une direction, pas une preuve.

## Comparaison des options

| Option | Effet | Coût (estimation) | Risque | Délai |
| --- | --- | --- | --- | --- |
| Payer pour voir plus d'offres | Faible : les annonces sont gratuites ailleurs | Élevé : masquage par le serveur, plusieurs jours | Très élevé : interdit par la loi et les licences | Semaines |
| **Gratuit 8 par jour + Plus = plus de dossiers (retenu)** | Une offre qu'un étudiant comprend et qu'on peut défendre | Moyen : v1.1 partielle + plafonds Plus | Faible pour les dossiers, à confirmer par un juriste | Étape (i) sans achat |
| Tout gratuit, payé par les écoles | Bon pour l'étudiant | Faible en code, élevé en démarchage | Faible, aucun revenu avant des mois | Mois |
| Pass 7,99 € / 34,99 € (retenu) | Seuil à 4 abonnés | Vercel Pro 20 USD par mois | Conversion inconnue | Étape (ii) |
| Pass 4,99 € / 19,99 € | Prix plus facile à accepter | Idem | Demande 1,66 fois plus de payants | Repli si l'accès anticipé le montre |
| Paquet de dossiers payé une fois | Le plus simple à comprendre | Non chiffré | Non chiffré | Ordre à la finance |

## Ordres

Classement : les priorités du propriétaire passent d'abord. Sa décision du 8 octobre au soir place l'étape (i) dans le travail en cours ; les ordres ci-dessous sont proposés pour dire comment.

| N° | Ce qu'il faut changer | À qui | Effet attendu | Effort | Priorité |
| --- | --- | --- | --- | --- | --- |
| BIZ-18 | Formule : on vend « plus de dossiers préparés », jamais l'accès aux offres. Payer ne change ni les offres visibles, ni les offres déverrouillées, ni la limite de 8. Catalogue entier gratuit, lien d'origine et mentions conservés. Nom « LeBonTaf Plus », le mot « Pro » retiré | Propriétaire (décision), coordinateur, front | Offre défendable face à la loi et aux sources | Faible | P1 |
| BIZ-19 | Étape (i), sans prix : lot de 8, silhouettes sans donnée réelle, refus 403 par le serveur, textes exacts du point 3. Aucun prix ni mot « Plus » tant que Vercel est en Hobby. Périmètre : décisions 2 à 5 de la v1.1 seulement | Coordinateur (backlog), backend, front | La demande du propriétaire en ligne sans achat ni faute | Moyen | P1 |
| BIZ-20 | Qualité du lot dès la première version : seuil au lieu de remplir à 8, contrat cohérent, repli sur le catalogue si le calcul échoue, nouveau lot après changement de métiers, message de refus dans la fiche (D1), correctif Java revu à l'écran, trois compteurs. Remplacement après « Pas pour moi » : deuxième version | Backend, front | Pas de mauvaises offres imposées | Moyen | P1 |
| BIZ-21 | Comptes existants : toutes les offres présentes à la bascule déverrouillées d'office ; message aux 4 comptes avant ; migration testée sur copie puis appliquée par le propriétaire | Backend (migration), propriétaire (message, application) | Rien de repris aux inscrits | Faible | P1 |
| BIZ-22 | Plafonds Plus dans le code : 30 dossiers, 90 modifications, 600 analyses par mois, limites par jour conservées ; compteur de dossiers écrit par le serveur seul. Avant toute activation d'un compte Plus | Backend ; migration avec le lot REVUE-03 | Un compte ne peut ni vider le budget commun ni contourner ce qu'on vend | Faible à moyen | P2 |
| BIZ-23 | Prix à afficher : 7,99 € pour 30 jours et 34,99 € pour 6 mois, paiement unique sans renouvellement, TTC, 18 ans et plus. Révision à 4,99 € / 19,99 € si la médiane de l'accès anticipé est sous 6 € | Propriétaire (décision) | Seuil à 4 abonnés ; moins d'obligations qu'un abonnement | Nul | P2 |
| BIZ-24 | Étape (ii) : page de tarifs « paiement pas encore ouvert » et accès anticipé (20 étudiants, 30 jours, 10 dossiers, trois questions) | Front, backend, propriétaire (activation à la main) | Usage réel de Plus et prix déclaré | Faible à moyen | P2, après BIZ-19 à 22 et Vercel Pro |
| BIZ-25 | Achats recommandés, à décider par le propriétaire : Vercel Pro avant l'étape (ii) ; budget renouvelable pour la clé AI Gateway après le rapprochement des factures (BIZ-10) ; consultation d'un juriste ; Supabase Pro avant l'étape (iii) | Propriétaire seul | Service commercial permis et qui ne se coupe pas | Environ 20 USD par mois d'abord | P2 |
| BIZ-26 | Étape (iii), encaissement : seulement quand la liste « avant d'encaisser » est complète (critique § 2.2 et classe B) | Propriétaire, puis coordinateur | Aucun euro pris hors des règles | Élevé | P3 |
| BIZ-27 | Plan des 100 premiers : promotion et école, associations, parrainage à 2 dossiers ; aucune publicité, aucun inconnu avant PUBLIC-06 et MVP-06b | Propriétaire (contacts), front et backend (parrainage, plus tard) | 70 à 120 inscrits (hypothèse) | 15 à 25 heures | P2 |
| BIZ-28 | Ordres aux agents (détail ci-dessous) | Coordinateur (lancement) | Chiffres manquants | Faible | P2 |

### Ordres aux agents (BIZ-28)

- **Backend, en lecture seule** : (1) sur trois profils de test dont un hors informatique, calculer ce que donnerait le lot aux jours 1, 5 et 10, puis proposer le seuil ; (2) compter les offres ouvertes par source ; (3) dire si, après la bascule, la recherche d'un compte continue d'ajouter des centaines de lignes dans la liste de l'étudiant.
- **Finance** : chiffrer le paquet de dossiers payé une fois (5 et 10 dossiers) face aux deux pass ; chiffrer le coût annuel de « pouvoir encaisser » (entreprise, médiateur, juriste) ; refaire les marges après BIZ-10.
- **Commercial** : rédiger les trois questions et la grille de lecture des réponses de l'accès anticipé, sans donnée personnelle dans les rapports.
- **Valorisation** : à lancer. Question : qu'est-ce qui pèse le plus, 100 inscrits actifs ou 5 payants ?
- **Propriétaire** : lire dans Vercel quelles clés de sources sont posées (Q18), deux minutes ; dire son école, sa filière, sa ville.

## Contrôle du registre

- **Aucune proposition refusée** n'existe au registre.
- **BIZ-15 et BIZ-16** étaient proposées en report. Fait nouveau : décision du propriétaire du 8 octobre au soir. Statut mis à jour au registre, sans effacer. BIZ-16 disait « réserver le reste des offres aux comptes Pro » : cette forme est remplacée par BIZ-18 (on ne réserve aucune offre), ce que les trois rapports recommandent.
- **BIZ-17** (lancer finance, commercial, critique) : fait le 8 octobre, **avant** BIZ-10. Les chiffres sont donc des estimations non rapprochées des factures.
- **Priorité de rang 4 (v1.1 en pause)** : levée par le propriétaire pour les 8 offres, le flou et la tarification seulement.
- **Priorité de rang 1 (MVP-01 à 06 d'abord)** : elle n'a pas été retirée. La décision du soir dit « maintenant ». Je ne tranche pas à la place du propriétaire : il doit confirmer que l'étape (i) passe devant la suite des vérifications. Ce qui limite la perte : MVP-03 et MVP-05 se vérifient directement sur le nouvel écran, donc une seule fois.
- **Priorité de rang 3 (plafond de 2 USD, aucun achat)** : inchangée. BIZ-25 recommande, ne décide rien.
- **BIZ-06 et BIZ-07** (reportées) : non reprises. Le seuil de qualité de BIZ-20 n'est pas le score combiné de BIZ-07 : il ne fait que retirer des offres du lot.
- **BIZ-14** (admin en écriture) : non reprise. L'activation d'un compte en accès anticipé reste un geste du propriétaire dans Supabase.

## Demande de décision au propriétaire

| Ordre | Décision (accepter / refuser / reporter) |
| --- | --- |
| BIZ-18 On vend des dossiers, jamais des offres ; « LeBonTaf Plus » | ? |
| BIZ-19 Étape (i) sans prix, silhouettes, refus par le serveur | ? |
| BIZ-20 Seuil de qualité, nouveau lot après changement de métiers | ? |
| BIZ-21 Comptes existants déverrouillés, message avant | ? |
| BIZ-22 Plafonds Plus et compteur tenu par le serveur | ? |
| BIZ-23 Prix 7,99 € / 34,99 €, paiement unique | ? |
| BIZ-24 Page de tarifs et accès anticipé | ? |
| BIZ-25 Achats recommandés (Vercel Pro, budget IA, juriste, Supabase Pro) | ? |
| BIZ-26 Conditions avant d'encaisser | ? |
| BIZ-27 Plan des 100 premiers | ? |
| BIZ-28 Ordres aux agents | ? |

Une question en plus : l'étape (i) passe-t-elle devant la suite de MVP-03 à 06 ?

## Résumé en cinq lignes

1. On vend « LeBonTaf Plus » : 30 dossiers CV + lettre par mois au lieu de 2. On ne vend jamais des offres ; la limite de 8 par jour est la même pour tous et tout le catalogue reste gratuit.
2. Prix à afficher : 7,99 € pour 30 jours ou 34,99 € pour 6 mois, en un seul paiement sans renouvellement. On baisse à 4,99 € / 19,99 € si l'accès anticipé le montre.
3. Le flou est un décor : des silhouettes sans vraie donnée. Le serveur refuse le dossier sur une offre verrouillée. On ne remplit jamais à 8 avec de mauvaises offres.
4. Maintenant : les 8, le flou, sans aucun prix ni mot « Plus » tant que Vercel est en Hobby. Ensuite : Vercel Pro, page de tarifs et accès anticipé. Enfin : entreprise, juriste, Stripe.
5. Les 100 premiers viennent de ta promotion, de 3 à 5 associations et du parrainage, sans publicité. Les offres déjà dans les comptes restent déverrouillées.
