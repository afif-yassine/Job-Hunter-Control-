# LeBonTaf — Product backlog

Référence principale du projet — mise à jour du 7 octobre 2026.

Ce fichier reprend le backlog global fourni par le propriétaire depuis Claude. Il remplace le document centré sur le design, conservé dans [l'archive](archive/PRODUCT-BACKLOG-DESIGN-2026-10-06.md). La [copie originale](BACKLOG-CLAUDE-2026-10-06.md) et la [passation](PASSATION-CLAUDE-2026-10-06.md) sont conservées.

## Optimisation IA et automatisations — décision du 6 octobre 2026

Objectif : lancer le MVP pour les 100 premiers utilisateurs avec des traitements partagés, sans appels IA répétitifs. Les éléments ci-dessous sont à terminer et vérifier ; les constats de code ne constituent pas une validation de production. Cette section complète les sprints existants sur le catalogue, le classement, le RAG et les coûts.

### Base déjà présente dans le code

- Lecture partagée d'une offre : un appel LLM extrait résumé, missions, outils, conditions, compétences, niveau et télétravail, puis sauvegarde le résultat.
- Catalogue Perplexity entièrement vectorisé : 3 890 offres ouvertes, 1 024 dimensions, espace versionné. Les profils sont vectorisés à leur prochaine recherche ; vérification du classement réel encore à terminer.
- Détection de doublons par liens normalisés, empreinte entreprise/titre/ville/contrat et comparaison de textes dans les parcours prévus.
- Fermeture des offres absentes de certains tableaux d'entreprises lus complètement, expiration des offres anciennes et contrôle HTTP/API avant génération des documents.
- Génération du CV et de la lettre en un appel ; suivi des tokens et contrôles de quotas présents, à compléter et vérifier.

### P0 — catalogue partagé et suppression des répétitions

- [x] Rattraper les embeddings du catalogue en production : 3 890/3 890 offres, 78 appels par lots, 0,006257 USD. Une relance ne lance aucun nouvel appel pour les offres inchangées.
- [ ] Terminer les résumés partagés : 2 788/3 890 au dernier contrôle ; le cron Qwen progresse et ne signale plus d'erreur fournisseur.
- [ ] Compléter l'extraction structurée unique avec durée, rythme, dates et salaire lorsqu'ils figurent dans la source. Conserver les faits de la source et laisser les informations absentes inconnues ; valider les formats sans nouvel appel LLM.
- [ ] Sauvegarder l'empreinte du contenu pertinent, la version de l'extracteur, le modèle et la date de traitement. Une collecte identique ne relance ni lecture ni embedding ; un changement pertinent invalide les résultats concernés.
- [ ] Garantir qu'une même offre collectée sur plusieurs sources réutilise ses traitements partagés ; vérifier les faux rapprochements pour ne pas fusionner des postes différents.
- [ ] Réserver atomiquement les traitements en cours pour éviter deux appels simultanés sur la même offre ; prévoir expiration du verrou, reprises bornées et erreurs visibles.
- [x] Éviter l'embedding forcé à chaque sauvegarde du profil : cache par source et version, présence du vecteur vérifiée, réservation SQL avant calcul.
- [x] Conserver la compatibilité des modèles et versions d'embeddings entre profils et offres : colonnes parallèles et RPC par espace ; catalogue rattrapé avant activation de Perplexity.

### P0 — classement et rédaction à la demande

- [ ] Vérifier le classement avec de vrais profils : appliquer les critères explicites (contrat, localisation, disponibilité, etc.) puis comparer embeddings et compétences. Ne pas présenter le score comme une probabilité d'embauche.
- [ ] Produire les explications simples (compétences communes/manquantes, critères incompatibles ou inconnus) par calcul et règles, sans appel LLM.
- [ ] Retirer l'analyse LLM détaillée obligatoire avant la génération, dans les parcours manuel et automatique ; utiliser les faits structurés et le classement existant. Garder le conseil approfondi comme action facultative et limitée.
- [ ] Terminer le RAG de rédaction : sélectionner les preuves pertinentes du profil et du registre de vérité pour l'offre choisie, sans envoyer tout le catalogue ou tout l'historique et sans inventer de faits.
- [x] Brancher la sélection déterministe de preuves au pipeline : un kit réel GPT-6 Luna a été créé avec 24 preuves et versions conservées, compétences explicites contrôlées. Les reformulations restent à relire et leur validation complète reste à faire.
- [x] Versionner l'espace vectoriel et adapter stockage/index aux 1 024 dimensions Perplexity ; catalogue migré avant activation, profils calculés à la demande. La calibration de la note sémantique reste une tâche séparée.
- [x] Sauvegarder les générations avec utilisateur et versions ; le kit réel se réaffiche avec les mêmes documents. Cache et isolation couverts par les tests, révisions explicites distinctes.

### P0 — disponibilité des offres sans LLM

- [ ] Ajouter un contrôle partagé de disponibilité avec résultat (disponible, retirée, inconnue), source de preuve et date ; réutiliser un contrôle récent pour tous les utilisateurs.
- [ ] Définir la fraîcheur exigée avant de recommander une offre et avant une action importante ; revérifier lorsque le contrôle est trop ancien, sans requête systématique à chaque affichage.
- [ ] Détecter les retraits via API source, tableau d'entreprise et réponses HTTP ; ajouter des règles adaptées aux pages HTTP 200 annonçant la clôture. Une réponse 200 seule ne prouve pas que le recrutement continue.
- [ ] Ne pas retirer une offre pour un blocage robot, un délai dépassé ou une erreur réseau ; conserver un état inconnu et une reprise bornée.
- [ ] Propager un retrait confirmé au catalogue et aux listes concernées, et bloquer la génération sur l'offre retirée. Vérifier la propagation dans tous les parcours.

### P0 — budget du lancement et automatisations sans IA

- [ ] Mesurer les dépenses par tâche, modèle et utilisateur avec les tarifs réellement utilisés, y compris embeddings, révisions et reprises ; corriger les estimations génériques si elles divergent.
- [ ] Définir des quotas pour les 100 premiers utilisateurs, un plafond applicatif de dépenses, des alertes et un comportement clair lorsque le budget est atteint. Le budget initial envisagé de 20 € concerne l'IA, pas tous les frais du site ; 5 kits par utilisateur est une hypothèse à valider.
- [ ] Vérifier puis compléter sans LLM : collecte planifiée, filtres, expiration, rappels de suivi, transitions de statuts, quotas, alertes de coût et rendu PDF. Ne pas envoyer de candidature automatiquement.
- [ ] Vérifier que le nombre de lectures d'offres dépend du nombre de versions d'offres, pas du nombre d'utilisateurs ; que les recherches ne déclenchent pas de nouvelle analyse ; et que des traitements concurrents ne doublent pas les dépenses.

### P1 — choix des modèles après validation du MVP

Suivi : [intégration IA et ordre d'activation](INTEGRATION-IA-2026-10-06.md). Gateway texte et embeddings activés en production avec la clé durable du propriétaire ; plafond de 2 USD conservé.

- [x] Préparer le routage texte Gateway par tâche, les sorties bornées et l'enregistrement du coût retourné.
- [x] Brancher une sélection déterministe des preuves du profil au kit et aux révisions ; vérifier les compétences explicites avant sauvegarde. Les reformulations restent à relire.
- [x] Réutiliser un kit de même version et supprimer l'embedding forcé du profil à chaque sauvegarde.
- [x] Préparer et tester localement le stockage parallèle Perplexity 1024, l'invalidation, les RPC par espace et la réservation SQL des kits.
- [x] Appliquer/vérifier la migration sur la base cible : version distante `20261006152810`, tests de permissions réels et advisors sans nouveau problème.
- [x] Réserver atomiquement les embeddings d'offres/profils ; tests d'appels concurrents et de libération après erreur.
- [ ] Terminer le rattrapage des offres et les vérifications des modèles sur les parcours réels.
- [x] Clé durable Gateway configurée et plafond réel de 2 USD confirmé ; routage texte activé et redéployé en production. Contrôle de collecte : 52 lectures Qwen réussies, environ 0,002591 USD comptabilisés.
- [x] Terminer le rattrapage Perplexity avant bascule des profils/recherche ; vérifier un kit GPT complet avec la nouvelle clé : CV et lettre sauvegardés, deux PDF d'une page ouverts dans Chrome, coût de rédaction 0,001082 USD. Déploiement Perplexity `dpl_9vxtwW7stxYSyLejKuZQPxUYZQ8J` READY.
- [ ] Vérifier la recherche Perplexity avec le profil réel : Chrome a cessé de répondre avant le lancement. Le profil n'a pas encore de vecteur Perplexity au dernier contrôle ; action « Lancer la recherche » demandée au propriétaire.
- [ ] Calibrer la note sémantique Perplexity sur de vrais profils ; la proximité sert à classer mais ne reçoit pas encore de note numérique.
- [ ] Réserver les révisions concurrentes ; contrôler les reformulations et les coûts au niveau global.

- Comparatif réel poursuivi avec les prompts et le schéma de l'application : 298 requêtes cumulées, 294 réponses, coût déclaré Gateway 0,053110 USD ; réservation conservatrice 0,228409 USD ; plafond autorisé 1 USD. [Premier comparatif](RESULTATS-COMPARATIF-IA-2026-10-06.md), [tests CV et lettres](RESULTATS-CV-LETTRES-2026-10-06.md). Qwen3.7 Flash : candidat extraction sur les champs vérifiés. GPT-6 Luna : premier choix provisoire pour les brouillons CV/lettre avec le prompt v5, 6/6 contrôles techniques, environ 0,000464 USD par kit court. Relecture obligatoire ; description d'entreprise non prouvée dans le cas incompatible. DeepSeek ajoute encore des faits non justifiés en rédaction. Aucune migration en production effectuée.
- [x] Exécuter le comparatif sur profils fictifs, ajouter des alternatives économiques pour la rédaction et sélectionner un candidat provisoire avec schéma strict et consignes professionnelles.
- Dernier cumul après embeddings, reranking, réponses sourcées et import CV texte : **471 requêtes, 464 réponses ; 0,063568 USD de coût déclaré ; 0,335539 USD réservés conservativement**, sous le plafond total de 1 USD. [Rapport embeddings et RAG](RESULTATS-EMBEDDINGS-RAG-2026-10-06.md). Choix provisoire : Perplexity pplx-embed-v1-0.6b pour embeddings ; Qwen3.7 Flash pour extraction d'offres ; GPT-6 Luna pour import CV et rédaction. Aucun changement de modèle en production.
- [x] Tester les 28 embeddings du catalogue sur deux séries synthétiques ; comparer les 4 rerankers dont le tarif est exploitable. Perplexity : 24/24 premiers résultats attendus sur les requêtes d'offres difficiles ; reranking facultatif, aucun bénéfice démontré pour ce choix sur ces cas.
- [x] Tester une sélection de preuves suivie de réponses sourcées (16 réponses), l'import CV texte (3 modèles, 3 cas) et le prototype local d'isolation/versionnage des preuves (22 assertions). Une reformulation non prouvée reste détectée à la relecture ; PDF/OCR, RLS en base et intégration complète restent à valider.
- [ ] Intégrer le schéma strict et les consignes testées, vérifier les faits du registre avant affichage, les exigences incompatibles avant génération et les paragraphes/PDF. Aucun modèle de secours rédactionnel validé à ce stade.
- [ ] Comparer les modèles économiques sur un échantillon représentatif d'offres et de documents français : exactitude des faits, qualité rédactionnelle, latence et coût réel.
- [ ] Décider entre Gemini direct et Vercel AI Gateway sur ces mesures. Gateway utilisé pour les tests avec une clé privée temporaire et le crédit acheté par le propriétaire ; aucune intégration ou migration en production à ce stade.
- [ ] Si Gateway est retenu, intégrer un routage par tâche et des modèles de secours compatibles, avec limites de coût et confidentialité vérifiées.
- [ ] Étudier le traitement différé Batch pour le catalogue lorsque le délai est acceptable ; mesurer le gain avant adoption.

## Vérifications récentes : ces constats priment sur les états historiques ci-dessous

### Activation Gateway et catalogue — contrôle du 7 octobre 2026

- [x] Livraison du rattrapage protégé : [PR #2](https://github.com/afif-yassine/Job-Hunter-Control-/pull/2), CI et build Vercel réussis. Lots bornés, authentification avant accès à la base, pas de reprise IA automatique ; test de mutation du contrôle d'accès détecté puis code restauré.
- [x] Tous les vecteurs du catalogue présents dans le même espace Perplexity ; relance HTTP 200, `embedded: 0`, compteur d'appels inchangé à 78.
- [x] `EMBEDDING_PROVIDER=gateway` activé après rattrapage et redéploiement READY ; les deux dernières réponses du cron sont HTTP 200 sans erreur, avec 58 résumés lus par exécution.
- [ ] Import d'un nouveau CV PDF : reste sur Gemini, dont le crédit est épuisé. Ne pas présenter la génération PDF des documents comme une validation de l'import PDF/OCR.

Les constats de rattrapage Gemini ci-dessous sont historiques et sont remplacés par l'activation Gateway ci-dessus. Le crédit Gemini n'a pas été rechargé ; il reste requis par l'import PDF actuel.

### Correction du rattrapage — 6 octobre 2026

- [ ] Blocage confirmé dans les réponses du cron : crédit Google AI Studio épuisé (embeddings). Recharge par le propriétaire nécessaire avant de terminer le rattrapage. Le lecteur signale aussi des échecs ; la cause du fournisseur doit rester visible dans le rapport, sans les présenter comme des textes illisibles.

- [x] Reproduire et corriger le cas où le rattrapage des embeddings consomme le temps nécessaire aux résumés. Une réserve de 20 secondes est maintenant prévue pour le lecteur partagé ; les appels déjà en cours peuvent dépasser cette réserve.
- [x] Rendre visible une erreur de lecture du catalogue au lieu de retourner une file vide ; tests de régression ajoutés.
- [x] Contrôles TypeScript et lint réussis ; 147 tests réussis, aucun échec, un test LaTeX ignoré. Compilation et livraison en cours.
- [ ] Confirmer en production que les résumés progressent et terminer le rattrapage ; dernier contrôle avant correction : 1 964 offres vectorisées sur 3 851 ouvertes, 0 résumé, 3 849 textes admissibles.
- [ ] Vérifier le classement avec un compte connecté. Le catalogue contient déjà 351 stages ouverts au contrôle du 6 octobre ; le constat historique de 17 stages ci-dessous est dépassé.


- La version de Claude jusqu'à `995f185e` est intégrée et publiée. La reprise documentaire `0e7f4eac` a une CI GitHub réussie et un déploiement Vercel READY ; le contact `support@lebontaf.com` est vérifié sur lebontaf.com.
- TypeScript, lint et compilation réussis ; 145 tests réussis, aucun échec, un test LaTeX ignoré faute de pdflatex.
- Embeddings : contrôle du 6 octobre, 1 664 offres ouvertes vectorisées sur 3 851, et 0 résumé partagé. La mention « 0 offre sur 3 940 » ci-dessous est historique. Le rattrapage reste à terminer.
- Le code du Sprint 6 est en production ; la vérification complète du suivi avec un compte connecté reste à faire. Le déploiement seul ne termine pas le composant.
- Connexion : trois onglets et Google présents, page contrôlée à 390 px sans débordement horizontal. Demande de réinitialisation acceptée et e-mail reçu ; modèle Supabase encore en anglais. SMTP, expéditeur et réinitialisation complète restent à vérifier.
- Les coûts et affirmations réglementaires hérités du document sont à revalider avant une décision de paiement ou de lancement.

Ordre de reprise : terminer la vérification de cette livraison et le rattrapage du catalogue ; configurer les e-mails ; sélectionner les preuves pertinentes du CV pour l'écriture (RAG) ; vérifier quotas et alertes de coût. Les autres sprints conservent leur périmètre.

Le document sur claude.ai et ce fichier ne se synchronisent pas automatiquement. Ce fichier est la référence du travail dans le dépôt. Les cases ci-dessous reprennent celles transmises par le propriétaire, sans les déclarer toutes vérifiées.

---

# Job Hunter — Product backlog

Oct 3, 2026 · @Someone

Coché = livré dans le code. Je coche moi-même chaque case quand l’étape est faite.

## Méthode : agile, pas cycle en V

On travaille en **agile** (un Scrum léger) : des sprints courts, une version mise en ligne et vérifiée à la fin de chacun, et un backlog qu’on réordonne selon ce qu’on apprend. C’est bien ce que tu as fait depuis le début.

|  | Cycle en V | Agile (notre méthode) |
| --- | --- | --- |
| Plan | Tout est spécifié au départ | Backlog priorisé, revu à chaque sprint |
| Livraison | Une seule, à la fin | Une version utilisable à chaque sprint |
| Changement en route | Coûteux : on remonte le V | Prévu : on déplace des cases du backlog |
| Tests | Après le développement (branche droite du V) | À chaque envoi (CI) et en production à chaque sprint |
| Quand on voit le produit | À la fin | Dès le premier sprint |
| Adapté à | Besoin figé et contrat fixe | Produit qui cherche encore ses utilisateurs |

« Parfait dès le début », en agile, veut dire : chaque composant du **socle essentiel** respecte la Définition de « terminé » avant l’ouverture au public. Tout rendre parfait d’un coup, avant de montrer quoi que ce soit, ce serait revenir au cycle en V. La règle des prochains sprints : finir le socle avant d’ajouter de nouvelles fonctions.

- **Sprint** : 1 à 2 semaines, un objectif en une phrase.
- **Planification** : on choisit les cases du sprint, le socle en premier.
- **Revue** : mise en ligne, vérification en production, cases cochées ici.
- **Rétrospective** : ce qui a coincé, et ce qu’on change au sprint suivant.

&#91;embedded content: cycle en V et boucle agile\]

En V, on ne voit le produit qu’à la livraison finale ; en agile, chaque tour de boucle se termine par une version en ligne qu’on vérifie.

## Définition de « terminé »

Une case n’est cochée que si tout ce qui suit est vrai. C’est notre définition de « parfait ».

- Les tests automatiques, le lint et la compilation passent, et la CI GitHub est verte.
- C’est vérifié à l’écran, sur ordinateur et sur mobile, sans rien qui déborde.
- Chaque erreur s’affiche en français clair ; rien ne plante en silence.
- Chaque compte ne voit que ses données, et ce qui coûte a une limite de requêtes.
- Le coût IA est mesuré, et rien n’est dépensé sur une offre retirée.
- C’est utilisable par tous : vrais boutons, texte lisible, animations coupées si l’appareil le demande.
- C’est mis en ligne et vérifié en production (Vercel, Supabase).

## Le socle essentiel (MVP)

Ces 12 composants doivent être « terminés » avant d’ouvrir l’appli à d’autres étudiants : 4 le sont et 8 sont à finir. Le reste du backlog attend.

| Composant | Pourquoi il est essentiel | État | Ce qui manque |
| --- | --- | --- | --- |
| Connexion et comptes | Sans compte, rien ne commence | À finir | E-mails de connexion envoyés depuis lebontaf.com (SMTP personnalisé) pour que tout le monde reçoive le lien, protection des mots de passe divulgués |
| Import du CV | Tout le reste part du profil | Fait | — |
| Catalogue d’offres (collecte 2 fois par jour) | C’est ce que l’étudiant vient chercher | À finir | Plus de stages, logo Adzuna, plan Supabase au-delà de 500 Mo |
| Recherche et filtres | Trouver vite la bonne offre | À finir | Filtres avancés, recherches enregistrées |
| Classement selon le CV | Les bonnes offres en premier | À finir | 3 890 offres vectorisées avec Perplexity ; vérifier la recherche avec de vrais profils et calibrer la note sémantique, voir Sprint 7 |
| CV et lettre adaptés | La promesse principale du produit | À finir | RAG sur le registre de vérité (rien d’inventé) |
| Suivi des candidatures | Savoir où on en est | À finir | Mise en ligne du Sprint 6 (parcours de chaque offre, Mon suivi) |
| Design LeBonTaf | La première impression, sur mobile aussi | Fait | — |
| Sécurité et limites | Protéger les données et le budget | À finir | Protection des mots de passe divulgués (réglage Supabase) |
| Coûts IA maîtrisés | Ne pas payer plus que prévu | À finir | Alertes de dépassement, offre gratuite limitée |
| Pages légales et RGPD | Obligatoire avant d’ouvrir au public | Fait | — (mentions de l’éditeur à mettre à jour avec la micro-entreprise avant de facturer) |
| Tests et mise en ligne | Chaque version est fiable | Fait | — |

## Périmètre décidé

On ne collecte que les **stages, alternances et CDD** des métiers de l’**informatique, du numérique et de la bureautique**, partout en France. L’étudiant choisit ses catégories au lieu de taper des mots-clés.

| Catégorie | Exemples de métiers |
| --- | --- |
| Développement web et logiciel | Développeur front, back, full stack, Java, Python |
| Développement mobile | Développeur iOS, Android, Flutter |
| DevOps et cloud | DevOps, SRE, ingénieur cloud |
| Systèmes, réseaux et support | Technicien support, admin systèmes et réseaux, helpdesk |
| Data et IA | Data analyst, data engineer, data scientist, ML |
| Cybersécurité | Analyste SOC, pentester, technicien sécurité |
| Test et qualité | Testeur, QA, automatisation des tests |
| Projet, produit et conseil SI | Chef de projet digital, Product Owner, consultant AMOA |
| Design numérique | UX/UI designer, webdesigner |
| Marketing digital | SEO, community manager, growth, webmarketing |
| Bureautique et assistanat | Assistant administratif, secrétariat, gestion administrative |

Un champ « Autre métier » reste possible pour ce qui n’entre dans aucune case. Contrats exclus de la collecte : CDI, intérim, freelance.

## Déjà fait (avant le Sprint 1)

- [x] Comptes, connexion et base Supabase avec accès limité à ses propres données
- [x] Recherche multi-sources : France Travail, JSearch, Adzuna, Jooble
- [x] Pages carrière des entreprises (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee)
- [x] Découverte automatique des entreprises à partir des liens des offres
- [x] Dédoublonnage (même lien, même empreinte, texte proche) et « Déjà postulé ailleurs »
- [x] Offres suspectes mises de côté avant toute dépense IA
- [x] Lecture du texte complet des annonces avant l’analyse
- [x] Score de compatibilité avec le profil (Gemini)
- [x] CV et lettre adaptés : PDF, LaTeX, modification par une phrase
- [x] Questions des formulaires gardées et réutilisées
- [x] Recherche automatique sur le serveur (cron Vercel) et worker Railway
- [x] Santé des sources, budgets gratuits et alertes dans la page Admin
- [x] France Travail : marché du travail et taux d’accès à l’emploi
- [x] Clés des sources saisies depuis l’appli (Réglages > Sources)

## Sprint 1 — Fondations solides (en cours)

Objectif : une recherche ne coûte plus par compte, aucune erreur cachée, aucune dépense sur une offre morte.

- [x] Sauvegarde de la base avant les changements de structure
- [x] La bonne alternance branchée, mais éteinte : leur licence interdit l’usage commercial sans accord écrit
- [x] Chaque erreur s’affiche, une partie qui plante ne bloque plus le reste
- [x] Cartes « Bientôt » et page Feuille de route dans l’appli
- [x] Catalogue d’offres commun : chaque offre stockée une seule fois
- [x] Cache partagé par requête, insensible aux majuscules, accents, ordre des mots et synonymes
- [x] Offres retirées de la page carrière fermées automatiquement
- [x] Offres plus vues depuis 21 jours expirées
- [x] Bouton « Offre plus disponible ? », fermeture pour tous après 10 signalements
- [x] Filtre « Plus disponibles », aucune analyse ni génération sur une offre morte
- [x] Nouveaux comptes et nouvelles recherches remplis depuis le catalogue, sans appel aux sites
- [x] Villes de banlieue reconnues sans numéro de département
- [x] Mise en ligne de ces changements (deploy-job-hunter.bat) et vérification sur Vercel
- [x] Fonctions du budget et du journal des sources réservées au serveur (faille relevée par Supabase)
- [x] En-têtes de sécurité du site (anti-iframe, HTTPS forcé, permissions bloquées)
- [x] Limite de requêtes par compte sur les pages qui coûtent (recherche, analyse, génération, compteurs)
- [x] Politique de sécurité du contenu (CSP) avec nonces
- [x] Coût IA suivi par compte dans la page Admin
- [x] Tests automatiques à chaque envoi sur GitHub (CI)

## Sprint 2 — Collecte plateforme et catégories

Objectif : la plateforme collecte 2 fois par jour pour tout le monde, l’étudiant coche ses catégories et voit tout de suite les offres.

- [x] Vérifier les conditions d’utilisation de chaque source pour un catalogue partagé (France Travail, Adzuna, Jooble, JSearch, La bonne alternance)
- [x] Liste des catégories avec leurs codes métier ROME et leurs mots de recherche
- [x] Collecte France Travail par région et par métier, alternance et CDD (toute la France, découpée par département au-delà de 3 150 offres)
- [x] Collecte des pages carrière connues, toutes entreprises confondues
- [x] Collecte Adzuna sur les grandes villes, dans le budget gratuit
- [x] Collecte lancée à 6 h et 14 h, par tranches de 45 s qui reprennent où elles s’arrêtent (limite de 60 s de Vercel)
- [x] Chaque offre rangée dans une catégorie et un type de contrat (stage, alternance, CDD)
- [x] Choix des catégories par l’étudiant, avec le nombre d’offres près de chez lui
- [x] Champ « Autre métier » avec recherche à la demande ; une catégorie déjà bien couverte par la collecte (20 offres et plus) n’est plus recherchée compte par compte
- [x] Vérification que l’offre est toujours en ligne juste avant de créer le CV et la lettre
- [ ] Plan Supabase adapté au volume (le plan gratuit s’arrête à 500 Mo)
- [x] Mentions obligatoires sur chaque offre : « Source : France Travail » avec lien vers la licence, « Jobs by Adzuna »
- [x] Offres France Travail retirées fermées et leur texte effacé dans le catalogue après chaque collecte complète
- [x] Suivi de la collecte dans Admin, avec le bouton « Avancer la collecte »
- [x] Première collecte réelle vérifiée : 134 tâches sans erreur, 4 623 offres France Travail lues, 101 départements, 3 588 offres ouvertes au catalogue
- [ ] Logo officiel Adzuna à côté de « Jobs by Adzuna » (exigé par leurs conditions)
- [x] Effacer aussi le texte des offres France Travail retirées dans les listes des comptes (licence, article 7)
- [x] Offres enregistrées avant les catégories reclassées automatiquement à chaque tranche de collecte
- [ ] Plus de stages : France Travail n’en publie pas, la première collecte n’en a trouvé que 17 (Adzuna du matin et pages carrière à renforcer)

## Sprint 3 — CV importé et classement intelligent

Objectif : l’étudiant dépose son CV une fois, et toutes les offres sont classées pour lui.

- [x] Import du CV en PDF une seule fois, données gardées pour tous les CV adaptés
- [x] Choix des catégories proposé d’après le CV
- [x] Activer pgvector dans Supabase
- [x] Embedding de chaque offre, calculé une seule fois et partagé
- [x] Classement de toutes les offres ouvertes selon le profil
- [ ] RAG sur le registre de vérité du profil pour le CV et la lettre (rien d’inventé)
- [x] Résumé court de chaque offre (« En bref »), écrit à la première analyse et partagé avec tous
- [ ] Catégorie des offres affinée par embeddings (« Ingénieur plateforme » → DevOps)

## Sprint 4 — Design et suivi des candidatures

Objectif : une appli attirante et simple, où l’étudiant suit chaque candidature jusqu’à la réponse.

- [x] Maquette du design validée : accueil, connexion, espace étudiant, pistes, registre, admin, recruteur, écran « Bientôt »
- [x] Nouveau design LeBonTaf dans le site (vieux livre et moderne, logo lampe animé, animations Framer Motion), thème clair et sombre, adapté au mobile (accueil et connexion faits)
- [x] Filtres et catégories dans la liste des offres
- [ ] Historique et comparaison des versions de CV et de lettre
- [x] Registre des candidatures en tiroirs : repérées, prêtes, envoyées, entretiens, réponses, classées
- [ ] Extension Chrome pour enregistrer une candidature faite sur un autre site
- [x] Relances proposées après quelques jours sans réponse
- [ ] Fiche de préparation d’entretien pour chaque offre
- [x] Question « As-tu envoyé ta candidature ? » au retour d’une annonce, et badge « déjà envoyée » dans les offres
- [x] Rappels du jour : candidature prête mais pas envoyée depuis 3 jours, relance après 7 jours sans réponse, entretien à venir
- [x] Dossier de chaque offre : résumé « En bref », journal daté, CV et lettre, notes libres
- [ ] Classer ou supprimer une offre, avec annulation immédiate et corbeille de 30 jours
- [ ] Filtres avancés : nombre d’offres par filtre, ressemblance avec le CV, date de publication, région, onglets (nouvelles, gardées, déjà postulé, masquées), sélection multiple
- [ ] Recherches enregistrées avec alerte de nouvelles offres
- [ ] Tableau d’enquête : le CV relié aux offres, avec les compétences en commun

## Sprint 5 — Connexion, légal et marque LeBonTaf

Objectif : un compte facile à créer, des pages légales en règle et un nom de marque propre avant l’ouverture au public.

- [x] Connexion par Google et par lien magique (e-mail), sans mot de passe
- [x] Pages légales : confidentialité, mentions légales, conditions d’utilisation
- [x] Export et suppression du compte dans Réglages (RGPD)
- [x] Application Google publiée en production
- [x] Nouveau nom LeBonTaf et domaine lebontaf.com branchés (Vercel, Supabase, Google Cloud)
- [ ] Liens de connexion envoyés depuis lebontaf.com (SMTP personnalisé, modèles d’e-mail au format token\_hash)
- [ ] Adresse contact@lebontaf.com redirigée vers Gmail
- [ ] Écran de connexion Google au nom LeBonTaf (validation de la marque : Search Console et logo)
- [x] Refonte « tableau d’enquête » : porte d’entrée animée, logo animé, accueil, connexion, pages légales et espace étudiant (code prêt et fusionné avec le travail de Codex, mise en ligne en attente)

## Sprint 6 — Suivre chaque offre jusqu’à l’entretien (en cours)

Objectif : pour chaque offre, l’étudiant voit d’un coup d’œil où il en est : vue ou pas, CV et lettre prêts ou pas, envoyée ou pas, entretien, réponse. Demande du 5 octobre.

| Étape | Quand l’offre y passe | Action proposée |
| --- | --- | --- |
| Nouvelle | Trouvée par la collecte, jamais ouverte | Ouvrir l’offre |
| Vue | Ouverte au moins une fois | Créer le CV et la lettre, ou l’écarter |
| Dossier prêt | CV et lettre créés | Relire, puis postuler sur le site de l’offre |
| Envoyée | L’étudiant confirme « J’ai postulé » | Relancer après 7 jours sans réponse |
| Entretien | Date d’entretien saisie | Préparer l’entretien |
| Réponse | Acceptée ou refusée | Fin du parcours |
| Écartée | À tout moment, « Pas pour moi » | Restaurer si besoin |

- [x] Parcours enregistré pour chaque offre : étape, date de vue, date d’envoi, date d’entretien, réponse
- [x] Carte d’offre complète avant le clic : ville, salaire, date de publication, plateforme, score avec le CV, contrat, étape, CV et lettre créés ou non, pastille « nouvelle »
- [x] Salaire récupéré auprès des sources qui le donnent (France Travail, Adzuna, JSearch, Jooble)
- [x] Nombre de candidats : aucune de nos sources ne le donne ; à la place, nombre d’étudiants LeBonTaf qui suivent la même offre (anonyme, affiché à partir de 3)
- [x] Clic sur une offre : panneau avec « En bref » (missions, outils, rythme), infos clés, frise du parcours et la bonne action
- [x] « Mon suivi » : une colonne par étape (onglets sur mobile), déplacement en un clic
- [x] Espace étudiant allégé : Accueil, Offres, Mon suivi, Réglages ; « Candidatures » fusionné dans Mon suivi ; Activité réservée à l’admin ; Documents et Questions rangés dans le panneau de l’offre et dans « Plus »
- [x] Accueil : « À faire aujourd’hui » tiré du parcours (dossiers à relire, candidatures à envoyer, relances, entretiens)
- [x] Offre gratuite : 2 dossiers (CV + lettre) par mois, compteur visible, compte admin illimité, refus clair quand la limite est atteinte ; la recherche automatique ne dépense jamais ces dossiers
- [ ] Tests (135) et vérification sur mobile et ordinateur faits ; base Supabase déjà mise à jour ; reste la mise en ligne du code (deploy-job-hunter.bat)

## Sprint 7 — IA moins chère et plus juste (embeddings, RAG, score pour toutes les offres)

Objectif : chaque offre est lue et vectorisée une seule fois pour tout le monde, chaque étudiant voit un score sur toutes ses offres, et l'IA chère ne sert qu'à écrire le CV et la lettre. Constat du 5 octobre : 0 offre vectorisée sur 3 940, 0 résumé partagé, 50 offres scorées sur 604.

- [ ] Clé Gemini payante avec plafond de dépenses (le niveau gratuit peut entraîner Google sur les CV : problème RGPD)
- [x] Lecteur partagé (Gemini 2.5 Flash-Lite, en lot) : résumé, compétences, mots-clés, salaire, niveau et télétravail de chaque offre, une seule fois
- [ ] Lecteur du CV : même fiche structurée pour le profil de l'étudiant, et ses expériences découpées en preuves
- [x] Embedding de chaque offre (gemini-embedding-001, 768 dimensions), calculé une seule fois et partagé. Cause trouvée le 6 octobre : gemini-embedding-2 renvoyait 1 seul vecteur pour 50 offres, d'où 0 offre vectorisée
- [x] Score rapide pour toutes les offres : proximité des vecteurs + compétences en commun + filtres (contrat, ville, niveau), calculé en base
- [x] « Pourquoi ce score » écrit sans IA (compétences en commun et manquantes) ; l'analyse approfondie par l'IA reste à la demande, dans le quota du jour
- [ ] RAG pour le CV et la lettre : le générateur ne reçoit que les preuves du CV les plus proches de l'offre
- [ ] Nouvelle offre gratuite : toutes les offres scorées, avec résumé et « pourquoi ce score » (comparaison sans IA, donc gratuite) ; 2 CV et 2 lettres par mois, remis à zéro le 1er
- [ ] Rattrapage : vectoriser et lire les 3 756 offres ouvertes déjà en base (automatique après la mise en ligne : 300 vecteurs et 60 lectures toutes les 10 minutes)
- [x] Suivi des coûts IA par jour dans l'admin
- [x] Espace admin séparé de l'espace étudiant (/admin) : inscrits, actifs, Pro, revenu, coût IA, état du catalogue
- [x] Niveaux de lancement façon jeu dans l'admin (100, 1 000, 8 000 inscrits) avec les étapes à franchir et des points
- [x] Prévision des coûts et seuil de rentabilité (nombre de Pro nécessaires) dans l'admin

## Sprint 8 — Réponses, paiement et lancement public

Objectif : ouvrir l’appli à d’autres étudiants avec un modèle payant légal.

- [ ] Réponses des recruteurs lues dans Gmail et rangées dans le suivi
- [ ] Taux de réponse par entreprise et par catégorie
- [ ] Modèle de paiement validé par un juriste (facturer écoles, CFA ou entreprises plutôt que l’étudiant : article L5321-3 du Code du travail)
- [x] Offre gratuite limitée (par exemple 2 CV et 2 lettres par IA)
- [ ] Offre Pro à 7,99 €/mois par Stripe : CV et lettres sans quota (dans une limite raisonnable) et score détaillé sur toutes les offres ; la recherche reste gratuite pour tous
- [ ] Passer Vercel en Pro (20 $/mois, obligatoire dès qu'on encaisse) et Supabase en Pro (25 $/mois, sauvegardes)
- [ ] Pages publiques : accueil, tarifs, mentions légales, confidentialité (RGPD) — légal fait, tarifs à venir
- [ ] Inscription ouverte et accompagnement du premier usage
- [ ] Suivi des coûts par compte et alertes de dépassement
- [ ] Espace recruteur : publier une offre et voir les profils proches, anonymes et avec l’accord des étudiants

## Plan de lancement : coûts par niveau

Estimation du 6 octobre, coûts mensuels en dollars. Un étudiant gratuit très actif coûte au plus 0,15 $ d'IA par mois (moyenne prévue 0,06 $), un Pro environ 1,50 $, à condition de scorer avec Gemini Flash-Lite (avec Gemini 3.6 Flash, c'est 1,25 $ par étudiant gratuit). Un Pro rapporte environ 7,50 € après les frais Stripe. Héberger nos propres modèles (carte graphique louée 24 h/24 : 175 à 240 $/mois) ne devient intéressant qu'au niveau 3, et seulement pour lire les offres et scorer.

| Niveau | Objectif | Hébergement | IA | Total | Pro pour être rentable |
| --- | --- | --- | --- | --- | --- |
| 1 — Les 100 premiers | 100 inscrits, bêta gratuite | 0 $ (Vercel Hobby et Supabase Free tant qu'on n'encaisse pas) | environ 8 $ | environ 10 $ | aucun (bêta), 2 à 4 dès que Stripe est actif |
| 2 — Les 1 000 | 1 000 inscrits, 40 Pro | 45 $ (Vercel Pro + Supabase Pro) | environ 125 $ | environ 170 $ | 16 |
| 3 — Les 8 000 | 8 000 inscrits, 240 Pro | environ 135 $ | environ 860 $ | environ 1 000 $ | 89 |

## Actions de ton côté

Ces étapes demandent ton compte, tes clés ou ta signature : je ne peux pas les faire à ta place.

- [x] Lancer deploy-job-hunter.bat pour mettre en ligne le dernier bundle
- [x] Régénérer CRON\_SECRET dans Vercel (l’ancien a été collé dans la conversation)
- [ ] Recoller la clé Jooble reçue par e-mail dans Réglages > Sources
- [ ] Activer la protection contre les mots de passe divulgués (Supabase > Authentication)
- [ ] Créer le compte développeur La bonne alternance et demander l’accord d’usage commercial
- [ ] Ajouter LBA\_API\_KEY dans Vercel une fois l’accord obtenu
- [ ] Consulter un juriste sur le modèle de paiement
- [x] Lancer la première collecte : Admin > Collecte plateforme > « Avancer la collecte » (après la mise en ligne)
- [x] Programmer la collecte toutes les 10 min dans Supabase (SQL fourni dans Admin, avec ton nouveau CRON\_SECRET)
- [ ] Demander à Jooble ses conditions d’utilisation écrites (introuvables en ligne)
- [x] Vérifier que le nom LeBonTaf est libre à l’INPI (le domaine lebontaf.com est déjà acheté)
- [ ] Décider : envoi automatique des candidatures, ou validation par l’étudiant avant chaque envoi
- [x] Créer le client OAuth Google (type Web, retour vers Supabase) et coller son Client ID et son secret dans Supabase > Providers > Google
- [x] Acheter le domaine lebontaf.com et le brancher (Vercel, Supabase, Google Cloud)
- [ ] E-mail pro : rediriger contact@lebontaf.com vers Gmail et créer le SMTP (Resend) pour les liens de connexion, DNS chez Spaceship
- [ ] Passer la clé Gemini en offre payante avant l’ouverture au public
- [ ] Désactiver l’ancien secret client Google dans Google Cloud
- [ ] Prouver la propriété de lebontaf.com (Search Console, DNS) et ajouter un logo pour la validation de marque Google
- [ ] Option : acheter lebontaf.fr (OVH ou Gandi, environ 7 € par an)
- [ ] Créer la micro-entreprise avant de faire payer, puis mettre à jour les mentions légales
- [ ] Lancer deploy-job-hunter.bat avec le dernier bundle (nom LeBonTaf, légal, connexion)
