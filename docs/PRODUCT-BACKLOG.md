# LeBonTaf — MVP et prochaines étapes

Mis à jour le **8 octobre 2026**, à partir des dernières livraisons et vérifications consignées dans le dépôt. Ce fichier est la référence de travail ; le document sur claude.ai ne se synchronise pas automatiquement avec lui.

Pour reprendre avec Codex, Claude ou un autre modèle : lire d’abord le [contexte commun du projet](CONTEXTE-PROJET.md). Il indique l’état récent, les fichiers utiles et la commande de mise à jour Graphify.

**Le cœur du MVP est en ligne. Il reste à terminer les vérifications du parcours étudiant et quelques points de lancement. La capacité pour 100 utilisateurs n’a pas encore été validée par un test de charge.**

## 1. Comment lire ce document

- **Fait** : la fonction décrite est livrée et dispose des contrôles indiqués. Cela ne signifie pas que toutes ses améliorations futures sont terminées.
- **À vérifier** : la fonction est livrée, mais son parcours complet en production reste à confirmer.
- **À terminer** : il reste une action de développement, de configuration ou une décision du propriétaire.

Les cases **[x]** ci-dessous indiquent une fonctionnalité déjà livrée, y compris celles cochées dans le backlog transmis par Claude. Les cases **[ ]** indiquent une action restante. Une fonctionnalité peut être cochée comme livrée et avoir un test de production encore ouvert : ce sont deux actions différentes. Les contrôles historiques de Claude sont conservés comme tels ; ils ne sont pas tous présentés comme retestés aujourd’hui.

Il n’y a plus deux listes « P0/P1/P2 » et « Sprint 1/2/3 ». Les priorités indiquaient l’urgence ; les sprints racontaient les étapes de livraison. Désormais, les tâches restantes apparaissent **une seule fois**, dans l’ordre : finir le pilote, préparer l’ouverture publique, améliorer ensuite. Les numéros servent uniquement à retrouver une tâche.

## 2. Tableau du MVP — état actuel

| Composant | État | Ce qui fonctionne aujourd’hui | Ce qui reste |
| --- | --- | --- | --- |
| Connexion et comptes | Fait | Connexion, Google et demande de réinitialisation ; SMTP personnalisé Resend activé. Parcours complet vérifié en production le 7 octobre : expéditeur, e-mails français, lien et nouveau mot de passe OK ; message clair si l'adresse a déjà un compte. | — |
| Import du CV | À vérifier | PDF numérique lu localement, structuration via Gateway, brouillon à confirmer ; tests automatiques réussis. | Import dans Chrome puis confirmation du profil : MVP-01. PDF scannés non pris en charge. |
| Catalogue d’offres | Fait | Catalogue partagé, collecte planifiée, dédoublonnage, stages présents, embeddings et résumés calculés en production. | Surveillance du renouvellement : MVP-04 ; attribution Adzuna : PUBLIC-02. |
| Recherche et filtres | Fait | Ville, date, télétravail explicite ; jusqu’à dix recherches nommées par compte. Enregistrement et réapplication vérifiés en production. | Filtres supplémentaires et alertes : SUITE-05. |
| Classement selon le CV | À vérifier | Comparaison des compétences sans LLM ; classement vectoriel Perplexity. Premier contrôle SQL avec le profil réel effectué. | Vérifier le parcours connecté et plusieurs profils : MVP-03. |
| CV et lettre adaptés | À vérifier | Sélection des preuves du profil confirmé, CV + lettre en un appel, documents sauvegardés et réutilisés. Un kit réel et ses deux PDF ont été contrôlés. | Refaire le parcours après un nouvel import et relire les faits : MVP-01. |
| Suivi des candidatures | À vérifier | Parcours de chaque offre, « Mon suivi », notes, rappels et documents en ligne. Le Sprint 6 est déjà déployé. | Vérifier toutes les transitions avec un compte connecté : MVP-05. |
| Design LeBonTaf | Fait | Identité visuelle, thèmes clair/sombre et interface mobile livrés ; contrôles à 390 et 1 440 px. | Le tableau d’enquête interactif est une amélioration : SUITE-09. |
| Sécurité et limites | À terminer | Isolation des comptes, quotas, réservations des traitements payants ; compteur indisponible = appel refusé. | Décider de la protection des mots de passe divulgués : PUBLIC-01 ; test pilote : MVP-06 ; réserves de l’audit du 7 octobre : PUBLIC-06. La réservation des kits dépend de `AI_GENERATION_LEASES=1`, non confirmé : REVUE-02. |
| Coûts IA maîtrisés | À vérifier | Catalogue réutilisé, suivi des coûts, alerte administrateur, deux kits gratuits par mois et plafond Gateway configuré à 2 USD. Depuis le 8 octobre : plafond journalier des révisions IA. | L’audit du 7 octobre n’a pas pu comparer les coûts de l’admin aux factures réelles ; l’alerte est un bandeau, le seul plafond réel est celui de la clé Gateway. Limite des lectures répétées en attente de migration : REVUE-03. Comportement aux limites : MVP-06. |
| Pages légales et données personnelles | Fait | Pages présentes et fonctions d’export/suppression livrées. Cela ne constitue pas une validation juridique. | Identité de l’éditeur et modèle de facturation : PUBLIC-03. |
| Tests et mise en ligne | Fait | CI et production livrées. Livraison du 7 octobre : 181 tests réussis, 42 assertions PostgreSQL/pgvector, compilation réussie, un test LaTeX ignoré. Au 8 octobre (commit `b844becd`) : 269 tests, 268 réussis, un LaTeX ignoré ; les assertions PostgreSQL n’ont pas été relancées. | Validation des parcours et de la charge : MVP-01 à MVP-06. |

**Pourquoi certaines lignes restent « à vérifier » :** un test automatique ou un déploiement réussi ne remplace pas la vérification du parcours complet d’un étudiant sur le site.

### Fonctionnalités déjà livrées — cases cochées

Cette liste reprend les fonctionnalités cochées dans l’ancien backlog, regroupées par sujet, ainsi que les dernières livraisons. Les anciens noms de modèles et blocages remplacés ont été actualisés. Les actions encore ouvertes restent dans les sections suivantes.

**Comptes, profil et données**

- [x] Comptes et accès limité aux données de son propre compte.
- [x] Connexion Google et lien magique par e-mail ; application Google publiée en production.
- [x] SMTP personnalisé Resend activé dans Supabase ; parcours e-mail vérifié en production le 7 octobre (MVP-02).
- [x] Import d’un CV PDF numérique, conservation du profil et proposition des catégories depuis le CV.
- [x] Extraction locale du PDF puis structuration via Gateway ; brouillon à confirmer, PDF scannés refusés explicitement.
- [x] Profil et expériences utilisables comme preuves pour adapter les documents.
- [x] Export des données et suppression du compte depuis les réglages.
- [x] Sauvegarde de la base avant les changements de structure, consignée dans le backlog historique.

**Sources et catalogue commun**

- [x] Connexion aux sources France Travail, JSearch, Adzuna et Jooble ; clés configurables depuis les réglages.
- [x] Lecture des pages carrière Greenhouse, Lever, Ashby, SmartRecruiters, Workable et Recruitee.
- [x] Découverte d’entreprises depuis les liens des offres.
- [x] Connecteur La bonne alternance préparé mais désactivé ; activation et conditions restent dans PLUS-03.
- [x] Première revue des conditions des sources consignée par Claude ; confirmation avant ouverture publique dans PUBLIC-02.
- [x] Catalogue commun, cache partagé des recherches et réutilisation des offres pour les nouveaux comptes.
- [x] Dédoublonnage par liens, empreinte et texte proche ; repérage « déjà postulé ailleurs ».
- [x] Mise à l’écart des offres suspectes avant dépense IA et lecture du texte complet des annonces.
- [x] Catégories reliées aux métiers ROME et aux termes de recherche ; classement des offres par catégorie et contrat.
- [x] Collecte France Travail par métier et département, pages carrière et grandes villes Adzuna.
- [x] Collecte commune à 6 h et 14 h, exécutée par tranches avec reprise ; première collecte réelle contrôlée.
- [x] Catégories proposées à l’étudiant, nombres d’offres et recherche « autre métier » ; catégories déjà couvertes réutilisées.
- [x] Reconnaissance des villes de banlieue ; reclassement des anciennes offres lors de la collecte.
- [x] Fermeture des offres retirées des tableaux carrière et expiration des offres anciennes.
- [x] Signalement « offre plus disponible ? », filtre des offres indisponibles et blocage des traitements sur une offre retirée.
- [x] Contrôle partagé HTTP/API avant rédaction, sans LLM ; erreurs réseau conservées comme disponibilité inconnue.
- [x] Attribution France Travail et lien « Jobs by Adzuna » ; logo officiel restant dans PUBLIC-02.
- [x] Fermeture des offres France Travail retirées et effacement du texte dans le catalogue et les listes des comptes.
- [x] Recherche planifiée sur le serveur et worker Railway consignés dans les livraisons historiques.
- [x] Santé des sources, progression de collecte et bouton administrateur « avancer la collecte ».
- [x] Données France Travail sur le marché et l’accès à l’emploi intégrées, selon le backlog transmis.

**Recherche, classement et IA**

- [x] Activation de pgvector et embeddings partagés des offres ; production passée à Perplexity, 1 024 dimensions.
- [x] Embeddings des profils et offres dans le même espace versionné ; cache et invalidation lorsque le contenu change.
- [x] Classement selon le profil et comparaison des compétences sans appel LLM obligatoire par offre.
- [x] Explications standard des compétences communes/manquantes ; conseil IA approfondi facultatif et limité.
- [x] Résumé « En bref » et lecture structurée partagés entre étudiants, actuellement avec Qwen.
- [x] Filtres par catégorie et contrat, ville, date de publication et télétravail explicite.
- [x] Jusqu’à dix recherches nommées par compte ; sauvegarde et réapplication vérifiées en production.
- [x] Comparatif des modèles texte, embeddings et RAG effectué ; rapports et limites conservés.
- [x] Gateway activé avec une clé durable et modèles configurés par tâche.

**CV, lettres et candidatures**

- [x] Sélection des preuves du profil confirmé pour le CV et la lettre adaptés (RAG).
- [x] Un appel pour créer le kit CV + lettre, sauvegarde des versions et réouverture sans nouvelle génération.
- [x] Documents PDF/LaTeX et modification par une consigne ; comparaison visuelle des versions restant dans SUITE-06.
- [x] Questions des formulaires mémorisées et réutilisées.
- [x] Parcours enregistré pour chaque offre : nouvelle, vue, dossier prêt, envoyée, entretien, réponse, écartée.
- [x] Cartes d’offres avec informations essentielles, étape, documents prêts et pastille « nouvelle ».
- [x] Salaire repris des sources lorsqu’il est disponible ; compteur anonyme d’étudiants suivant une offre à partir de trois.
- [x] Panneau de l’offre : résumé, informations clés, frise, journal daté, CV/lettre et notes libres.
- [x] « Mon suivi » en colonnes, onglets mobiles et changement d’étape ; écarter/restaurer une offre.
- [x] Confirmation « as-tu envoyé ta candidature ? » et badge de candidature envoyée.
- [x] Rappels pour dossier prêt depuis trois jours, relance après sept jours et entretien à venir.
- [x] Accueil « à faire aujourd’hui » alimenté par les étapes des candidatures.
- [x] Deux kits gratuits par mois, compteur et refus à la limite ; la recherche automatique ne consomme pas ces kits.

**Design, administration et mise en ligne**

- [x] Maquette validée et identité LeBonTaf : logo animé, entrée animée, thèmes clair/sombre et interface mobile.
- [x] Accueil, connexion, pages légales et espace étudiant publiés ; domaine lebontaf.com relié à Vercel, Supabase et Google.
- [x] Navigation simplifiée : Accueil, Offres, Mon suivi, Réglages ; documents et questions accessibles depuis les dossiers.
- [x] Page Feuille de route et indications des fonctionnalités à venir.
- [x] Confidentialité, mentions légales et conditions d’utilisation présentes.
- [x] Espace admin séparé : utilisateurs, activité, catalogue, coûts par compte et par jour.
- [x] Niveaux de lancement 100/1 000/8 000 et prévisions dans l’admin ; les montants historiques restent des estimations à revoir.
- [x] Alertes administrateur, suivi des coûts fournisseur et plafond Gateway configuré à 2 USD.
- [x] Réservations des embeddings, lectures et kits pour éviter les traitements payants concurrents.
- [x] Quotas fermés lorsque le compteur est indisponible ; fonctions sensibles réservées au serveur.
- [x] Limites de requêtes, en-têtes de sécurité et politique CSP avec nonces.
- [x] Erreurs des sources visibles sans bloquer toutes les autres sources.
- [x] CI GitHub, tests, compilation, migrations et mise en production des dernières livraisons.
- [x] Contrôles de la livraison du 7 octobre : 181 tests réussis, 42 assertions PostgreSQL/pgvector et interface vérifiée à 390/1 440 px.

## 3. À faire maintenant — terminer le pilote

Ces six tâches constituent la prochaine liste de travail. Elles ne demandent pas de refaire les fonctions déjà livrées.

- [ ] **MVP-01 — Importer un PDF numérique de test dans Chrome, confirmer le profil, créer un kit CV/lettre et le rouvrir.** (À vérifier). Les faits correspondent au profil confirmé, les deux PDF sont lisibles et la réouverture ne relance pas la génération. Ne pas remplacer le vrai profil par un profil fictif. Dernier essai bloqué par la permission de fichiers de l’extension Chrome. **8 octobre, en production, par la session de coordination dans le navigateur du propriétaire et avec son accord : première moitié faite.** Le PDF fourni par le propriétaire a été déposé (le blocage de permission est levé), le brouillon affiché correspondait au PDF ligne à ligne (1 expérience, 2 formations, 4 projets, 31 compétences, aucun fait ajouté ; langues et certifications non affichées dans le brouillon), puis le profil a été enregistré et l’écran indique « mis à jour à l’instant ». **Reste à faire : créer un dossier CV + lettre, relire les faits, ouvrir les deux PDF et rouvrir le dossier sans nouvelle génération.** Remarques pour le front : le brouillon reste affiché sous la carte après l’enregistrement ; la section « Ton compte » montre une adresse différente de celle du menu latéral (à expliquer).
- [x] **MVP-02 — Tester connexion et réinitialisation jusqu’au changement du mot de passe ; vérifier l’expéditeur des e-mails et les modèles français.** (Vérifié le 7 octobre 2026, en production sur lebontaf.com, par le propriétaire avec la session frontend) : e-mail reçu depuis l’expéditeur attendu, modèle en français, lien ouvert directement la page « Nouveau mot de passe », nouveau mot de passe accepté et reconnexion OK. Le parcours inclut aussi les correctifs du jour (commits f2279ba5, 8bf9aeba, 32c45659) : message clair « Un compte existe déjà avec cette adresse » à l’inscription, indication « Continuer avec Google » et passage par « Mot de passe oublié » pour choisir un mot de passe sur un compte créé via Google. SMTP Resend non recréé.
- [ ] **MVP-03 — Tester le classement connecté avec plusieurs profils et critères explicites.** (À vérifier). Contrat, localisation et incompatibilités sont correctement pris en compte ; compétences communes/manquantes compréhensibles. La proximité vectorielle n’est pas présentée comme une probabilité d’embauche. **Essai du 7 octobre : non validé.** Captures du propriétaire : scores de 17/100 et 8/100 sur des offres IA, tag « Très proche de ton CV » à côté d’un score bas, pourcentage « sens proche à X % » calculé avec la formule de l’ancien modèle. Correctifs livrés, pas encore revus à l’écran : libellés (`3759f194`), calcul sans qualités personnelles et avec alias sûrs (`6b19a6dc`), compétences du profil resynchronisées (`7729657e`). Reste à faire : revue du propriétaire sur la même offre, vérifier que son profil contient ses compétences IA, décider de l’exécution de `tools/sql/renormalize-skills.sql` (non exécuté). **Second essai du propriétaire le 8 octobre : toujours non validé.** Une offre à 17/100 portait « Dans le top 25 de ton CV » à côté d’une offre à 42/100 sans ce tag : deux mesures différentes affichées côte à côte. Décision (ordre BIZ-02 accepté) : une seule grandeur par écran, « compétences en commun », jamais présentée comme une chance d’être retenu. Livré, à revoir à l’écran : tag retiré, onglet renommé « Mieux notées pour mon CV » et rangé par le chiffre affiché (`43c9a620`), listes et tri sur le seul score gratuit, analyse IA seulement dans le panneau (`05f0827c`).
- [ ] **MVP-04 — Contrôler une collecte complète et le traitement des nouvelles offres ; vérifier le retrait d’une offre dans les différents parcours.** (À vérifier). La file progresse, les erreurs et textes insuffisants sont visibles, un retrait confirmé empêche la génération. Les offres inchangées ne sont pas relues ou vectorisées à chaque recherche. **Préparation du 7 octobre (lecture du code, rien vérifié en production)** : voir `docs/audits/preparation-mvp-04-2026-10-07.md`, qui contient un protocole de contrôle par requêtes de lecture. La planification de la collecte n’est pas dans le dépôt (`vercel.json` ne planifie que `/api/cron/tick`, une fois par jour) : le propriétaire doit lire `cron.job` dans Supabase. Correctifs livrés, à vérifier : le catalogue commun a le dernier mot sur une offre fermée (`23951a65`, `6ba5c5e0`).
- [ ] **MVP-05 — Parcourir « nouvelle → vue → dossier prêt → envoyée → entretien → réponse », puis écarter/restaurer une offre et vérifier les rappels.** (À vérifier). Statuts et documents conservés après rechargement, parcours utilisable sur mobile. « Envoyée » dépend de la confirmation de l’étudiant ; aucune candidature automatique. **Essai du 8 octobre en production, sur le compte administrateur du propriétaire, à 1 536 px (`docs/audits/mvp-05-suivi-2026-10-08.md`) : réussi en partie, case non cochée.** Réussi : toute la chaîne des statuts avec retour en arrière, conservation après rechargement, écarter puis restaurer, rappel d’entretien, aucun envoi réel. Non vérifié : largeur mobile (l’outil n’a pas pu réduire la fenêtre), rappel de relance à 7 jours, les deux PDF non ouverts, compte étudiant ordinaire. Défauts à corriger côté front : messages de confirmation cachés sous la fiche ouverte (D1), date d’entretien qui reste après un retour en arrière (D2), offres écartées difficiles à retrouver et message « elle ne reviendra plus » (D3), mentions « Bientôt · sprint 4/5 » visibles par l’étudiant (D4). Traces laissées par l’essai sur le compte du propriétaire : une date d’entretien fictive (11 octobre, 10 h) sur l’offre Alan, et l’offre L2C passée de « Nouvelle » à « À préparer ».
- [ ] **MVP-06 — Tester le pilote avec plusieurs comptes, appels concurrents, limites atteintes et charge représentative de 100 utilisateurs.** (À vérifier). Aucun accès aux données d’un autre compte, aucun double traitement payant, quotas respectés et message clair quand le budget est épuisé ; temps de réponse mesurés. Distinguer 100 inscrits de 100 utilisateurs simultanés. **Audit statique du 7 octobre** (`docs/audits/securite-couts-2026-10-07.md`) : aucune fuite entre comptes trouvée à la lecture, mais rien n’est prouvé en conditions réelles ; avis de l’audit : acceptable en pilote fermé avec des personnes de confiance, pas pour un pilote ouvert. Aucun test de charge n’a été fait.

### Travaux des 7 et 8 octobre — livrés en code, pas encore vérifiés en production

Aucune case ci-dessous n’est cochée : un correctif poussé et testé automatiquement n’est pas un parcours vérifié sur le site. Détail et preuves dans `docs/audits/` (cinq rapports datés du 7 octobre).

- [x] **REVUE-01 — Revue visuelle du propriétaire sur lebontaf.com.** (Le 8 octobre, le propriétaire répond « oui c’est bon » pour son compte ; le compte sans CV n’a pas été cité. Il ajoute une demande à clarifier avant tout travail : n’afficher que 8 cartes d’offres, le reste étant pour un utilisateur Pro — cela recoupe la spécification v1.1 en pause. Constaté le même jour par la coordination sur son compte : onglet « Mieux notées pour mon CV » rangé par le chiffre affiché, de 67 à 33, sans tag contradictoire ; panneau d’offre « 8 sur 12 compétences demandées figurent dans ton CV ». MVP-03 reste ouvert : un seul profil vu.) Avec un compte sans CV : carte « Commence par ton CV », encart « Choisis au moins un métier », écran Offres vide, bouton « Importer mon CV d’abord » dans une offre. Avec un compte qui a un CV : « Catalogue vérifié… », offres de toute la France sans ville, « Demander une modification », message quand les deux dossiers du mois sont utilisés. Avec le compte administrateur : bloc de recherche et actions Drive toujours présents. À revoir aussi depuis le 8 octobre : plus de tag « top 25 », un 42 rangé avant un 17 dans « Mieux notées pour mon CV », la carte « Ton CV » qui montre le fichier importé, et la fin de recherche d’un compte sans métier. Couvre les recommandations R1, R3 à R7, R9 à R14 de `docs/audits/parcours-client-2026-10-07.md` et F1 à F3 de la préparation MVP-04.
- [x] **REVUE-02 — Réglages de production à confirmer par le propriétaire.** (Lu le 8 octobre par la coordination dans les tableaux de bord du propriétaire, en lecture seule. Vercel, projet `job-hunter-control` : `AI_GENERATION_LEASES` = 1 et `AI_READER_LEASES` = 1 ; aucune variable de projet dont le nom contient DEMO, SCAN, MAIL ou STUDENT (onglet des variables partagées non regardé) ; `AI_PROVIDER`, `EMBEDDING_PROVIDER`, `AI_MODEL_*`, `AI_GATEWAY_API_KEY` et les variables Google Drive présents, valeurs non lues. Supabase : une tâche `job-hunter-harvest`, toutes les 10 minutes, active, dernier passage 19 h 30 « Succeeded » — cela prouve l’envoi de la requête, pas la réponse du site ; la colonne commande n’a pas été lue. Page d’administration : 4 129 offres ouvertes, 645 nouvelles par jour, 4 127 résumées, 1 793 vectorisées. BIZ-01 est donc tenu. `STUDENT_CATALOGUE_ONLY=1` n’est **pas** posé : le propriétaire l’a demandé, l’outil de la session a refusé l’écriture dans Vercel, il doit l’ajouter lui-même puis redéployer.) Dans Vercel : `AI_GENERATION_LEASES=1` et `AI_READER_LEASES=1` (sans la première, la réservation des kits n’existe pas), absence de `DEMO_MODE`, fournisseur d’IA réellement actif (`AI_PROVIDER`, `EMBEDDING_PROVIDER`), présence ou non des variables Google Drive. Dans Supabase : `select jobname, schedule, active from cron.job;` sans la colonne `command`. C’est aussi l’ordre BIZ-01 : tant que la collecte n’est pas prouvée, l’interrupteur `STUDENT_CATALOGUE_ONLY` reste éteint. Déclaré par le propriétaire le 8 octobre, sans contrôle : pas de variable Gmail en production ; l’étape 1 de `tools/sql/remove-alert-offers-from-catalogue.sql` (lecture seule) le confirmerait. La présence de `SCAN_WEBHOOK_URL` n’a pas été demandée.
- [ ] **REVUE-03 — Trois migrations préparées, non appliquées.** `20261008090000_revision_quota_kind`, `20261008100000_offer_reader_attempts`, `20261008110000_ai_usage_nonnegative`. Le code fonctionne avant et après. Le SQL a été relu contre les fonctions actuelles mais jamais exécuté : à tester sur une copie de la base avant la production. Marche à suivre : `docs/MIGRATIONS-EN-ATTENTE-2026-10-08.md`. Décision du propriétaire.

Livré en code pendant ces deux jours (commits sur `main`) :

- Parcours du nouvel étudiant : CV d’abord, aucune recherche tant qu’aucun métier n’est choisi, zone vide = toute la France (`bd790bd4`, `b4a57ca5`, `879db465`, `db2633ed`).
- Écrans étudiants sans détails de plateforme : actions Drive et messages techniques réservés à l’administrateur, textes publics alignés sur l’offre gratuite (`3e62fc74`, `7db66915`, `ca72acc8`, `649503de`, `133f7b66`, `1c918d45`, `a09458f7`).
- Mise à jour de la liste depuis le catalogue commun à l’ouverture, sans appel aux sites d’emploi ni à l’IA (`182dfa00`, `4b26e368`). La collecte qui alimente le catalogue reste à confirmer (REVUE-02) ; le bouton « Mettre à jour mes offres » est conservé.
- Sécurité et budget : route Drive réservée à l’administrateur (`f94cf85d`), réponse `PROFILE_REQUIRED` sans CV (`99e15f8f`), plafond de 15 révisions IA par jour et par compte, valeur à valider par le propriétaire (`53a405cc`), garde contre le double clic sur la création d’un dossier (`8f234491`), identité du propriétaire retirée des valeurs par défaut des PDF (`0c8acdf4`), limite d’essais de lecture et coûts non négatifs préparés (`8c4a9149`).
- Remarques du propriétaire du 8 octobre : CV enregistré visible à l’accueil et dans Réglages, avec le fichier, la date et ce qui a été lu (`7f641ad3`) ; fin de recherche d’un compte sans métier choisi (`83e70c17`).
- Recherche par compte : pour tout compte non administrateur, la boîte d’alertes de l’opérateur, le webhook externe et les entreprises apprises du catalogue ne sont plus lus (`4ad7d13a`) ; les offres d’alerte ne rejoignent plus le catalogue commun (`dcd53805`). Les sites d’emploi restent appelés par la recherche d’un étudiant tant que `STUDENT_CATALOGUE_ONLY=1` n’est pas posé dans Vercel (ordre BIZ-04, accepté dans son principe, éteint). Estimation d’après le code, non mesurée : JSearch et Jooble ne sont alimentés que par ces recherches, et dix comptes aux requêtes toutes différentes épuiseraient leurs budgets en deux jours.

- Soir du 8 octobre, livré en code, à revoir à l’écran : une compétence écrite avec sa version (« Java 17/21 », « Python 3.12 ») correspond à son nom simple, sans confondre les normes et niveaux (« ISO 27001 » ≠ « ISO 9001 ») (`38f261db`, `cca66547`) ; le brouillon du CV se ferme dès que le profil est enregistré (`ba7293d3`) ; même adresse de compte dans le menu et dans Réglages (`f3e90c28`).
- Page d’administration, demande du propriétaire du 8 octobre (« chaque centime réel, pas estimé », voir et gérer les comptes et les paramètres). Audit : `docs/audits/admin-couts-reels-et-acces-2026-10-08.md`. Avis du juge : `docs/business/jugement-2026-10-08-admin-et-limite-8.md` (ordres BIZ-08 à BIZ-17, au statut « proposée »). Livré côté serveur, en lecture seule et sans migration : chaque montant porte son origine — mesuré, estimé, hypothèse (`b9d44626`) ; solde réel de la clé AI Gateway lu chez Vercel et écart avec ce que l’application a enregistré (`ba286ac1`) ; liste des comptes (`229f1ca8`). L’affichage dans la page est en cours côté front. **Non livré, et à ne pas présenter comme tel** : modification des quotas, des comptes, des rôles ou des paramètres depuis la page (demande une migration et un journal des changements) ; dépenses Vercel, Supabase, Railway et nom de domaine (pas de lecture automatique : saisie ou captures du propriétaire) ; le plafond de 2 USD de la clé n’est lisible par aucune API.
- **Sélection quotidienne, flou et formule payante — décision du propriétaire du 8 octobre au soir : à faire maintenant** (il passe outre le premier avis du juge ; la pause de la spécification v1.1 est levée pour ses décisions 2 à 5, pas pour l’onboarding bloquant ni l’écran ville + consigne). Rapports : `docs/business/commercial-…`, `finance-…`, `critique-2026-10-08-formule-payante.md` ; plan retenu : `docs/business/jugement-2026-10-08-formule-payante.md` (ordres BIZ-18 à BIZ-28, « proposée »). En cours, rien de livré : **étape (i)** jusqu’à 8 offres déverrouillées par jour selon un seuil de qualité, celles déjà présentes restent, création de dossier refusée par le serveur sur une offre hors sélection, silhouettes sans donnée réelle, catalogue entier consultable et gratuit, aucun prix à l’écran ; demande une migration (`offer_unlocks`) à appliquer par le propriétaire, le site fonctionne comme avant tant qu’elle ne l’est pas. **Étape (ii)** page de tarifs « LeBonTaf Plus » (7,99 € pour 30 jours, 34,99 € pour 6 mois, 30 dossiers par mois, jamais « illimité », ne donne accès à aucune offre de plus) préparée derrière un interrupteur éteint : l’hébergement Vercel Hobby interdit tout usage commercial, l’allumer suppose l’achat de Vercel Pro par le propriétaire. **Étape (iii)** encaissement : non commencé ; exige une entreprise immatriculée, l’avis d’un juriste sur les licences des sources, des conditions de vente, Stripe. Tous les coûts des rapports sont des estimations.
- **Version finale demandée par le propriétaire le 9 octobre** (ses mots : tarifs visibles, nettoyage des pages de sprints, inscription guidée avec CV puis critères, compte gratuit sans les offres au-delà de sa sélection). Cela remplace trois points du plan du juge : la page de tarifs est affichée par défaut (éteignable par `PRICING_PAGE=0`) alors que l’hébergement Vercel Hobby interdit l’usage commercial — risque accepté par le propriétaire, levé par l’achat de Vercel Pro ; le compte gratuit ne voit plus que sa sélection (l’avis du juge et du critique était de laisser le catalogue ouvert, à cause des licences France Travail et Adzuna) ; l’onboarding bloquant de la spécification v1.1 est repris. **Non décidé : ce que voit un compte payant** (codé comme le gratuit en attendant ; s’il voit plus d’offres, c’est la vente d’accès que les sources interdisent). Livré côté écran, non vérifié à l’écran : garde de changement de compte (`ae8687cf`), vue « Pour toi » et silhouettes (`3fe99a6a`), messages de la fiche (`57e255bc`). En cours côté front : sélection seule pour le gratuit, page `/tarifs`, retrait de « Feuille de route », des mentions de sprint, de « Mes réponses » pour l’étudiant et des points/rangs de l’admin, puis inscription guidée. **Côté serveur rien n’est codé** : la session backend attend l’accord du propriétaire dans sa propre fenêtre. Tant que ce n’est pas fait, la limite n’existe qu’à l’écran. Plan serveur approuvé : déblocage porté par l’offre et copie dans la liste du compte au moment du déblocage, refus 403 de créer un dossier hors sélection, compteur de dossiers tenu par le serveur, plafonds mensuels de la formule payante, `GET /api/onboarding/status`. Conditions de mise en service : `STUDENT_CATALOGUE_ONLY=1` posé avant d’appliquer la migration (sinon la recherche du compte contourne la limite), migration testée sur une copie. Limite connue et acceptée pour le pilote : le catalogue reste lisible par tout compte connecté qui interroge l’API ; c’est « difficile à voir dans l’application », pas « protégé ».
- Changement de compte dans un même navigateur (constaté le 8 octobre) : l’onglet ouvert gardait l’ancienne adresse dans le menu mais lisait et écrivait dans le nouveau compte ; le CV du test MVP-01 et l’essai MVP-05 ont ainsi porté sur le compte administrateur. Analyse du backend : pas de fuite entre comptes trouvée dans le code (cookies communs aux fenêtres), à confirmer par le propriétaire ; correctif en cours côté front (rechargement dès que le compte change). Cas « un navigateur, deux comptes » à ajouter à MVP-06.
- Vectorisation du catalogue : le chiffre « 1 793 sur 4 129 » comptait l’ancienne colonne. Depuis `b2222702`, la page d’administration compte la colonne réellement utilisée : lu en production le 8 octobre au soir, 4 129 vectorisées sur 4 129 offres ouvertes. Chaque collecte enregistre désormais ce qu’elle a lu et vectorisé (`select id, counters->'ai' from public.harvest_runs order by id desc limit 5;`). Aucun rattrapage n’a été nécessaire ni lancé.

Avis et décisions « business » : `docs/business/REGISTRE-DECISIONS.md`. Le 8 octobre, le propriétaire a accepté BIZ-01 à BIZ-05 et reporté BIZ-06 (file des métiers non couverts, après MVP-06) et BIZ-07 (score combiné, après le pilote). Ces agents conseillent et n’écrivent que dans `docs/business/`.

Vu en production le 8 octobre, à trier (aucun travail lancé) : la page d’administration affiche encore des textes périmés (Gemini, script de déploiement, « Pro à 7,99 € » alors qu’aucun tarif n’est adopté) ; moins de la moitié du catalogue est vectorisée ; une offre « Développeur Java junior » notée 0/100 pour un profil qui contient « Java 17/21 » (alias à vérifier) ; des libellés de contrat incohérents avec le titre (« Alternance » marquée « Stage » ou « Freelance »).

Reporté, à ne pas démarrer sans décision : protection en base des colonnes de `jobs` que l’étudiant peut modifier (il faut d’abord déplacer les écritures du serveur vers le client de service) ; fermeture d’une offre pour tous après dix signalements ; noms de fichier avec accents ; ville de recherche préremplie depuis le CV ; écran administrateur des offres illisibles ; constats M1, M2, M5 à M8 et F1 à F13 de l’audit sécurité ; recommandations R8, R15 à R20, R22 et R25 de la revue du parcours ; prise en charge par la collecte des métiers et mots-clés demandés mais non couverts (BIZ-06, sans migration d’après l’étude du backend) ; nettoyage d’éventuelles offres d’alerte déjà au catalogue (`tools/sql/remove-alert-offers-from-catalogue.sql`, non exécuté, probablement sans objet).

Décision produit datée : à l’inscription, l’application dit clairement qu’un compte existe déjà avec l’adresse saisie (clarté préférée à la protection contre l’énumération des comptes, 7 octobre, `f2279ba5`). À revoir avant l’ouverture publique.

## 4. Avant l’ouverture publique ou la facturation

- [ ] **PUBLIC-01 — Traiter la protection des mots de passe divulgués et vérifier la désactivation de l’ancien secret client Google.** (À terminer). La protection Supabase est désactivée ; l’interface actuelle la réserve au forfait Pro. Décision du propriétaire avant tout abonnement. Ne pas marquer cette protection « faite » sur Free.
- [ ] **PUBLIC-02 — Ajouter le logo officiel Adzuna et vérifier les attributions et conditions d’utilisation des sources, notamment Adzuna et Jooble.** (À terminer). Conserver « Jobs by Adzuna » ; confirmer les exigences applicables avant diffusion publique/commerciale. Les affirmations juridiques de l’ancien backlog restent à vérifier. **Lecture des conditions officielles le 7 octobre** (`docs/audits/public-02-attributions-sources-2026-10-07.md`, sans avis juridique) : six écarts élevés à trancher par le propriétaire, et par un juriste pour le fond. France Travail : contenu complet de chaque offre à afficher, traitement après retrait, description des modifications, catalogue lisible par tout compte connecté. Adzuna : mention d’au moins 116 × 23 px sur chaque annonce ; environ 3 300 appels par mois estimés d’après le code pour une limite de 2 500, consommation réelle non vérifiée. Dix-huit questions restent sans réponse certaine. Ne pas ajouter le logo France Travail sans accord exprès.
- [ ] **PUBLIC-03 — Valider le modèle de facturation et renseigner l’identité réelle de l’éditeur dans les pages légales.** (À terminer). Conseil juridique et situation de l’entreprise à confirmer avant de facturer. Aucun tarif ou modèle payant n’est adopté par ce document.
- [ ] **PUBLIC-04 — Finaliser l’accueil du premier utilisateur, la marque Google et le contact.** (À terminer). Vérifier Search Console/logo/nom LeBonTaf et la redirection contact@lebontaf.com ; support@lebontaf.com existe déjà dans les pages.
- [ ] **PUBLIC-05 — Réécrire la page de confidentialité et corriger les conditions d’utilisation.** (À terminer, décision du propriétaire). La page dit que le CV part « à l’API Gemini de Google » sur une offre gratuite et conseille de ne pas importer de CV pendant la phase de test, alors que le code peut passer par AI Gateway (modèles Alibaba, OpenAI, Perplexity) ; Resend, le Gateway et Overleaf ne sont pas cités ; « aucune donnée » envoyée aux sites d’emploi est inexact (mots-clés et ville) ; l’historique de recherche survit à la suppression du compte, sans identifiant. Les conditions oublient la connexion par mot de passe et parlent de limites « par jour ». Base factuelle : `docs/audits/destinataires-donnees-2026-10-07.md` ; ce que le dépôt ne prouve pas y est listé pour vérification. Aucun avis juridique n’a été donné. Recommandations R23 et R24.
- [ ] **PUBLIC-06 — Lever les réserves de l’audit sécurité avant d’ouvrir à des inconnus.** (À terminer). Appliquer ou écarter les trois migrations (REVUE-03), confirmer les réglages de production (REVUE-02), puis traiter ou accepter par écrit les constats reportés : colonnes de `jobs` modifiables par l’étudiant, comptage des deux dossiers par mois sur une table que l’étudiant peut écrire, worker ouvert à tout compte, coûts de l’admin non comparés aux factures réelles.

## 5. Après le pilote — améliorations conservées

Toutes ces tâches restent ouvertes. Elles ne bloquent pas, à elles seules, la vérification du cœur du MVP.

- [ ] **SUITE-01 — Lecture structurée des offres.** Ajouter durée, rythme, dates et salaire lorsqu’ils sont présents ; valider les formats par règles, laisser les données absentes inconnues.
- [ ] **SUITE-02 — Réutilisation des traitements.** Auditer les rapprochements entre sources et les faux doublons ; compléter les métadonnées des anciennes lectures. Empreintes, versions et réservations sont déjà présentes pour les nouveaux traitements.
- [ ] **SUITE-03 — Disponibilité plus fiable.** Reconnaître les pages HTTP 200 qui annoncent une clôture ; définir la fraîcheur requise avant recommandation. Les contrôles partagés avant rédaction existent ; une erreur réseau doit rester « inconnue ».
- [ ] **SUITE-04 — Classement plus précis.** Affiner les catégories par embeddings et calibrer une éventuelle note sémantique sur des profils réels. Depuis le 8 octobre, les listes sont rangées par le score gratuit « compétences en commun », la proximité de sens ne servant qu’à départager (`43c9a620`, `05f0827c`). Un score combiné (ordre BIZ-07, reporté après le pilote) demande : 5 à 10 profils réels de domaines différents ; pour chacun, un jugement humain « pertinent ou non » sur une trentaine d’offres réparties sur toute l’échelle ; la vérification que le même plancher et le même plafond tiennent d’un profil à l’autre ; une nouvelle étude à chaque changement de modèle de vecteurs ; la validation des poids 0,55 et 0,45, choisis pour l’ancien modèle. Un seul profil ne calibre rien. Jamais une probabilité d’embauche.
- [ ] **SUITE-05 — Recherche enrichie.** Compteurs par filtre, régions, sélection multiple, onglets nouvelles/gardées/postulées/masquées et alertes sur recherches enregistrées. Ville/date/télétravail et sauvegarde des recherches sont déjà livrés.
- [ ] **SUITE-06 — Versions des documents.** Comparaison visuelle des CV/lettres, contrôle des reformulations et réservation des révisions concurrentes ; les versions sont déjà sauvegardées.
- [ ] **SUITE-07 — Corbeille.** Annulation immédiate et conservation pendant 30 jours ; distinguer cette suppression de l’action existante « écarter/restaurer ».
- [ ] **SUITE-08 — Préparation d’entretien.** Fiche de préparation liée à chaque offre et au profil confirmé.
- [ ] **SUITE-09 — Tableau d’enquête.** Relier visuellement le CV aux offres et afficher les compétences communes, avec animations légères.
- [ ] **SUITE-10 — Candidatures externes et réponses.** Extension Chrome pour enregistrer une candidature externe ; import des réponses Gmail avec autorisation explicite.
- [ ] **SUITE-11 — Statistiques.** Taux de réponse par entreprise et catégorie, avec données suffisantes et périmètre clair.
- [ ] **SUITE-12 — Catalogue de stages.** Renforcer les sources et mesurer la couverture par métier ; les stages ne sont plus limités au constat historique de 17 offres.
- [ ] **SUITE-13 — Qualité et coût des modèles.** Étendre le comparatif français, valider les modèles de secours avant activation et mesurer le gain d’un traitement différé Batch. Le choix Gateway est déjà activé.
- [ ] **SUITE-14 — Coûts et exploitation.** Affiner les anciens coûts estimés, vérifier le budget applicatif global, étudier des notifications externes d’alerte et surveiller le volume de la base. L’alerte admin n’est pas un plafond de dépense.
- [ ] **SUITE-15 — Maintenance sécurité.** Suivre le correctif de la dépendance de développement `braces` ; le dernier audit des dépendances de production ne signalait aucune vulnérabilité.

## 6. Plus tard — décisions et extensions

- [ ] **PLUS-01 — Paiement, Stripe et page tarifs.** Après PUBLIC-03 ; prix, clients facturés et quotas à décider. L’ancien prix de 7,99 €/mois reste une proposition historique.
- [ ] **PLUS-02 — Hébergement pour 1 000 puis plusieurs milliers d’utilisateurs.** Mesurer charge, stockage et dépenses ; choisir les forfaits adaptés. Une montée en gamme Vercel/Supabase n’est pas déclarée nécessaire par un ancien tableau de coûts.
- [ ] **PLUS-03 — La bonne alternance.** Obtenir le compte développeur et les conditions/accords applicables, puis configurer la clé côté serveur.
- [ ] **PLUS-04 — Espace recruteur.** Publication d’offres et accès aux profils avec consentement explicite des étudiants.
- [ ] **PLUS-05 — Nom de marque et domaine .fr.** Vérifier la disponibilité et les droits avant investissement ; achat lebontaf.fr facultatif.

## 7. Fonctionnement IA et budget actuels

| Tâche | Solution actuelle | Réutilisation |
| --- | --- | --- |
| Lire une offre | Qwen3.7 Flash : résumé et informations structurées dans une même lecture. | Résultat partagé entre étudiants ; nouvelle lecture si la version pertinente change. |
| Importer un CV numérique | Extraction locale du PDF puis structuration via Gateway, modèle GPT-6 Luna configuré. | Profil confirmé comme point de départ ; aucun OCR de PDF scanné. |
| Vectoriser offres et profils | Perplexity `pplx-embed-v1-0.6b`, même espace versionné, 1 024 dimensions. | Vecteurs réutilisés lorsque le contenu et la version sont inchangés. |
| Classer et comparer | Calculs de proximité et de compétences ; explications standard par règles. | Aucun appel LLM obligatoire par offre et par étudiant ; conseil approfondi facultatif. |
| Adapter CV + lettre | Sélection des preuves du profil confirmé puis un appel GPT-6 Luna pour le kit. | Même kit réutilisé ; révision explicite distincte. Relecture de l’étudiant obligatoire. |
| Collecte, filtres, suivi, quotas, disponibilité et PDF | Automatisations et règles du serveur. | Ces opérations ne nécessitent pas de LLM. |

**Limites actuelles :** deux kits gratuits CV + lettre par mois ; plafond de la clé Gateway **2 USD**, choisi par le propriétaire. Le crédit acheté sur Gateway et ce plafond sont deux choses différentes. L’alerte administrateur apparaît à 80 % du seuil configuré ; elle ne remplace pas le plafond réel. Aucun achat ni hausse de plafond dans cette réorganisation.

Les anciens budgets « 100 / 1 000 / 8 000 utilisateurs » sont archivés : ce sont des hypothèses antérieures, pas une estimation fiable des modèles actuels. Le coût dépend de l’activité réelle, des nouvelles offres, des imports et des générations, pas seulement du nombre d’inscrits.

## 8. Périmètre du produit

Stage, alternance et CDD en France dans l’informatique, le numérique et la bureautique : web/logiciel, mobile, DevOps/cloud, systèmes/réseaux/support, data/IA, cybersécurité, test/qualité, projet/produit/conseil SI, design numérique, marketing digital et assistanat. Choix « autre métier » possible. CDI, intérim et freelance exclus de la collecte décidée.

L’étudiant garde le contrôle : confirmation du profil, relecture des documents et candidature effectuée sur le site de l’offre. Aucun envoi automatique.

## 9. Preuves et historique

Les chiffres ci-dessous sont des **contrôles datés**, pas des compteurs en temps réel : le 7 octobre à 11:47 UTC, 3 923 offres ouvertes étaient vectorisées et 3 921 avaient un résumé ; deux textes étaient trop courts. La collecte du matin était terminée sans erreur, la suivante avait démarré à 12:00 UTC. De nouvelles offres peuvent donc attendre leur traitement sans annuler la livraison du catalogue.

- [Livraison et vérifications MVP du 7 octobre](MVP-2026-10-07.md), [PR de livraison #3](https://github.com/afif-yassine/Job-Hunter-Control-/pull/3) et [correctifs/documentation #4](https://github.com/afif-yassine/Job-Hunter-Control-/pull/4).
- [Comparatif des modèles](RESULTATS-COMPARATIF-IA-2026-10-06.md), [tests CV/lettres](RESULTATS-CV-LETTRES-2026-10-06.md) et [tests embeddings/RAG](RESULTATS-EMBEDDINGS-RAG-2026-10-06.md) : résultats datés et limites des échantillons.
- [Ancien backlog intégral, avant réorganisation](archive/PRODUCT-BACKLOG-AVANT-REORGANISATION-2026-10-07.md) : copie conservée à l’identique. Les anciens sprints, cases, budgets et blocages ne sont plus la liste active.
- [Backlog original transmis depuis Claude](BACKLOG-CLAUDE-2026-10-06.md), [passation Claude](PASSATION-CLAUDE-2026-10-06.md) et [ancienne version centrée sur le design](archive/PRODUCT-BACKLOG-DESIGN-2026-10-06.md).

Pour les prochaines mises à jour : modifier l’état du composant et sa tâche existante ; ne pas ajouter un second sprint qui répète la même tâche. Une tâche devient « faite » avec une preuve adaptée (test, configuration contrôlée ou parcours vérifié). Si le périmètre change, expliquer la décision et conserver l’historique.
