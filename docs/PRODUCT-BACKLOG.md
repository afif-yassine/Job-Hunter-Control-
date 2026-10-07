# LeBonTaf — MVP et prochaines étapes

Mis à jour le **7 octobre 2026**, à partir des dernières livraisons et vérifications consignées dans le dépôt. Ce fichier est la référence de travail ; le document sur claude.ai ne se synchronise pas automatiquement avec lui.

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
| Sécurité et limites | À terminer | Isolation des comptes, quotas, réservations des traitements payants ; compteur indisponible = appel refusé. | Décider de la protection des mots de passe divulgués : PUBLIC-01 ; test pilote : MVP-06. |
| Coûts IA maîtrisés | Fait | Catalogue réutilisé, suivi des coûts, alerte administrateur, deux kits gratuits par mois et plafond Gateway configuré à 2 USD. | Vérifier le comportement aux limites pour le pilote : MVP-06. |
| Pages légales et données personnelles | Fait | Pages présentes et fonctions d’export/suppression livrées. Cela ne constitue pas une validation juridique. | Identité de l’éditeur et modèle de facturation : PUBLIC-03. |
| Tests et mise en ligne | Fait | CI et production livrées ; 181 tests réussis, 42 assertions PostgreSQL/pgvector, compilation réussie. Un test LaTeX ignoré. | Validation des parcours et de la charge : MVP-01 à MVP-06. |

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
- [x] Derniers contrôles : 181 tests réussis, 42 assertions PostgreSQL/pgvector et interface vérifiée à 390/1 440 px.

## 3. À faire maintenant — terminer le pilote

Ces six tâches constituent la prochaine liste de travail. Elles ne demandent pas de refaire les fonctions déjà livrées.

- [ ] **MVP-01 — Importer un PDF numérique de test dans Chrome, confirmer le profil, créer un kit CV/lettre et le rouvrir.** (À vérifier). Les faits correspondent au profil confirmé, les deux PDF sont lisibles et la réouverture ne relance pas la génération. Ne pas remplacer le vrai profil par un profil fictif. Dernier essai bloqué par la permission de fichiers de l’extension Chrome.
- [x] **MVP-02 — Tester connexion et réinitialisation jusqu’au changement du mot de passe ; vérifier l’expéditeur des e-mails et les modèles français.** (Vérifié le 7 octobre 2026, en production sur lebontaf.com, par le propriétaire avec la session frontend) : e-mail reçu depuis l’expéditeur attendu, modèle en français, lien ouvert directement la page « Nouveau mot de passe », nouveau mot de passe accepté et reconnexion OK. Le parcours inclut aussi les correctifs du jour (commits f2279ba5, 8bf9aeba, 32c45659) : message clair « Un compte existe déjà avec cette adresse » à l’inscription, indication « Continuer avec Google » et passage par « Mot de passe oublié » pour choisir un mot de passe sur un compte créé via Google. SMTP Resend non recréé.
- [ ] **MVP-03 — Tester le classement connecté avec plusieurs profils et critères explicites.** (À vérifier). Contrat, localisation et incompatibilités sont correctement pris en compte ; compétences communes/manquantes compréhensibles. La proximité vectorielle n’est pas présentée comme une probabilité d’embauche.
- [ ] **MVP-04 — Contrôler une collecte complète et le traitement des nouvelles offres ; vérifier le retrait d’une offre dans les différents parcours.** (À vérifier). La file progresse, les erreurs et textes insuffisants sont visibles, un retrait confirmé empêche la génération. Les offres inchangées ne sont pas relues ou vectorisées à chaque recherche.
- [ ] **MVP-05 — Parcourir « nouvelle → vue → dossier prêt → envoyée → entretien → réponse », puis écarter/restaurer une offre et vérifier les rappels.** (À vérifier). Statuts et documents conservés après rechargement, parcours utilisable sur mobile. « Envoyée » dépend de la confirmation de l’étudiant ; aucune candidature automatique.
- [ ] **MVP-06 — Tester le pilote avec plusieurs comptes, appels concurrents, limites atteintes et charge représentative de 100 utilisateurs.** (À vérifier). Aucun accès aux données d’un autre compte, aucun double traitement payant, quotas respectés et message clair quand le budget est épuisé ; temps de réponse mesurés. Distinguer 100 inscrits de 100 utilisateurs simultanés.

## 4. Avant l’ouverture publique ou la facturation

- [ ] **PUBLIC-01 — Traiter la protection des mots de passe divulgués et vérifier la désactivation de l’ancien secret client Google.** (À terminer). La protection Supabase est désactivée ; l’interface actuelle la réserve au forfait Pro. Décision du propriétaire avant tout abonnement. Ne pas marquer cette protection « faite » sur Free.
- [ ] **PUBLIC-02 — Ajouter le logo officiel Adzuna et vérifier les attributions et conditions d’utilisation des sources, notamment Adzuna et Jooble.** (À terminer). Conserver « Jobs by Adzuna » ; confirmer les exigences applicables avant diffusion publique/commerciale. Les affirmations juridiques de l’ancien backlog restent à vérifier.
- [ ] **PUBLIC-03 — Valider le modèle de facturation et renseigner l’identité réelle de l’éditeur dans les pages légales.** (À terminer). Conseil juridique et situation de l’entreprise à confirmer avant de facturer. Aucun tarif ou modèle payant n’est adopté par ce document.
- [ ] **PUBLIC-04 — Finaliser l’accueil du premier utilisateur, la marque Google et le contact.** (À terminer). Vérifier Search Console/logo/nom LeBonTaf et la redirection contact@lebontaf.com ; support@lebontaf.com existe déjà dans les pages.

## 5. Après le pilote — améliorations conservées

Toutes ces tâches restent ouvertes. Elles ne bloquent pas, à elles seules, la vérification du cœur du MVP.

- [ ] **SUITE-01 — Lecture structurée des offres.** Ajouter durée, rythme, dates et salaire lorsqu’ils sont présents ; valider les formats par règles, laisser les données absentes inconnues.
- [ ] **SUITE-02 — Réutilisation des traitements.** Auditer les rapprochements entre sources et les faux doublons ; compléter les métadonnées des anciennes lectures. Empreintes, versions et réservations sont déjà présentes pour les nouveaux traitements.
- [ ] **SUITE-03 — Disponibilité plus fiable.** Reconnaître les pages HTTP 200 qui annoncent une clôture ; définir la fraîcheur requise avant recommandation. Les contrôles partagés avant rédaction existent ; une erreur réseau doit rester « inconnue ».
- [ ] **SUITE-04 — Classement plus précis.** Affiner les catégories par embeddings et calibrer une éventuelle note sémantique sur des profils réels. Garder le classement par proximité tant que cette note n’est pas validée.
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
