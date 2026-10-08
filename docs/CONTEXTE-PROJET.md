# LeBonTaf — contexte commun pour Codex et Claude

Mis à jour le 8 octobre 2026. Lire cette page au début d’une session, puis les fichiers utiles à la tâche. Les documents datés sont des preuves historiques, pas une autre liste de travail.

## Produit et règles

LeBonTaf aide les étudiants à chercher stages et alternances en France : import du CV, offres classées selon le profil, CV/lettre adaptés et suivi des candidatures. Le périmètre inclut aussi les CDD des métiers informatique, numérique et bureautique.

- Le propriétaire est francophone et non développeur : explications simples.
- L’étudiant confirme son profil et relit ses documents. Aucun envoi automatique de candidature (`PREPARE_ONLY`).
- Offre gratuite actuelle : deux kits CV + lettre par mois. Aucun tarif Pro adopté ; Stripe reste à préparer.
- Plafond de la clé AI Gateway confirmé à **2 USD** ; ne pas le confondre avec le crédit acheté. Aucun achat ou changement du plafond sans instruction.

## Références à lire

1. [Backlog actuel](PRODUCT-BACKLOG.md) : cases cochées des fonctionnalités livrées, six vérifications du pilote et améliorations futures.
2. [Livraison du 7 octobre](MVP-2026-10-07.md) : preuves, migrations et limites connues.
3. `AGENTS.md`, importé aussi par `CLAUDE.md` : consignes communes et règles de la version Next installée.
4. [Spécification v1.1 du nouveau parcours étudiant](SPEC-V1.1-PARCOURS-ETUDIANT-2026-10-07.md) : **en pause** (décision du 7 octobre) — onboarding bloquant, recommandations cumulatives 8/jour, catalogue flouté, écran ville + consigne. Contrat d'API figé avec la session backend ; à relire intégralement avant tout démarrage v1.1.
5. `docs/audits/` : cinq rapports du 7 octobre, tous en lecture du code, aucun parcours vérifié en production. Revue du parcours étudiant (R1 à R25), préparation de MVP-04, sécurité et coûts, attributions et licences des sources, destinataires des données personnelles.
6. [Migrations en attente](MIGRATIONS-EN-ATTENTE-2026-10-08.md) : trois migrations préparées, non appliquées, avec les contrôles avant et après.

## Skills de design dans Claude Code

Trois skills installés au niveau du dépôt dans `.claude/skills/` : `impeccable` (design et audit UI), `taste-skill` (direction visuelle et refonte frontend), `animate` (animations de composants). Leurs licences amont accompagnent chaque dossier. Claude Code les découvre pour ce projet ; ils lisent leurs instructions complètes à la demande. Les agents ne doivent choisir que le skill adapté à la tâche, pas charger les trois pour chaque modification.

Leurs dépôts d’origine et la collection complète restent dans `C:\Users\yassi\Documents\job-hunter-tools`. Les copies du projet sont autonomes pour Claude Code et voyagent avec le dépôt. Si la collection amont évolue, recopier la mise à jour intentionnellement et examiner le diff.

À la prochaine ouverture de Claude Code à la racine de ce projet, essayer `/impeccable` pour le menu du skill ou demander directement un audit UI ; demander une animation à construire pour activer `animate`. Un simple dossier branché dans Claude.ai/Cowork n’a pas la même découverte de skills projet que Claude Code.

Le document sur claude.ai ne se synchronise pas avec le dépôt. Mettre à jour cette page et le backlog après les livraisons ; ne pas recopier tout l’historique.

## État de reprise

- Dernière base Git connue : `main`, commit `b844becd` du 8 octobre, poussé directement sur `main` après relecture. Vérifier `git status` et `git log -3 --oneline` au début de la session : cette référence évolue.
- Les 7 et 8 octobre, 34 commits ont été poussés depuis `f71510e7`, correctifs et documents compris (parcours du nouvel étudiant, écrans sans détails de plateforme, mise à jour depuis le catalogue commun, plafond des révisions IA, route Drive réservée à l’administrateur). Ils sont testés automatiquement mais pas revus à l’écran par le propriétaire : voir « Travaux des 7 et 8 octobre » dans le backlog. Seul MVP-02 est vérifié en production.
- Méthode de travail en cours : plusieurs sessions en parallèle. Une session coordonne, relit chaque diff et pousse ; une session backend (`lib/`, `app/api/`, `supabase/migrations/`, `tests/`) ; une session front (`components/`, pages de `app/`) ; des sessions d’audit en lecture seule (`docs/audits/`) ; des agents « business » qui n’écrivent que dans `docs/business/`. Avant de modifier le backlog ou cette page, la session l’annonce aux autres. Ajouts par `git add` fichier par fichier ; le dossier « capture d’écrant/ » (captures du propriétaire) ne doit jamais être commité.
- Next 16.3.6, React, TypeScript ; Supabase Auth/Postgres/pgvector et Vercel. Worker Railway utilisé dans les parcours de documents.
- SMTP personnalisé Resend activé ; expéditeur, modèles français et réinitialisation complète vérifiés en production par le propriétaire le 7 octobre (MVP-02). Protection des mots de passe divulgués désactivée, réservée à Pro selon l’interface Supabase contrôlée.
- Import PDF numérique via extraction locale puis Gateway ; PDF scannés non pris en charge. Test complet d’import en production encore ouvert après blocage de la permission fichiers de l’extension Chrome.
- Recherche sauvegardée vérifiée sur compte connecté. Classement : essai du propriétaire le 7 octobre non validé (scores trop bas, libellés contradictoires) ; correctifs poussés, revue à refaire (MVP-03). Second essai le 8 octobre, toujours non validé : un tag de proximité contredisait le chiffre. Règle adoptée : une seule grandeur par écran. Le score gratuit est une couverture exacte des compétences demandées ; les listes, le tri et l’onglet « Mieux notées pour mon CV » le suivent ; le score d’une analyse IA n’apparaît que dans le panneau de l’offre. Jamais une probabilité d’embauche.
- Recherche par compte : elle appelle encore les sites d’emploi pour un étudiant. L’interrupteur `STUDENT_CATALOGUE_ONLY=1` (Vercel) la limite au catalogue commun ; il est éteint tant que la collecte de la plateforme n’est pas prouvée. La boîte d’alertes de l’opérateur et le webhook ne servent plus qu’au compte administrateur.
- Avis « business » : cinq agents conseillent et écrivent seulement dans `docs/business/` ; leurs ordres (BIZ-NN) ne valent que si le propriétaire les accepte, et deviennent des tâches par la session de coordination. Lire `docs/business/REGISTRE-DECISIONS.md` avant de reproposer une idée déjà refusée ou reportée.
- Kit CV/lettre réel et deux PDF contrôlés ; nouvelle chaîne import → confirmation → kit et relecture des reformulations encore à vérifier.
- Tests au commit `b844becd` (8 octobre) : 269 tests, 268 réussis, un LaTeX ignoré, contrôle de types réussi. Les 42 assertions PostgreSQL/pgvector datent de la livraison du 7 octobre et n’ont pas été relancées ; les trois migrations du 8 octobre n’ont jamais été exécutées. Ce sont des résultats datés, pas un résultat de test de chaque nouvelle session.
- Collecte et traitements du catalogue fonctionnent en production ; compteurs variables. Ne pas réutiliser les anciens constats « zéro embedding », « 17 stages » ou « recharge Gemini obligatoire » comme état actuel.
- Capacité de 100 utilisateurs non validée par test de charge. La collecte qui alimente le catalogue n’est pas planifiée dans le dépôt : elle dépend d’une tâche Supabase que le propriétaire doit confirmer.
- Ce qui attend le propriétaire (REVUE-01 à REVUE-03 du backlog) : revue visuelle du site, réglages de production à lire dans Vercel et Supabase, décision sur les trois migrations, chemin du PDF de son CV pour MVP-01. Prochaine tâche d’une session : aider à terminer une vérification MVP-01 à MVP-06, sans refaire les fonctionnalités livrées et sans ouvrir de nouvelle fonctionnalité (v1.1 en pause).

## IA actuelle et fichiers utiles

| Sujet | Fonctionnement | Point d’entrée |
| --- | --- | --- |
| Routage IA | Gateway : Qwen3.7 Flash lecture/analyse, GPT-6 Luna rédaction et structuration CV | `lib/ai.ts`, `lib/economics.ts` |
| Import CV | Extraction locale, validation du PDF, brouillon à confirmer | `app/api/profile/import/route.ts`, `lib/cv-pdf.ts` |
| Embeddings | Perplexity `pplx-embed-v1-0.6b`, 1 024 dimensions ; profils et offres dans le même espace versionné | Rechercher « perplexity » et les RPC dans `lib/` et `supabase/migrations/` |
| Comparaison | Compétences et proximité calculées ; pas de LLM obligatoire par étudiant/offre | Rechercher classement/score dans `lib/` et les migrations |
| Kit CV/lettre | Preuves du profil confirmé, un appel pour les deux documents, cache de version | `app/api/`, `lib/` ; rechercher « truth » et « generation » |
| Quotas et concurrence | Compteur indisponible = refus ; réservations serveur des traitements payants | Migration `20261007111753_mvp_generation_and_reader_leases.sql` |
| Catalogue | Collecte commune, lecture et embeddings réutilisés ; disponibilité sans LLM | `app/api/cron/`, `supabase/migrations/` |

La sélection des preuves réduit le contexte envoyé au modèle ; elle ne garantit pas la vérité de toute reformulation. Relecture obligatoire. Les détails et résultats du comparatif sont liés depuis le backlog.

## Carte Graphify locale

Carte canonique : `graphify-out/graph.json`, visualisation `graphify-out/graph.html`, rapport `graphify-out/GRAPH_REPORT.md`, fraîcheur `graphify-out/manifest.json`.

La date, le mode d’extraction et l’empreinte de la carte sont aussi enregistrés dans `graphify-out/PROJECT-MAP-STATUS.json`. Ces sorties locales sont ignorées par Git ; sur une autre machine, les reconstruire à partir du dépôt avec Graphify installé.

Reconstruction locale depuis la racine du dépôt :

```powershell
powershell -NoProfile -File tools/update-project-map.ps1
```

Le script utilise le Python Graphify installé, extrait le code et les migrations sans LLM, garde un cache local et exclut secrets, données privées et fichiers générés. Les documents ne sont pas analysés sémantiquement : cette page et le backlog apportent le contexte produit. L’ancienne carte du 5 octobre dans `job-hunter-tools/lebontaf-map` reste historique.

La commande doit être exécutée après une modification du code ; aucune surveillance permanente n’est activée. Une nouvelle session vérifie le manifeste et utilise la carte pour cibler sa lecture. Les parseurs peuvent manquer certaines constructions : vérifier le code source avant toute décision.

Lors de l’extraction du 7 octobre : quatre fichiers partiellement compris (`MainActivity.kt`, `CaptureService.kt`, `OverlayService.kt`, `lib/latex.ts`) et dix-neuf fichiers sans symboles reconnus, dont certaines migrations SQL. Le modèle ne doit pas conclure qu’une fonction est absente sur la seule base de cette carte. Le modèle d’e-mail `reset-password.html` est exclu par le détecteur de fichiers sensibles.

Contrôle final : **1 840 nœuds, 4 595 liens** ; recherche ciblée sur import/profil/génération réussie. Diagnostic du graphe exporté : aucun lien avec extrémité absente, aucun doublon exact ; onze liens d’un nœud vers lui-même. Ce diagnostic ne garantit pas que les parseurs ont trouvé tous les liens du code. Deuxième exécution : 268 fichiers inchangés réutilisés, deux réextraits ; aucune lecture LLM des documents.

## Vérification des changements

Commandes du dépôt : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Adapter les contrôles au changement : une correction de documentation nécessite surtout liens, cohérence et `git diff --check`.

Préserver les fichiers et modifications d’autres sessions. N’enregistrer aucun secret dans la passation. Lors d’une reprise, commencer par l’état Git, puis la tâche du backlog ; ne pas relire les archives entières sans besoin.
