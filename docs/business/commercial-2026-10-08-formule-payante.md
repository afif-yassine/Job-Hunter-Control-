# Commercial — formule payante, limite de 8 offres et mur flouté

Date : 8 octobre 2026 (soir). Auteur : agent Commercial. Demande : coordination, sur décision du propriétaire.

## À lire d'abord

- **Fait nouveau (8 octobre au soir)** : le propriétaire a décidé de mettre en œuvre maintenant la limite de 8 offres pour le compte gratuit, le floutage du reste et une tarification. Le juge conseillait de reporter (BIZ-15, BIZ-16). Ce rapport ne rediscute pas la décision : il cherche la façon la plus profitable et la moins risquée de la faire.
- **Ce rapport ne décide rien.** Aucun prix n'est adopté. Tous les prix ci-dessous sont des **hypothèses à tester**, à confirmer par l'agent finance.
- **Tous les coûts sont des estimations**, calculées avec les prix écrits dans `lib/economics.ts`, jamais comparés à une facture (BIZ-10 non fait).
- **Ce n'est pas un avis juridique.** Je lis les licences comme un commercial, pas comme un juriste.
- État réel : 4 inscrits, 0 payant, pas de Stripe, seul MVP-02 vérifié en production, classement non validé (MVP-03, défaut « Java 17/21 »).
- Je n'ai pas modifié le registre (consigne de la coordination). Les propositions à y inscrire sont listées en section 8, statut `proposée`.

## Résumé en cinq lignes

1. **On vend l'atelier de candidature, jamais l'accès aux offres.** Gratuit : 8 recommandations par jour, 2 dossiers par mois, et tout le catalogue reste consultable. Payant (« LeBonTaf Plus ») : 30 dossiers par mois, analyses détaillées, puis le classement complet une fois l'avis juridique reçu.
2. **Prix à tester : 4,99 € par mois sans engagement, ou 19,99 € le semestre en paiement unique.** Pas d'année, pas de faux « prix barré », pas d'essai avec carte.
3. **Le mur flouté cache l'ordre du classement, pas les offres.** On montre le score, le contrat et la ville ; un bouton gratuit « Explorer tout le catalogue » reste toujours à côté du bouton Plus.
4. **Sans Stripe : accès anticipé gratuit pour 20 étudiants**, 30 jours, 10 dossiers chacun, en échange de trois réponses dont le prix acceptable. C'est ce qui donne le plus d'information.
5. **100 premiers étudiants** : la promotion et l'école du propriétaire, puis 3 à 5 associations étudiantes, puis un parrainage « un ami inscrit = 2 dossiers ». Rien à ouvrir à des inconnus avant PUBLIC-06 et MVP-06b.

---

## 1. Que vend-on exactement

### Les trois options

| Option | Ce que l'étudiant achète | Attrait pour l'étudiant | Risque vis-à-vis des sources |
| --- | --- | --- | --- |
| **(a)** Payer pour voir toutes les offres | L'accès aux offres | Faible : les mêmes offres sont gratuites sur France Travail, Indeed, JobTeaser | **Très élevé.** C'est mot pour mot ce que les licences interdisent (voir preuves) |
| **(b)** Gratuit = 8 offres par jour + catalogue flouté ; payant = dossiers, analyses, classement complet | Du travail fait pour lui (documents, analyse) et un tri | Bon : c'est ce que les outils de CV vendent déjà, entre 24 et 50 par mois | Faible pour les dossiers. **Moyen pour le « classement complet »** si le catalogue devient invisible sans payer |
| **(c)** Tout gratuit côté étudiant, payé par les écoles ou les entreprises | Rien | Excellent | Faible, mais aucun revenu avant des mois et un autre métier (vente aux écoles) |

### Preuves

- France Travail, article 5.1 de la licence (cité dans l'audit du 7 octobre) : « aucune rétribution, directe ou indirecte, ne peut être exigée des personnes à la recherche d'un emploi en contrepartie de la fourniture de services de placement » ; « il est interdit […] de vendre des offres d'emploi ».
- La bonne alternance : interdit « la facturation de l'accès pour des tiers comme des candidats » (audit, § 3.5).
- Adzuna : tout usage commercial autre que publier ses annonces demande un accord écrit (audit, § 3.1, question Q1 sans réponse).
- JSearch par OpenWeb Ninja : usage commercial permis à condition de ne pas revendre les données comme produit séparé (audit, § 3.4).
- Marché : JobTeaser, Welcome to the Jungle et Indeed sont gratuits pour le candidat, ce sont les entreprises qui paient (sources en section 2). L'étudiant ne paiera donc pas pour « voir des offres ».

### Recommandation unique : option (b), avec deux garde-fous

**Nom proposé : « LeBonTaf Plus »** plutôt que « Pro » (un étudiant n'est pas un « professionnel », et « Pro » évoque un outil pour recruteurs).

| | Gratuit | Plus |
| --- | --- | --- |
| Catalogue complet (recherche, filtres, lien vers l'annonce) | Oui, toujours | Oui, identique |
| Recommandations classées pour ton profil | 8 nouvelles par jour, qui restent acquises | Tout le classement — **seulement après l'avis du juriste** |
| Dossiers CV + lettre | 2 par mois | 30 par mois |
| Modifier un dossier existant | Oui | Oui |
| Analyse détaillée d'une offre face à ton CV | Limitée (réglage actuel) | Large |
| Suivi des candidatures | Oui | Oui |

**Garde-fou 1 : aucune offre n'est jamais derrière le paiement.** Le bouton « Explorer tout le catalogue » reste gratuit, pour tout le monde, tout le temps (c'est déjà la spécification v1.1, décision 5). Ce que le flou cache, c'est **l'ordre calculé pour toi**, pas l'offre. Un étudiant gratuit qui cherche trouve la même annonce par les filtres. C'est ce qui permet de dire : « on vend notre travail, pas vos annonces ».

**Garde-fou 2 : le « classement complet » n'entre dans Plus qu'après la réponse à la question Q8 de l'audit.** Raison : classer des offres pour une personne ressemble à un « service de placement », et c'est précisément ce qu'on ne peut pas faire payer à un chercheur d'emploi. Les dossiers CV et lettre, eux, sont le métier des outils de CV : c'est la partie la plus sûre. **Opinion, pas un fait** : c'est au juriste de trancher.

Conséquence pratique : Plus démarre avec **les dossiers et les analyses**. Le classement complet s'ajoute ensuite, sans changer le prix.

**Pourquoi « 30 dossiers » et pas « illimité ».** Estimation : un dossier coûte environ 0,003 USD d'IA (3 000 jetons lus et 5 000 écrits au prix du code, non vérifié). Trente dossiers : environ 0,08 USD. Le problème n'est pas le coût unitaire, c'est le **plafond de 2 USD** partagé par tout le monde : « illimité » permettrait à un seul compte de vider le budget de tous (risque déjà signalé par le juge). Trente par mois, c'est un par jour : aucun étudiant sérieux n'en fait plus.

- **Constat** : la seule chose que l'étudiant paie ailleurs, c'est l'aide à la candidature ; la seule chose que les sources interdisent clairement, c'est de faire payer l'accès aux offres.
- **Preuve ou source** : licences citées ci-dessus ; prix des outils de CV en section 2.
- **Effort** : moyen. La v1.1 est déjà spécifiée ; il faut en plus un plafond pour les comptes Plus dans `lib/plan.ts` (aujourd'hui « pro » = sans limite).
- **Effet attendu** : une offre payante qu'on peut défendre devant France Travail et Adzuna, et qu'un étudiant comprend en une phrase.

---

## 2. Prix

### Ce que font les autres (consulté le 8 octobre 2026)

| Acteur | Prix pour le candidat | Source | Fiabilité |
| --- | --- | --- | --- |
| Kickresume (CV et lettres par IA) | 24 € par mois ; 54 € par trimestre ; 96 € par an. **Gratuit pour les étudiants** sur justificatif (ISIC, UNiDAYS) | [kickresume.com/en/pricing](https://www.kickresume.com/en/pricing/) | Page officielle lue |
| Rezi (CV par IA) | 29 USD par mois ; 149 USD à vie | [Aide officielle Rezi](https://www.rezi.ai/docs/rezi-subscription-plans-explained) | Page officielle, lue par résumé de recherche |
| Teal (CV + suivi) | 29 USD par mois ; 79 USD par trimestre ; formule à la semaine (9 ou 13 USD selon les sources) | [frontdeskreview.com](https://frontdeskreview.com/software/resume-builders/teal/), [resumegenius.com](https://resumegenius.com/reviews/teal-resume-builder-reviews) | Sites tiers ; la page officielle refuse la lecture |
| Jobscan (CV face à l'offre) | Environ 49,95 USD par mois ; 89,95 USD par trimestre | [resumly.ai](https://resumly.ai/answers/is-jobscan-worth-it), [softwaresuggest.com](https://www.softwaresuggest.com/jobscan/pricing) | Sites tiers |
| Simplify+ (lettres IA, remplissage) | Environ 39,99 USD par mois ; remplissage gratuit | [jobright.ai](https://jobright.ai/blog/simplify-copilot-review-2026-features-pricing-and-top-alternatives/) | Site tiers, concurrent |
| LinkedIn Premium Career | Environ 30 à 40 € par mois en France | [swello.com](https://swello.com/fr/blog/linkedin-premium/), [evaboot.com](https://evaboot.com/fr/blog/linkedin-premium-prix) | Sites tiers |
| JobTeaser | Gratuit pour l'étudiant ; 800+ établissements, 2+ millions d'étudiants annoncés | [jobteaser.com, À propos](https://www.jobteaser.com/fr/corporate/a-propos), [betterteam.com](https://www.betterteam.com/fr/jobteaser) | Chiffres : page officielle. « Les entreprises paient » : site tiers |
| Welcome to the Jungle | Gratuit pour le candidat ; les entreprises paient leur vitrine | [frenchweb.fr](https://www.frenchweb.fr/avec-20-millions-deuros-de-plus-welcome-to-the-jungle-perennisera-t-il-son-modele/381369), [betterteam.com](https://www.betterteam.com/fr/welcome-to-the-jungle) | Presse et site tiers |
| Indeed | Gratuit pour le candidat, CV simple inclus | [fr.indeed.com/about](https://fr.indeed.com/about), [resufit.com](https://resufit.com/fr/blog/indeed-createur-de-cv-gratuit-mais-est-ce-suffisant/) | Page officielle générale + test d'un concurrent |
| Repère de budget étudiant : Spotify Étudiants | Environ 7 € par mois | [gamsgo.com](https://www.gamsgo.com/fr/blog/prix-de-spotify) | Site tiers |

**Ce que je n'ai pas pu vérifier** : le prix officiel de LinkedIn Premium (page réservée aux comptes connectés) et une éventuelle offre étudiante ; la page officielle de Teal, Jobscan et Simplify ; CVDesignR (page de prix introuvable) ; les tarifs de France Travail (service public, gratuit, non recherché) ; ce que les étudiants français paient réellement, faute d'étude. Aucun de ces acteurs ne vend exactement « offres classées + dossier adapté » à un étudiant français : la comparaison reste approximative.

### Ce que j'en tire

- Les outils de CV par IA se vendent **24 à 50 par mois**, à des adultes en recherche d'emploi, surtout aux États-Unis.
- Mais l'étudiant français a **tout le reste gratuit** (JobTeaser par son école, Indeed, Welcome to the Jungle, un assistant IA généraliste gratuit), et Kickresume **donne** son offre payante aux étudiants.
- Le prix doit donc se situer au niveau d'un abonnement étudiant courant, pas d'un outil de CV américain.

### Hypothèses de prix à tester (rien n'est adopté)

| Formule | Hypothèse | Pourquoi |
| --- | --- | --- |
| Mensuel sans engagement | **4,99 €** | Sous le repère des 7 € d'un abonnement étudiant. L'ancien 7,99 € reste une proposition historique, ni retenue ni écartée ici |
| Pass semestre, paiement unique, sans renouvellement | **19,99 €** pour 6 mois | Une recherche de stage dure quelques mois. Un seul paiement : pas de résiliation à gérer, et une seule commission fixe |
| Annuel | **Non** | Personne ne cherche un stage douze mois de suite |
| Tarif étudiant séparé | **Non** | Tous les clients sont étudiants. Afficher un « prix normal » barré que personne ne paie serait un faux prix de référence |
| Essai | **Pas d'essai avec carte.** L'offre gratuite (2 dossiers par mois) est l'essai | Un essai avec carte crée des litiges et des remboursements pour quelques euros |

**Conséquences chiffrées (estimations)**

- Sur 4,99 €, la commission de paiement estimée par le code est d'environ 0,36 € (1,5 % + 0,25 € + 0,7 %) : il reste environ 4,63 €. Sur le pass à 19,99 €, il reste environ 19,30 €, soit 3,22 € par mois. Taux non vérifiés sur la grille actuelle de Stripe.
- Coût d'IA d'un compte Plus au maximum (30 dossiers) : environ 0,08 USD par mois au prix du code. Même si le vrai prix était dix fois plus haut, on resterait sous 1 €.
- **TVA** : inconnue. Selon le statut de l'éditeur (PUBLIC-03), 20 % peuvent partir du prix affiché.
- **Ordre de grandeur des recettes** : avec 100 inscrits et 2 à 5 % de payants (hypothèse courante pour ce type d'offre, non vérifiée ici), cela fait 2 à 5 clients, soit 10 à 25 € par mois. Le but des premiers mois est d'apprendre, pas de gagner.
- **Blocage réel** : le plafond de 2 USD. Vendre un abonnement en gardant un budget commun de 2 USD, c'est risquer de refuser un dossier à un client qui a payé. C'est une décision du propriétaire, à préparer avec la finance.

- **Constat** : un prix bas et un pass court collent au budget et au calendrier d'un étudiant ; l'IA ne coûte presque rien par dossier, la contrainte est le plafond commun.
- **Preuve ou source** : tableau ci-dessus ; `lib/economics.ts` pour les coûts.
- **Effort** : faible pour choisir, élevé pour vendre (Stripe, conditions de vente, identité de l'éditeur).
- **Effet attendu** : un prix que l'étudiant ne juge pas absurde face au gratuit ; à confirmer par les réponses de l'accès anticipé (section 4).

---

## 3. Le mur

### Ce qu'on montre d'une offre floutée

| Élément | Visible ou flouté | Raison |
| --- | --- | --- |
| Rang dans ton classement (« n° 9 ») | Visible | Montre qu'il y a une suite réelle |
| Score « 7 compétences sur 9 en commun » | Visible | C'est notre calcul, et c'est ce qui donne envie |
| Type de contrat, ville | Visible | Aide à juger sans donner l'offre |
| Titre du poste | Flouté | Sinon le mur ne sert à rien |
| Entreprise | Flouté | Idem |
| Lien vers l'annonce | Absent | Il est dans le catalogue gratuit |

Règles pour ne pas tromper :

1. **Chaque carte floutée est une vraie offre ouverte**, avec son vrai score. Jamais de silhouettes inventées ni de chiffres décoratifs.
2. **Le score reste « compétences en commun »**, jamais une chance d'être pris (règle BIZ-02).
3. **Montrer au plus une dizaine de cartes floutées**, puis une ligne de texte. Un mur de 4 000 cartes grises frustre.
4. **Le bouton gratuit est toujours à côté du bouton payant.** Sinon l'étudiant croit que les offres sont payantes, et c'est le reproche que les sources pourraient faire.
5. **Ne pas appâter avec un classement faux.** Tant que le défaut « Java 17/21 » n'est pas corrigé et MVP-03 pas revu sur trois profils, un « 9 sur 9 » flouté peut être une erreur. Le correctif doit passer avant le mur.
6. **Le flou doit être fait côté serveur.** Aujourd'hui tout compte connecté peut lire la table entière des offres (audit, écart E4) : un flou seulement visuel se contourne en deux minutes. Ce n'est pas grave pour les offres (elles sont gratuites), mais l'ordre du classement, lui, ne doit pas être envoyé au navigateur.
7. **Lecteurs d'écran** : la zone floutée est masquée, donc le texte et les deux boutons doivent tout dire à eux seuls.

### Textes exacts

**Au-dessus de la zone floutée**

> **La suite de ton classement**
> Tu as tes 8 offres du jour. 8 nouvelles arrivent demain, et celles que tu as déjà restent à toi.
> Toutes les offres restent consultables gratuitement dans le catalogue.

- Bouton principal : **« Découvrir LeBonTaf Plus »**
- Bouton secondaire, même taille de texte : **« Explorer tout le catalogue »**

Tant que le classement complet n'est pas dans Plus (garde-fou 2), le bouton principal de cette zone est « Explorer tout le catalogue » et le bouton Plus n'apparaît que sur le mur des dossiers.

**Quand les 2 dossiers gratuits sont utilisés** (c'est ce mur-là qui vendra le plus : l'étudiant vient de voir ce que vaut un dossier)

> **Tes 2 dossiers gratuits du mois sont utilisés**
> Les prochains arrivent le 1er novembre. Tu peux toujours chercher, garder et suivre tes offres.

- Bouton : **« Passer à 30 dossiers par mois »**

**Page de tarifs**

> # Prépare plus de candidatures, plus vite
> LeBonTaf lit ton CV, classe les offres selon tes compétences et prépare un CV et une lettre adaptés à chaque offre. Tu relis, tu corriges, et c'est toi qui envoies.
>
> **Gratuit — 0 €**
> - 8 nouvelles offres recommandées chaque jour
> - Tout le catalogue, avec recherche et filtres
> - 2 dossiers CV + lettre par mois
> - Suivi de tes candidatures
>
> **LeBonTaf Plus — 4,99 € par mois, sans engagement** *(prix à confirmer)*
> - Tout ce qui est gratuit
> - 30 dossiers CV + lettre par mois
> - Analyse détaillée de chaque offre face à ton CV
>
> **Pass semestre — 19,99 € pour 6 mois, un seul paiement** *(prix à confirmer)*
>
> Les offres viennent de sites d'emploi et de pages carrière d'entreprises. Elles restent gratuites à consulter. Plus te fait gagner du temps sur tes dossiers ; il ne garantit ni réponse ni embauche.

Tant que Stripe n'est pas branché, ajouter sous les prix : **« Le paiement n'est pas encore ouvert. »** et le bouton de la section 4.

### Ce qu'il ne faut jamais écrire

| À ne pas écrire | Pourquoi |
| --- | --- |
| « Débloque les offres », « Accède à toutes les offres », « Offres réservées aux membres » | C'est vendre l'accès aux offres |
| « Toutes les offres de France Travail », « partenaire de France Travail », le logo France Travail | Faux, et l'article 9 de la licence interdit le logo sans accord |
| « Offres exclusives », « introuvables ailleurs » | Faux : elles viennent d'autres sites |
| « Décroche ton stage », « garanti », « X % de chances », « tu as le profil » | Promesse d'embauche ; le score ne mesure que des compétences en commun |
| « Illimité » | Faux tant qu'il existe un plafond de budget et des limites par jour |
| « Plus que 3 places », compte à rebours, prix barré | Fausse urgence et faux prix de référence |
| « CV garanti sans erreur », « passe tous les filtres des recruteurs » | Les reformulations doivent être relues ; rien ne le prouve |
| « On postule pour toi » | L'application n'envoie rien (`PREPARE_ONLY`) |
| « Essai gratuit » si une carte est demandée sans le dire | Trompeur |

**Promesse en une phrase**, vraie aujourd'hui : « Dépose ton CV : LeBonTaf te montre chaque jour les offres de stage et d'alternance qui collent à tes compétences, et prépare un CV et une lettre adaptés à celle que tu choisis. » Réserve : « chaque jour 8 offres » ne sera vrai qu'une fois la v1.1 livrée, et « qui collent » suppose MVP-03 validé.

- **Constat** : un mur qui cache des offres gratuites ailleurs fâche l'étudiant et expose aux sources ; un mur qui cache notre tri, avec la sortie gratuite visible, vend sans mentir.
- **Preuve ou source** : spécification v1.1 (décision 5 et point de vigilance sur l'absence de promesse de paiement) ; audit, écart E4 ; BIZ-02.
- **Effort** : moyen (front : zone floutée et textes ; backend : classement tronqué côté serveur).
- **Effet attendu** : des clics sur Plus sans plainte du type « vous faites payer des offres gratuites ».

---

## 4. Tant que Stripe n'est pas branché

| Mécanisme | Inscriptions | Information obtenue | Risque |
| --- | --- | --- | --- |
| « Préviens-moi » (une case à cocher) | Faible | Faible : un clic ne dit ni le prix ni le besoin | Aucun |
| Liste d'attente avec prix affiché et une question | Moyenne | Moyenne : on sait qui clique en voyant le prix | Déception si l'attente dure |
| **Accès anticipé gratuit, limité, contre trois réponses** | **La plus forte** : il y a quelque chose à gagner tout de suite | **La plus forte** : usage réel de Plus et prix déclaré | Coût d'IA et plafond de 2 USD, à borner |

### Recommandation : l'accès anticipé limité

- **Qui** : les 20 premiers étudiants qui le demandent.
- **Quoi** : Plus pendant 30 jours, **10 dossiers** au lieu de 30.
- **En échange**, trois questions obligatoires :
  1. « Tu cherches quoi, et pour quand ? » (stage ou alternance, mois de début)
  2. « À quel prix par mois trouverais-tu Plus trop cher ? Et à quel prix le prendrais-tu sans hésiter ? »
  3. « Qu'est-ce qui t'a le plus aidé, et qu'est-ce qui manque ? » (posée à la fin des 30 jours)
- Une case séparée, non cochée d'avance : « Préviens-moi par e-mail quand le paiement ouvre ».
- **Texte du bouton** : « Demander l'accès anticipé » — sous-texte : « Gratuit pendant 30 jours pour les 20 premiers, contre trois réponses. Aucune carte demandée. »

**Coût estimé** : 20 étudiants × 10 dossiers = 200 dossiers, soit environ 0,56 USD au prix du code, non vérifié. Avec 50 étudiants et 20 dossiers, on dépasserait le plafond de 2 USD : d'où les chiffres 20 et 10.

**Condition technique indispensable** : aujourd'hui, passer un compte en « pro » retire toute limite de dossiers (`lib/plan.ts`). Il faut un plafond pour ces comptes **avant** d'en activer un seul. L'activation reste un geste du propriétaire.

**Ce qu'on mesure**, sans donnée personnelle dans les rapports : combien voient le mur, combien cliquent, combien demandent l'accès, combien de dossiers sont réellement créés, et les prix cités.

**Honnêteté sur la méthode** : avec 4 inscrits, aucun chiffre ne sera une statistique. Vingt réponses donnent une direction, pas une preuve.

- **Constat** : sans paiement possible, le seul moyen d'apprendre quelque chose est de faire utiliser Plus et de poser la question du prix.
- **Preuve ou source** : raisonnement ; aucune donnée propre (4 inscrits).
- **Effort** : faible à moyen (un formulaire, un plafond pour les comptes Plus, une activation à la main).
- **Effet attendu** : 20 utilisateurs réels de Plus, une fourchette de prix déclarée, une liste de personnes à prévenir à l'ouverture du paiement.

---

## 5. Les 100 premiers étudiants

### Cible

Premier client réaliste : **étudiant de bac+2 à bac+5 en informatique ou numérique, qui cherche un stage ou une alternance**, dans la ville et l'école du propriétaire. Raisons : c'est le périmètre où le catalogue est le plus fourni (pages carrière d'entreprises du numérique, CDD informatique), et c'est le seul profil sur lequel le classement a été regardé. Je ne connais ni l'école ni la ville du propriétaire : c'est une question pour lui.

Calendrier : octobre à décembre est la saison des stages qui commencent en début d'année ; la recherche d'alternance monte à partir de janvier. À confirmer par le propriétaire d'après son école.

### Trois canaux peu coûteux

| Canal | Ce qu'on fait | Effort estimé | Attendu (hypothèse) |
| --- | --- | --- | --- |
| 1. La promotion et l'école du propriétaire | Message dans les groupes de promotion, démonstration de dix minutes à des camarades, accès anticipé offert | 3 à 5 heures, 0 € | 20 à 40 inscrits |
| 2. Associations étudiantes (bureau des étudiants, associations de filière) de 3 à 5 écoles | Proposer un atelier « un CV adapté à une offre en dix minutes » et un mois de Plus pour les membres | 10 à 15 heures, 0 € | 30 à 50 inscrits |
| 3. Parrainage dans l'application + courtes démonstrations publiques | « Un ami inscrit qui dépose son CV = 2 dossiers de plus pour toi » ; une vidéo ou un message par semaine montrant un vrai avant/après | Parrainage : petit développement. Contenu : 2 heures par semaine | 20 à 30 inscrits, lent au début |

Coût du parrainage : 2 dossiers, soit environ 0,006 USD estimés par parrainage. C'est la récompense la moins chère possible, et elle fait goûter exactement ce que Plus vend.

**Pourquoi ce modèle aide l'acquisition** : « 8 offres choisies pour toi chaque jour » est une raison de revenir, et un message simple à transmettre. Le gratuit doit rester vraiment utile : c'est lui qui recrute.

**Ce qu'il ne faut pas faire** : acheter de la publicité (interdit sans instruction, et inutile à cette taille) ; écrire à des écoles au nom de LeBonTaf sans accord du propriétaire ; ouvrir à des inconnus avant PUBLIC-06 et MVP-06b (le juge l'a rappelé : 100 utilisateurs n'ont jamais été testés).

**Aucun message n'a été envoyé et aucun contact pris pour ce rapport.**

- **Constat** : les 100 premiers viendront du réseau direct et d'associations, pas d'un canal payant.
- **Preuve ou source** : JobTeaser occupe déjà le canal « école » auprès de 800+ établissements (page officielle) : LeBonTaf doit passer par les étudiants et leurs associations, pas par l'administration.
- **Effort** : 15 à 25 heures du propriétaire sur un mois, 0 €.
- **Effet attendu** : 70 à 120 inscrits (hypothèse), si le classement est jugé bon par les premiers.

---

## 6. Ce qui doit être vrai avant de montrer le mur

Dans cet ordre, pour que la décision du propriétaire rapporte au lieu de coûter :

1. **Correctif « Java 17/21 »** et classement revu sur trois profils (MVP-03). Sinon les 8 offres du jour sont les 8 mauvaises, et l'étudiant part.
2. **Catalogue gratuit toujours accessible** à côté du mur.
3. **Plafond pour les comptes Plus** dans le code.
4. **Retirer « Pro à 7,99 € »** de la page d'administration, et choisir un seul nom.
5. **Avant d'encaisser un euro** : réponse du juriste sur la question Q8, réponse écrite d'Adzuna (Q1), identité de l'éditeur et conditions de vente (PUBLIC-03), décision sur le plafond de 2 USD.

Les points 1 à 4 permettent de montrer le mur et de lancer l'accès anticipé. Le point 5 ne bloque que le paiement.

---

## 7. Questions aux autres agents

**Au critique**

- Un classement personnalisé payant est-il un « service de placement » ? Si oui, le classement complet doit-il rester gratuit pour toujours ?
- Un étudiant paiera-t-il 4,99 € pour des dossiers qu'un assistant IA généraliste gratuit peut écrire ? Qu'apporte LeBonTaf de plus, de façon vérifiable ?
- Le flou risque-t-il de faire fuir les 4 inscrits actuels, habitués à tout voir ?

**À la finance**

- Coût réel d'un dossier d'après les factures (BIZ-10), worker Railway compris.
- Marge à 4,99 € et à 19,99 € par semestre, avec et sans TVA, avec la vraie grille de Stripe.
- Quel plafond de budget permet de servir 20 comptes en accès anticipé, puis 5 clients payants, sans refuser un dossier ?
- Le parrainage à 2 dossiers reste-t-il négligeable à 100 inscrits ?

**À la valorisation**

- Qu'est-ce qui pèse le plus aujourd'hui : 100 inscrits gratuits actifs, ou 5 payants ?
- Vingt réponses sur le prix ont-elles une valeur pour un tiers ?

**Au propriétaire**

- Ton école, ta filière, ta ville : c'est le point de départ de l'acquisition.
- Acceptes-tu que le catalogue reste gratuit à côté du mur ? C'est le cœur de la recommandation.
- Qui est le juriste, et quand peut-on lui poser la question Q8 ?

---

## 8. Propositions à inscrire au registre (statut `proposée`)

Numéros à attribuer par la coordination. Elles prennent acte de la décision du propriétaire du 8 octobre au soir, qui est le fait nouveau par rapport à BIZ-15 et BIZ-16 (proposées en report par le juge).

| Proposition | Effort | Condition |
| --- | --- | --- |
| Plus vend les dossiers et les analyses, jamais l'accès aux offres ; le catalogue reste gratuit à côté du mur | Moyen | Aucune |
| Le classement complet n'entre dans Plus qu'après la réponse à Q8 | Nul d'ici là | Avis du juriste |
| Plafond de 30 dossiers par mois pour les comptes Plus, pas d'« illimité » | Faible | Avant toute activation d'un compte Plus |
| Nom « LeBonTaf Plus » ; retrait de « Pro à 7,99 € » | Faible | Aucune |
| Prix à tester : 4,99 € par mois et 19,99 € le semestre, pas d'annuel, pas d'essai avec carte | Faible | Chiffres de la finance |
| Mur flouté : score, contrat et ville visibles ; titre et entreprise floutés ; classement tronqué côté serveur ; textes de la section 3 | Moyen | Correctif Java et MVP-03 |
| Liste des formules interdites (section 3) | Nul | Aucune |
| Accès anticipé : 20 étudiants, 30 jours, 10 dossiers, trois questions | Faible à moyen | Plafond des comptes Plus |
| Acquisition : promotion du propriétaire, associations, parrainage à 2 dossiers | 15 à 25 heures | Instruction du propriétaire avant tout contact ; PUBLIC-06 et MVP-06b avant des inconnus |
