# Préparation de la vérification MVP-04 — collecte, traitement et retrait des offres

Date : 7 octobre 2026. Travail fait **en lecture seule** : aucun code modifié, aucune route de production appelée, aucune collecte lancée, aucun accès à la base de production, aucun budget consommé. Les fichiers `.env*` n'ont pas été lus.

Critère MVP-04 du backlog : « La file progresse, les erreurs et textes insuffisants sont visibles, un retrait confirmé empêche la génération. Les offres inchangées ne sont pas relues ou vectorisées à chaque recherche. »

Deux mentions reviennent partout :

- **[Lu]** = établi par lecture du code et des migrations du dépôt.
- **[Prod ?]** = à confirmer en production (le dépôt ne suffit pas à le savoir).

## 0. État du dépôt au moment de la lecture

- Dernier commit : `db2633ed` (« tell a new account to choose a job before any offer can arrive »), qui ne touche que `components/views/settings-view.tsx`.
- **Fichiers en cours de modification par une autre session (non commités)** : `lib/pipeline/server.ts`, `lib/scan/config.ts`, `lib/scan/index.ts`, `lib/scan/types.ts`, plus trois fichiers de tests. Le changement en cours : un compte qui n'a choisi ni métier, ni mot-clé, ni entreprise n'est plus recherché du tout (`hasChosenSearch`), et les réglages par défaut d'un nouveau compte deviennent vides (plus de « Paris / développeur » par défaut). À traiter comme provisoire.
- **Numéros de ligne** : pour `lib/pipeline/server.ts` et `lib/scan/index.ts`, les lignes citées sont celles du commit `db2633ed`. Dans la copie de travail, elles sont décalées de quelques lignes (+1 à +5).
- La route `POST /api/catalogue/refresh` **n'existe pas encore** dans le dépôt : `app/api/catalogue/` ne contient que `counts/route.ts`.
- Carte Graphify datée du 7 octobre 16:42 UTC, donc antérieure aux derniers commits : elle n'a servi qu'à repérer des fichiers.
- Next installé : les réglages de route utilisés ici (`maxDuration`, `dynamic = "force-dynamic"`) figurent bien dans la documentation embarquée (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/`). Je n'ai vérifié que leur présence, pas leur comportement détaillé.
- `docs/SCANNER.md` est en partie dépassé : son début parle encore de score Gemini, de dossiers écrits tout seuls au-dessus de 80 et de recherche à l'ouverture de l'application. Les sections 6b, 6c et 7 correspondent au code actuel.

## 1. Le trajet d'une offre, étape par étape

### Étape A — Collecte commune (pour toute la plateforme)

- **Ce qui se passe** : deux collectes par jour, prévues à 04:00 et 12:00 UTC (`lib/scan/harvest.ts:36`, `:39-46`). Chaque collecte est une liste de tâches rangée dans les tables `harvest_runs` et `harvest_tasks` (`harvest.ts:237-247`).
  - France Travail : 18 régions × 6 familles de contrats = 108 tâches (`harvest.ts:49-78`, `:121-124`), découpées par département quand une région dépasse 3 150 offres (`harvest.ts:290`, `:326-341`).
  - Pages carrière des entreprises : au plus 300 (`harvest.ts:82`, `:103-117`).
  - Adzuna : 11 métiers × 2 contrats × 5 villes = 110 tâches, **le matin seulement** (`harvest.ts:80-81`, `:126-131`).
- **Qui déclenche** :
  - `app/api/cron/harvest/route.ts:19-30`, protégé par `CRON_SECRET`.
  - **[Lu]** `vercel.json` ne contient **aucune** ligne pour cette route (il ne planifie que `/api/cron/tick`, `vercel.json:5-10`).
  - La collecte dépend donc d'une tâche **pg_cron dans Supabase**, décrite seulement dans la documentation (`docs/SCANNER.md:162-166`) et dans l'écran Admin (`components/views/admin-view.tsx:512-528`), « toutes les 10 minutes ». **[Prod ?]** son existence, sa fréquence et l'adresse appelée.
  - Sinon : bouton admin « Avancer la collecte » (`app/api/admin/harvest/route.ts:37-45`, `admin-view.tsx:506-510`).
- **Par lots de combien** : chaque appel travaille environ 45 secondes (`harvest.ts:197`), prend les tâches par 20 (`harvest.ts:344-350`), lit France Travail par pages de 150 offres (`lib/scan/sources/francetravail.ts:89`) et enregistre par 200 (`lib/scan/catalogue.ts:96-97`). Il reprend où il s'était arrêté grâce à `harvest_tasks.next_index` (`harvest.ts:273`, `:295`).
- **Fin de collecte** : quand plus aucune tâche n'attend, le code ferme les offres disparues, fait expirer les anciennes et note le bilan dans `harvest_runs.counters` (`harvest.ts:371-400`).

### Étape B — Dédoublonnage

- **Dans le catalogue commun** : une offre = une « empreinte » (entreprise + intitulé nettoyé + ville + type de contrat, `lib/scan/dedupe.ts:68-75` ; sans entreprise connue, c'est le lien, `catalogue.ts:30-32`). La colonne `offers.fingerprint` est unique (`supabase/migrations/20261003090000_offers_catalogue.sql:18`). Une offre déjà connue n'est pas recréée : seule sa date « vue pour la dernière fois » avance (fonction SQL `upsert_offers`, `20261006090000_offer_journey_free_plan.sql:124-139`).
- **Dans la liste de chaque étudiant** : même lien, puis même empreinte, puis texte très proche (`lib/scan/ingest.ts:113-124`). Les doublons probables vont dans « À vérifier » (`ingest.ts:133-150`).
- **Déclencheur** : automatique, à chaque enregistrement. Aucun coût IA.

### Étape C — Lecture et résumé (une seule fois pour tout le monde)

- **Ce qui se passe** : `lib/offer-reader.ts:67-124` fait lire chaque offre ouverte sans résumé par le modèle le moins cher, et range le résultat dans `offers.summary` (missions, outils, conditions, compétences, niveau, télétravail).
- **Qui déclenche** : la même route de collecte, à la fin de chaque tranche (`harvest.ts:222-230`, appelée en `:251` et `:366`). Il n'y a pas de planification séparée.
- **Par lots** : au plus 60 offres par tranche, 6 en parallèle (`harvest.ts:224`). 20 secondes sont réservées à la lecture pour que les embeddings ne prennent pas tout le temps (`harvest.ts:205-206`). Les 6 000 premiers caractères du texte sont envoyés (`offer-reader.ts:38`).
- **Condition** : texte d'au moins 120 caractères (`20261007111753_mvp_generation_and_reader_leases.sql:51`, `offer-reader.ts:85`). En dessous, l'offre n'est jamais lue.
- **Point d'attention [Lu]** : pendant qu'une collecte a encore des tâches, la boucle des tâches consomme le temps jusqu'à 6 secondes restantes (`harvest.ts:343`), alors que la lecture en demande 15 et les embeddings 10 (`harvest.ts:207`, `:222`). La lecture et les embeddings avancent donc surtout **entre** deux collectes, pas pendant.

### Étape D — Embeddings (vecteurs)

- **Ce qui se passe** : `lib/semantic-embeddings.ts:37-57` calcule un vecteur Perplexity de 1 024 dimensions par offre ouverte qui n'en a pas, rangé dans `offers.semantic_embedding`.
- **Qui déclenche** : la tranche de collecte (`harvest.ts:207-212`), si `EMBEDDING_PROVIDER=gateway`. Il existe aussi une route de rattrapage manuelle `POST /api/cron/embeddings` (`app/api/cron/embeddings/route.ts:7-9`, `lib/embedding-backfill.ts:13-30`), qui n'est planifiée nulle part dans le dépôt.
- **Par lots** : au plus 300 offres par tranche, par paquets de 50 (`harvest.ts:209`, `semantic-embeddings.ts:39-41`).

### Étape E — Copie dans la liste de chaque étudiant

Trois chemins **[Lu]** :

1. **À l'enregistrement des réglages** : `app/api/settings/route.ts:55-56` appelle `seedFromCatalogue` (`lib/scan/index.ts:479-489`). Aucun site d'emploi n'est appelé. C'est le seul endroit où `seedFromCatalogue` est utilisé aujourd'hui.
2. **Passage planifié** `app/api/cron/tick/route.ts:22-35` → `lib/pipeline/server.ts:56` :
   - déclenché par Vercel une fois par jour à 06:00 UTC (`vercel.json:6-9`) ; la documentation prévoit en plus un pg_cron toutes les 30 minutes (`docs/SCANNER.md:104-120`) **[Prod ?]** ;
   - **2 comptes au plus par appel**, un compte au plus toutes les 12 heures (`server.ts:63`, `:80-88`) ;
   - pour chaque compte : recherche complète (`runScan`, `lib/scan/index.ts:102`), qui pioche d'abord dans le catalogue (`index.ts:135`), puis n'appelle les sites que pour ce que le catalogue ne couvre pas déjà (`index.ts:142`, `:249-253`), avec un cache commun de 12 heures (`index.ts:268-277`) ;
   - puis comparaison gratuite des compétences pour 40 offres en attente au plus (`server.ts:116-123`, `lib/pipeline/compare.ts:11`) ;
   - puis dossiers automatiques pour 10 offres au plus avec un score ≥ 80 (`server.ts:170-177`) — refusés pour les comptes gratuits (`lib/plan.ts:86-91`).
3. **Bouton de l'étudiant** « Mettre à jour mes offres » (`components/views/home-view.tsx:233`) → `POST /api/scan` (`app/api/scan/route.ts:13-32`), limité à 3 recherches par jour (`lib/quota.ts:12`).

À l'ouverture de l'application : **[Lu]** la recherche automatique à l'ouverture est coupée dès que le serveur a `CRON_SECRET` et la clé de service (`components/use-pipeline.ts:70`, `app/api/status/route.ts:47`). En production, l'ouverture de l'application ne rafraîchit donc pas la liste.

Volumes de la copie : 3 000 offres ouvertes examinées (`catalogue.ts:178`, `:197-203`), 300 gardées par mots et métiers plus 40 proches du CV (`catalogue.ts:180-182`), insérées par 50 (`ingest.ts:206`). Une offre que le catalogue sait fermée n'est pas proposée (`ingest.ts:126-131`).

### Étape F — Affichage

- `components/use-dashboard-data.ts:40` charge toutes les offres du compte avec le résumé et le salaire du catalogue. Le score gratuit vient d'une fonction SQL (`use-dashboard-data.ts:69`, `my_job_fit_v2` dans `20261006145105_versioned_perplexity_vectors.sql:98-109`) : aucun appel IA.
- Mise à jour en direct quand la table `jobs` change (`use-dashboard-data.ts:109-116`). Liste affichée par 30 (`components/views/jobs-view.tsx:116`).
- À l'ouverture d'une offre sans résumé, le panneau lance la comparaison gratuite, pas une lecture IA (`components/views/offer-panel.tsx:148-154`, `app/api/jobs/[id]/analyze/route.ts:12`).

## 2. Ce qui empêche de relire ou de vectoriser une offre inchangée

### Ce que le code garantit [Lu]

- **Une recherche d'étudiant ne lit et ne vectorise aucune offre.** `runScan`, `seedFromCatalogue`, l'affichage et l'ouverture d'une offre n'appellent ni le lecteur ni le calcul de vecteurs d'offres. Le seul vecteur calculé côté étudiant est celui de son profil, et seulement si le profil a changé (empreinte comparée, `semantic-embeddings.ts:69-71`).
- **Une offre revue par la collecte garde son résumé et son vecteur** : `upsert_offers` ne change que la date de dernière vue, sauf si le nouveau texte est plus long (`20261006090000_offer_journey_free_plan.sql:124-139`).
- **Résumé effacé seulement si le contenu change** : déclencheur `invalidate_offer_reading` sur titre, entreprise, lieu, contrat, texte (`20261007111753_mvp_generation_and_reader_leases.sql:32-45`).
- **Vecteur effacé seulement si le contenu change** : déclencheur `invalidate_semantic_embedding` sur texte, titre, lieu, contrat, métiers (`20261006145105_versioned_perplexity_vectors.sql:8-21`).
- **Réservations de 2 minutes** pour qu'une offre ne soit pas traitée deux fois en même temps : lecture (`claim_offer_readings`, `...leases.sql:47-60`) et vecteurs (`claim_semantic_offers`, `...vectors.sql:40-50`). Le résultat n'est enregistré que si le texte n'a pas bougé entre-temps (`...leases.sql:61-69`, `...vectors.sql:25-36`).
- **Cache de disponibilité** : la vérification « encore en ligne ? » est gardée 1 heure si la réponse est nette, 5 minutes si elle est incertaine (`lib/pipeline/availability.ts:48-60`).
- **Cache des recherches** : une même requête sur un site d'emploi n'est faite qu'une fois par 12 heures pour tous les comptes (`lib/scan/health.ts:121-150`).
- **Kit CV/lettre** : même profil + même offre + même modèle = documents existants rendus sans nouvel appel (`lib/pipeline/generate.ts:90-100`).

### Où le code peut retraiter inutilement [Lu, effet réel à mesurer en production]

1. **Lecture ratée, retentée sans fin.** Si le modèle répond un texte inexploitable, l'offre reste sans résumé, sa réservation est libérée et elle est reprise à la tranche suivante, avec un nouvel appel payant à chaque fois. Aucun compteur d'essais (`lib/offer-reader.ts:96-100`, `:117-121`).
2. **Offre France Travail qui « clignote ».** Quand France Travail retire une offre, son texte est effacé (`20261004180000_close_offer_ft_anonymize.sql:26-27`), donc son résumé et son vecteur aussi. Si elle réapparaît, elle est relue et revectorisée. Normal une fois ; coûteux si la même offre alterne (voir l'écart M5).
3. **Texte plus long venu d'une autre source** : relance une lecture et un vecteur. Voulu, mais c'est un retraitement.
4. **Métiers recalculés** : si une source donne des métiers différents pour la même offre, le vecteur est refait (`...free_plan.sql:137`, `...vectors.sql:12`). Cas rare a priori.
5. **Si `AI_READER_LEASES` n'était pas à `1`** : l'ancien mode prend toujours les 60 offres les plus récentes sans résumé ; des offres au texte trop court en tête de liste bloqueraient les autres (`offer-reader.ts:76-85`). `docs/MVP-2026-10-07.md:16` indique que le réglage est à `1` en production **[Prod ?]**.

## 3. Le retrait d'une offre

### Comment une offre est détectée retirée ou close [Lu]

| Signal | Où | État dans le catalogue | Message posé sur la copie de l'étudiant |
| --- | --- | --- | --- |
| Plus vue depuis 21 jours | `expire_offers`, `20261003090000_offers_catalogue.sql:152-173` ; appelée en fin de collecte (`harvest.ts:383`) et à chaque recherche de compte (`lib/scan/index.ts:382`) | `expired` / `not_seen` | « Plus vue sur aucun site depuis 21 jours… » |
| Absente de la page carrière lue en entier | `close_board_offers`, `...catalogue.sql:178-199` ; `harvest.ts:306` | `closed` / `board` | « Retirée de la page carrière de l'entreprise. » |
| Absente d'une collecte France Travail **complète** | `close_unseen_offers`, `20261004180000_close_offer_ft_anonymize.sql:19-45` ; `harvest.ts:372-382` | `closed` / `not_seen`, texte effacé | « Retirée par France Travail. » |
| Signalée par l'étudiant | `report_offer_gone`, `20261003120000_offer_reports_threshold.sql:3-35` | inchangé jusqu'à 10 signalements, puis `closed` / `reported` | « Tu as signalé que cette offre n'est plus disponible. » |
| Page introuvable juste avant d'écrire le CV | `lib/pipeline/availability.ts:19-45`, `:63-76` ; `close_offer`, `...ft_anonymize.sql:2-14` | `closed` / `board` | « … Vérifié juste avant de créer le CV. » |

États existants : `offers.status` vaut `open`, `expired` ou `closed` ; `offers.closed_reason` vaut `not_seen`, `board` ou `reported` (`...catalogue.sql:31-32`). Côté étudiant : `jobs.gone_reason` (texte) et `jobs.gone_at` (`...catalogue.sql:58-59`).

Une offre fermée redevient ouverte si une source la remontre, sauf si elle a été fermée par signalements (`...free_plan.sql:103-106`, `:126-128`, `:142-146`).

**Qui reçoit le message** : la fonction `flag_gone_offers` ne marque que les copies pas encore marquées et dont le statut n'est ni « candidature envoyée », ni « écartée » (`...catalogue.sql:77-92`).

**Erreur réseau = « inconnu », pas « retirée » [Lu] — conforme.** Seules des réponses nettes comptent : 204, 404 ou 410 de France Travail (`availability.ts:29-30`), 404 ou 410 d'une page (`availability.ts:40`). Délai dépassé, refus aux robots (403), redirection, adresse privée ou panne : résultat `null`, l'offre n'est pas touchée (`availability.ts:31`, `:34`, `:41-44`). Couvert par `tests/availability-cache.test.ts:21` et `tests/server-pipeline.test.ts:283`. De même, une collecte France Travail avec une seule tâche en erreur ne ferme rien (`harvest.ts:372-374`, `tests/harvest.test.ts:117`), et une page carrière en erreur ne ferme rien (`harvest.ts:306`).

### Ce qui se passe ensuite, parcours par parcours [Lu]

| Parcours | Comportement | Fichier |
| --- | --- | --- |
| Liste d'offres | L'offre quitte « Nouvelles » et « Proches de mon CV », passe dans l'onglet « Plus disponibles », avec l'étiquette rouge « Plus disponible ». Elle reste dans « Toutes ». | `components/views/jobs-view.tsx:19-26`, `:70-78` ; `components/views/offer-card.tsx:83`, `:120` |
| Accueil | Absente des nouvelles offres et de « À faire aujourd'hui ». | `components/views/home-view.tsx:89` ; `lib/journey.ts:94` |
| Panneau d'offre | Encadré rouge avec la raison, boutons « Elle est toujours en ligne » et « Écarter ». Le bouton « Créer mon CV et ma lettre » et « Analyse approfondie » sont masqués. | `components/views/offer-panel.tsx:122`, `:192-206`, `:283`, `:367` |
| « Mon suivi » | L'offre **reste dans sa colonne**, sans aucune marque. Il faut l'ouvrir pour voir qu'elle est retirée. | `components/views/track-view.tsx:19-28`, `:68-92` |
| Documents déjà générés | Ils restent visibles, téléchargeables et modifiables. Rien n'est supprimé. | `offer-panel.tsx:400-417` ; `app/api/documents/[id]/pdf/route.ts:29-41` |
| Dossier prêt puis offre retirée | « Postuler sur le site » et « J'ai postulé » restent affichés sous l'encadré rouge. | `offer-panel.tsx:418-430` |
| Candidature déjà envoyée | Rien ne change : pas de message, pas d'étiquette. | `...catalogue.sql:88` ; `offer-panel.tsx:122` |
| Bouton de génération | Masqué (voir panneau). | `offer-panel.tsx:367` |
| Route de génération, côté serveur | Refus **410**, code `GONE`, avant tout appel IA et avant le décompte du quota. | `lib/pipeline/generate.ts:66-70` |
| Comparaison et analyse, côté serveur | Refus 410 aussi. | `lib/pipeline/compare.ts:18` ; `lib/pipeline/analyze.ts:146-150` |
| Passage planifié | Les offres retirées ne sont plus comparées. | `lib/pipeline/server.ts:125` |

### La génération est-elle vraiment refusée côté serveur ?

**Oui pour le cas simple, non de façon sûre. [Lu]**

- Le refus existe côté serveur, pas seulement dans l'interface : `generate.ts:66-70` renvoie 410 si `jobs.gone_reason` est rempli. Deuxième filet : une vérification en ligne juste avant d'écrire (`generate.ts:77-87`, branchée dans `app/api/jobs/[id]/generate/route.ts:19`). Testé par `tests/catalogue.test.ts:134` et `tests/server-pipeline.test.ts:259`.
- **Mais le serveur ne regarde que la copie de l'étudiant (`jobs.gone_reason`), jamais l'état du catalogue (`offers.status`).** Or cette copie peut être remise à zéro par l'étudiant lui-même :
  - le bouton « Elle est toujours en ligne » efface le message **quelle que soit la raison**, y compris « Retirée par France Travail » ou « Signalée par 10 candidats » (`app/api/jobs/[id]/availability/route.ts:35-43`, `offer-panel.tsx:198`) ;
  - la règle d'accès de la table `jobs` laisse chaque compte modifier toutes les colonnes de ses propres lignes (`supabase/migrations/20260916181531_optimize_rls_and_foreign_keys.sql:3`).
- Après cet effacement, il ne reste que la vérification en ligne. Si elle répond « inconnu » (site qui refuse les robots, redirection, page d'accueil qui répond 200), la génération **se poursuit** sur une offre que le catalogue tient pour fermée.
- Autre trou : une offre **écartée** par l'étudiant n'est pas marquée quand elle ferme (`...catalogue.sql:88`). S'il la remet ensuite dans ses offres (`offer-panel.tsx:538-541`, `lib/journey.ts:124`), elle s'affiche comme disponible.

C'est l'écart principal face à « un retrait confirmé empêche la génération » (écart E1).

## 4. Visibilité des erreurs

### Ce que l'administrateur voit [Lu]

| Information | Écran | Source |
| --- | --- | --- |
| Avancement de la collecte : dernière collecte, état, « X/Y tâches », offres ouvertes, résultat par source, nombre d'offres retirées | Admin → onglet **Plateforme** → « Collecte plateforme (2 fois par jour) » | `admin-view.tsx:459-491` ; `app/api/admin/harvest/route.ts:19-34` |
| Tâches de collecte en erreur (10 premières de la dernière collecte) | même bloc, « N tâche(s) en erreur » | `admin-view.tsx:492-503` ; `admin/harvest/route.ts:30` |
| État de chaque source, dernier passage, problèmes sur 7 jours, budget gratuit | « Points de recherche » | `lib/admin/overview.ts:120-166` |
| Alertes de source (quota, clé refusée, erreur), une par source et par problème toutes les 6 heures | « Alertes des sources » | `20260928090000_source_health_admin.sql:85-145` |
| « N illisibles » par source | « Points de recherche » | `...source_health_admin.sql:233` ; `admin-view.tsx:380` |
| Part des offres résumées et vectorisées | Admin → onglet **Croissance** → « Catalogue d'offres » | `components/admin/growth-view.tsx:523-541` ; `20261007090000_admin_growth.sql:51-54` |
| Recherche automatique pas passée depuis plus d'un jour | « À faire manuellement » | `overview.ts:216-219` |
| Coût IA | « Coût IA par compte (30 jours) » | `...leases.sql:80-91` |

### Ce qui échoue en silence [Lu]

1. **Erreurs de lecture et de vecteurs.** Elles sont seulement dans la réponse de la route (`harvest.ts:211`, `:218`, `:226-228`). Elles ne sont écrites dans aucune table : le bilan `harvest_runs.counters` ne contient ni lectures, ni vecteurs, ni leurs erreurs (`harvest.ts:386`). Le message du bouton « Avancer la collecte » n'affiche ni `errors`, ni `read`, ni `embedded` (`admin-view.tsx:424-429`).
2. **Textes insuffisants (moins de 120 caractères).** Jamais lus, sans état « texte insuffisant », non comptés, affichés nulle part. Le « N illisibles » de l'admin compte autre chose : les copies d'étudiants **sans aucun texte** (`...source_health_admin.sql:233`), pas les offres du catalogue au texte trop court.
3. **Côté étudiant, texte trop court** : le panneau annonce « Le résumé arrive dès que l'offre est lue, quelques minutes après son arrivée », ce qui n'arrivera jamais (`offer-panel.tsx:348-352`).
4. **Barre « Vectorisées » probablement fausse** : elle compte l'ancienne colonne `embedding` (Gemini), pas `semantic_embedding` (Perplexity) (`20261007090000_admin_growth.sql:53`). Avec Perplexity actif, elle peut afficher un chiffre bas ou figé et le message « Sans vecteurs, le classement ne marche pas » alors que tout va bien **[Prod ?]**.
5. **Collecte abandonnée.** Si une collecte n'est pas finie quand l'heure de la suivante arrive, la nouvelle démarre et l'ancienne reste « En cours » pour toujours : ses fermetures France Travail ne sont jamais faites, sans alerte (`harvest.ts:201`, `:234-254`). L'écran ne montre que la dernière collecte (`admin-view.tsx:438`).
6. **Pages carrière** : la fin de collecte n'enregistre la santé que de France Travail et Adzuna (`harvest.ts:393-394`). Une page carrière en erreur n'apparaît que dans la liste des 10 tâches en erreur.
7. **Fonctions de fermeture** : une erreur SQL de `close_board_offers` ou `expire_offers` est ramenée à « 0 fermée » sans message (`catalogue.ts:108-109`, `:115-116`).
8. **Enregistrement des coûts** : ne plante jamais et ne dit rien s'il échoue (`lib/ai-usage.ts:26-28`).
9. **Tâches cron** : si la tâche pg_cron s'arrête ou appelle une mauvaise adresse, rien dans l'application ne le dit pour la collecte (l'alerte « pas tournée depuis plus d'un jour » ne concerne que `/api/cron/tick`).

## 5. Écarts entre le critère MVP-04 et le code

### Gravité élevée

| N° | Écart | Où | Pour qui |
| --- | --- | --- | --- |
| E1 | **Un retrait confirmé n'empêche pas sûrement la génération.** Le serveur ne contrôle que `jobs.gone_reason`, que l'étudiant peut effacer (bouton « Elle est toujours en ligne » sans distinction de raison, ou écriture directe). `offers.status` n'est jamais consulté. | `lib/pipeline/generate.ts:66-87` ; `app/api/jobs/[id]/availability/route.ts:35-43` ; `components/views/offer-panel.tsx:198` ; `20260916181531_optimize_rls_and_foreign_keys.sql:3` | **Backend** (refuser d'après `offers.status`) ; **propriétaire** (quelles raisons un étudiant peut-il annuler ? « plus vue depuis 21 jours » oui, « retirée par France Travail » ?) |
| E2 | **La collecte ne tient qu'à une tâche pg_cron absente du dépôt.** `vercel.json` ne planifie pas `/api/cron/harvest`. Si la tâche manque ou vise une ancienne adresse, la file n'avance que par le bouton admin. | `vercel.json:5-10` ; `docs/SCANNER.md:162-166` ; `admin-view.tsx:518-527` | **Coordinateur / propriétaire** : à confirmer en production (étape 1 du protocole). Bloquant seulement si la tâche manque. |

### Gravité moyenne

| N° | Écart | Où | Pour qui |
| --- | --- | --- | --- |
| M1 | Erreurs de lecture et de vecteurs non enregistrées et non affichées. | `lib/scan/harvest.ts:211`, `:226-228`, `:386` ; `admin-view.tsx:424-429` | Backend, puis front |
| M2 | Textes insuffisants invisibles : aucun état, aucun compteur. | `...leases.sql:51` ; `lib/offer-reader.ts:85` ; `...source_health_admin.sql:233` | Backend, puis front |
| M3 | Lecture ratée retentée à chaque tranche, sans limite : dépense répétée. | `lib/offer-reader.ts:96-100`, `:117-121` | Backend (touche au budget) |
| M4 | Barre « Vectorisées » calculée sur l'ancienne colonne. | `20261007090000_admin_growth.sql:53` ; `growth-view.tsx:536-541` ; `lib/admin/levels.ts:99` | Backend |
| M5 | Risque de faux « Retirée par France Travail » : une offre France Travail entrée par une recherche par mots-clés, mais hors des familles de contrats de la collecte, n'est jamais revue par la collecte ; elle serait fermée et son texte effacé à chaque collecte complète. **Hypothèse à mesurer.** | `...ft_anonymize.sql:28-31` ; `harvest.ts:71-78` ; `lib/scan/categories.ts:193-200` | Backend ; requête Q9 |
| M6 | Collecte non terminée avant la suivante : reste « En cours », fermetures France Travail non faites, sans alerte. | `harvest.ts:201`, `:234-254` ; `admin-view.tsx:438` | Backend |
| M7 | Le passage planifié reprend à chaque fois les offres retirées bien notées : une erreur par passage, et elles peuvent occuper les 10 places. **Fichier en cours de modification.** | `lib/pipeline/server.ts:170-177` (commit `db2633ed`) | Backend |
| M8 | Offre écartée puis fermée : non marquée ; remise dans la liste, elle paraît disponible. | `...catalogue.sql:88` ; `lib/journey.ts:124` ; `offer-panel.tsx:538-541` | Backend (se règle avec E1) |
| M9 | Rafraîchissement des listes : 2 comptes par passage ; rien à l'ouverture de l'application en production ; `seedFromCatalogue` seulement à l'enregistrement des réglages. Avec le seul cron Vercel : 2 comptes par jour. **Sujet en cours côté backend (`/api/catalogue/refresh`).** | `server.ts:80-88` ; `components/use-pipeline.ts:70` ; `app/api/settings/route.ts:55-56` | Coordinateur |

### Gravité faible

| N° | Écart | Où | Pour qui |
| --- | --- | --- | --- |
| F1 | « Mon suivi » ne marque pas les offres retirées. | `track-view.tsx:68-92` | Front |
| F2 | Dossier prêt + offre retirée : « Postuler sur le site » reste proposé. | `offer-panel.tsx:418-430` | Front |
| F3 | Texte trop court : le panneau promet un résumé qui ne viendra pas. | `offer-panel.tsx:348-352` | Front |
| F4 | Révision d'un document par l'IA (payante) possible sur une offre retirée, alors que le message dit « Rien ne sera plus dépensé dessus ». | `app/api/documents/[id]/revise/route.ts:45-48` ; `availability/route.ts:31` | Propriétaire (règle), puis backend |
| F5 | Une seule réponse 404 vue pour un étudiant ferme l'offre pour tout le monde (elle rouvre si une source la remontre). | `availability.ts:40`, `:75` ; `...ft_anonymize.sql:2-14` | Backend, à surveiller |
| F6 | Page carrière renvoyant une liste vide, ou SmartRecruiters limité à 100 annonces : fermetures à tort possibles. | `lib/scan/sources/ats.ts:239`, `:294-296` ; `...catalogue.sql:190` | Backend, à confirmer |
| F7 | « Elle est toujours en ligne » ne retire pas le signalement de `offer_reports` : il compte toujours vers les 10. | `availability/route.ts:35-40` ; `20261003120000_offer_reports_threshold.sql:25-27` | Backend |
| F8 | Lecture et vecteurs n'avancent presque pas pendant qu'une collecte a des tâches. | `harvest.ts:343`, `:207`, `:222` | Backend, à mesurer |
| F9 | `docs/SCANNER.md` en partie dépassé ; l'adresse du modèle pg_cron est `job-hunter-control.vercel.app` alors que la production est sur `lebontaf.com`. | `docs/SCANNER.md:3-6`, `:114` ; `admin-view.tsx:523` | Coordinateur |

### Conforme au critère [Lu]

- La file est reprise où elle s'était arrêtée et un appel ne dépasse pas la limite de temps.
- Une erreur de source ou de réseau ne ferme jamais d'offre.
- Une recherche d'étudiant ne relit et ne revectorise aucune offre.
- Le refus 410 existe bien côté serveur pour une offre marquée retirée, avant toute dépense.

## 6. Protocole de vérification en production

Légende : **[Lecture]** ne change rien et ne coûte rien. **[Modifie]** écrit des données. **[Budget]** peut dépenser du crédit IA ou des appels de sources. Les étapes [Modifie] et [Budget] sont à décider par le propriétaire.

Toutes les requêtes sont des `SELECT`, à lancer dans Supabase → SQL Editor. Aucune n'affiche de CV, d'e-mail ou de secret. Ne pas interroger `vault.decrypted_secrets`.

### Étape 1 — Les tâches planifiées existent-elles ? [Lecture]

```sql
-- Q1
select jobid, jobname, schedule, active,
       command like '%/api/cron/harvest%' as appelle_collecte,
       command like '%/api/cron/tick%'    as appelle_tick,
       command like '%lebontaf.com%'      as adresse_lebontaf
from cron.job
order by jobname;
```

```sql
-- Q2 : les 20 derniers passages
select j.jobname, d.status, d.start_time, d.end_time, left(d.return_message, 120) as message
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
order by d.start_time desc
limit 20;
```

- **Attendu** : une tâche active pour la collecte (toutes les 5 à 10 minutes) et une pour le tick, statut `succeeded`, vers l'adresse de production actuelle.
- **Échec** : aucune ligne pour la collecte, tâche inactive, dernier passage vieux de plus d'une heure, ou adresse qui n'est plus la bonne (écart E2).
- Si la requête répond que `cron.job` n'existe pas : pg_cron n'est pas installé, donc la collecte ne tourne pas seule.

### Étape 2 — La collecte progresse-t-elle ? [Lecture]

Écran : Admin → **Plateforme** → « Collecte plateforme (2 fois par jour) ». Noter « Dernière collecte », l'état et « X/Y tâches ». Recharger 15 minutes plus tard.

```sql
-- Q3 : les dernières collectes
select id, status, started_at, finished_at, counters
from harvest_runs
order by started_at desc
limit 6;
```

```sql
-- Q4 : détail de la collecte la plus récente
select source, status, count(*) as taches, sum(found) as offres, max(updated_at) as derniere_activite
from harvest_tasks
where run_id = (select id from harvest_runs order by started_at desc limit 1)
group by source, status
order by source, status;
```

- **Attendu** : deux collectes par jour (identifiants finissant par `T04` et `T12`), état `done` ou `partial`, `finished_at` rempli quelques dizaines de minutes à quelques heures après `started_at`. Pendant une collecte, le nombre de tâches `pending` baisse entre deux contrôles.
- **Échec** : collecte ancienne restée `running` alors qu'une plus récente existe (écart M6) ; `pending` qui ne baisse pas ; aucune collecte depuis plus de 12 heures.

### Étape 3 — Les erreurs de source sont-elles visibles ? [Lecture]

Écran : même bloc, « N tâche(s) en erreur » ; puis « Points de recherche » et « Alertes des sources ».

```sql
-- Q5 : tâches en erreur de la dernière collecte
select key, source, left(error, 160) as erreur, updated_at
from harvest_tasks
where run_id = (select id from harvest_runs order by started_at desc limit 1)
  and status = 'error'
order by updated_at desc
limit 30;
```

```sql
-- Q6 : santé des sources sur 7 jours
select source, status, count(*) as passages, max(created_at) as dernier
from source_runs
where created_at > now() - interval '7 days'
group by source, status
order by source, status;
```

- **Attendu** : chaque ligne de Q5 se retrouve dans l'écran (10 au plus) ; les problèmes de Q6 correspondent à une alerte ou à l'état affiché de la source.
- **Échec** : erreurs en base absentes de l'écran ; plus de 10 erreurs sans moyen de voir la suite.

### Étape 4 — La file de lecture et de vecteurs progresse-t-elle ? [Lecture]

Écran : Admin → **Croissance** → « Catalogue d'offres », barres « Résumées » et « Vectorisées ».

```sql
-- Q7 : état de la file (à lancer deux fois, à 30 minutes d'écart)
select
  count(*) filter (where status = 'open')                                              as ouvertes,
  count(*) filter (where status = 'open' and summary is not null)                      as resumees,
  count(*) filter (where status = 'open' and summary is null
                   and length(coalesce(description, '')) >= 120)                       as a_lire,
  count(*) filter (where status = 'open' and summary is null
                   and length(coalesce(description, '')) < 120)                        as texte_insuffisant,
  count(*) filter (where status = 'open' and semantic_embedding is not null)           as vecteurs_perplexity,
  count(*) filter (where status = 'open' and semantic_embedding is null)               as vecteurs_a_faire,
  count(*) filter (where status = 'open' and embedding is not null)                    as vecteurs_ancienne_colonne,
  count(*) filter (where reader_until > now())                                         as lectures_reservees,
  count(*) filter (where semantic_claim_until > now())                                 as vecteurs_reserves
from offers;
```

- **Attendu** : `a_lire` et `vecteurs_a_faire` baissent entre les deux passages, ou sont proches de zéro. `lectures_reservees` et `vecteurs_reserves` reviennent à zéro en moins de 2 minutes.
- **Échec** : `a_lire` stable et élevé alors que les tâches cron passent (lecture bloquée ou en erreur silencieuse, écart M1).
- **À noter pour les écarts** : `texte_insuffisant` > 0 confirme l'écart M2 (ces offres ne sont visibles sur aucun écran). Si la barre « Vectorisées » correspond à `vecteurs_ancienne_colonne` et non à `vecteurs_perplexity`, l'écart M4 est confirmé.

### Étape 5 — Les offres inchangées ne sont pas retraitées [Lecture]

À faire quand aucune collecte n'est en cours (dernière collecte terminée, `a_lire` proche de zéro).

```sql
-- Q8 : travail IA de la plateforme, heure par heure, sur 24 h
select date_trunc('hour', created_at) as heure, task, model,
       count(*) as appels, sum(input_tokens) as jetons_entree, round(sum(cost_usd)::numeric, 5) as usd
from ai_usage
where user_id is null and created_at > now() - interval '24 hours'
group by 1, 2, 3
order by 1 desc, 2;
```

```sql
-- Q8 bis : résumés réellement enregistrés, heure par heure
select date_trunc('hour', (summary ->> 'processed_at')::timestamptz) as heure, count(*) as resumes
from offers
where summary ->> 'processed_at' is not null
  and (summary ->> 'processed_at')::timestamptz > now() - interval '24 hours'
group by 1
order by 1 desc;
```

- **Attendu** : des appels `reading` et `embedding` dans les heures qui suivent une collecte, puis **zéro** entre deux collectes. Sur une même heure, le nombre d'appels `reading` est proche du nombre de résumés enregistrés.
- **Échec** : quelques appels `reading` qui reviennent toutes les 10 minutes sans nouveaux résumés (écart M3 : les mêmes offres relues) ; nettement plus d'appels que de résumés.
- Complément facultatif : après avoir cliqué « Mettre à jour mes offres » avec un compte de test (**[Modifie]**, 1 des 3 recherches du jour, peut appeler un site d'emploi), relancer Q8 : aucune ligne `reading` ni `embedding` avec `user_id` vide ne doit apparaître à cette minute.

### Étape 6 — Les retraits sont-ils cohérents ? [Lecture]

```sql
-- Q9 : offres fermées, par raison
select source, status, closed_reason, count(*) as offres,
       count(*) filter (where closed_at > now() - interval '24 hours') as depuis_24h,
       count(*) filter (where last_seen_at > closed_at)                as revues_apres_fermeture
from offers
where status <> 'open'
group by source, status, closed_reason
order by offres desc;
```

```sql
-- Q10 : copies d'étudiants marquées retirées, par raison et par étape
select left(gone_reason, 60) as raison, stage, status, count(*) as copies
from jobs
where gone_reason is not null
group by 1, 2, 3
order by copies desc;
```

```sql
-- Q11 : incohérences entre le catalogue et les listes
select o.status as etat_catalogue, o.closed_reason, j.status as statut_copie, j.stage, count(*) as copies
from jobs j
join offers o on o.id = j.offer_id
where o.status <> 'open' and j.gone_reason is null
group by 1, 2, 3, 4
order by copies desc;
```

```sql
-- Q12 : résultats des vérifications « encore en ligne ? »
select coalesce(availability_check ->> 'online', 'inconnu') as resultat, count(*) as offres,
       max((availability_check ->> 'checked_at')::timestamptz) as dernier_controle
from offers
where availability_check is not null
group by 1;
```

- **Attendu Q9** : les fermetures France Travail ont `closed_reason = 'not_seen'`, les pages carrière `board`. `revues_apres_fermeture` vaut zéro.
- **Échec Q9** : un grand nombre de fermetures France Travail à chaque collecte, nettement au-dessus du nombre habituel d'offres pourvues (écart M5 à creuser par le backend).
- **Attendu Q11** : uniquement des copies déjà envoyées (`applied`, `interview`, `offer`, `rejected`) ou écartées (`dismissed`).
- **Échec Q11** : des copies `new`, `seen` ou `ready` avec une offre fermée et sans message : l'étudiant voit l'offre comme disponible et peut demander un dossier (écart E1 confirmé par les données).
- **Attendu Q12** : la plupart des contrôles valent `true` ou `inconnu`. `false` reste rare.

### Étape 7 — Le retrait vu par l'étudiant [Modifie]

Avec un **compte de test** (pas le vrai profil du propriétaire), sur une offre sans importance.

1. Ouvrir une offre, cliquer « Plus disponible ? » en bas du panneau.
   - **Écrit** : `jobs.gone_reason`, `jobs.gone_at`, et une ligne dans `offer_reports` (1 signalement sur les 10 nécessaires ; cette ligne **reste** même si on annule ensuite).
2. **Attendu** :
   - message « Merci : l'offre est rangée dans « Plus disponibles ». Rien ne sera plus dépensé dessus. » ;
   - Offres : elle disparaît de « Nouvelles », apparaît dans l'onglet « Plus disponibles » avec l'étiquette rouge ;
   - panneau : encadré rouge, plus de bouton « Créer mon CV et ma lettre » ;
   - Accueil : plus dans les nouvelles offres.
3. Regarder « Mon suivi » : noter si la carte porte une marque (attendu d'après le code : **aucune**, écart F1).
4. Si l'offre avait déjà un CV et une lettre : vérifier qu'ils restent ouvrables depuis le panneau.
5. **Échec** : l'offre reste dans « Nouvelles », ou le bouton de génération reste visible.

### Étape 8 — Le refus côté serveur [Lecture pour le contrôle, session technique pour l'essai]

Choisir l'offre d'essai avec cette requête (identifiants seulement) :

```sql
-- Q13 : copies retirées sur lesquelles le refus 410 peut être testé
select j.id as job_id, j.status, j.stage, left(j.gone_reason, 60) as raison, o.status as etat_catalogue
from jobs j
left join offers o on o.id = j.offer_id
where j.gone_reason is not null
  and j.status in ('ANALYZED', 'WAITING_APPROVAL')
  and j.user_id = '<identifiant du compte de test>'   -- à remplacer avant de lancer
limit 5;
```

- Important : la route vérifie d'abord le statut, puis le retrait (`generate.ts:64-70`). Une offre encore `DISCOVERED` répondrait 409 « Analysez l'offre… » sans prouver le refus. Il faut une copie `ANALYZED` ou `WAITING_APPROVAL`.
- Essai, à faire par une session technique avec le compte de test connecté : appeler `POST /api/jobs/<job_id>/generate`.
- **Attendu** : réponse **410**, code `GONE`, texte « Cette offre n'est plus disponible : pas de CV ni de lettre à créer. ». Aucun coût : le refus arrive avant le quota et avant l'IA.
- Contrôle après l'essai :

```sql
-- Q14 : aucun document ni appel IA ne doit apparaître
select
  (select count(*) from documents where job_id = '<job_id>' and created_at > now() - interval '10 minutes') as documents_crees,
  (select count(*) from ai_usage where task = 'writing' and created_at > now() - interval '10 minutes')     as appels_redaction,
  (select count(*) from document_generation_leases where job_id = '<job_id>')                               as reservations_restantes;
```

- **Échec** : réponse 200, ou une ligne dans `documents` ou `ai_usage`.

### Étape 9 — Le contournement (écart E1) [Modifie] [Budget possible]

**À ne faire que sur décision du propriétaire** : si le défaut est réel, cet essai écrit un vrai dossier (1 des 2 kits gratuits du mois du compte de test, un appel de rédaction).

1. Sur une offre fermée dans le catalogue (Q13 avec `etat_catalogue = 'closed'`), cliquer « Elle est toujours en ligne ».
2. Cliquer « Créer mon CV et ma lettre ».
3. **Attendu si le produit est conforme au critère** : refus, aucun document.
4. **Attendu d'après le code actuel** : refus seulement si le site répond nettement « introuvable » ; sinon le dossier est écrit.
5. Contrôle : relancer Q14.

La lecture du code suffit déjà à établir l'écart ; l'essai ne sert qu'à le montrer.

### Étape 10 — « Avancer la collecte » [Modifie] [Budget]

Facultatif. Un clic sur le bouton admin :

- appelle France Travail, les pages carrière et, le matin, Adzuna (budget gratuit de 240 appels par jour) ;
- écrit dans `offers`, `harvest_tasks`, `harvest_runs`, et peut **fermer des offres** en fin de collecte ;
- peut lancer jusqu'à 60 lectures IA et 300 vecteurs (crédit de la clé Gateway, plafonnée à 2 USD).

Si la tâche pg_cron tourne (étape 1), ce clic est inutile : les étapes 2 à 6 suffisent. À ne faire que si le propriétaire veut voir le message du bouton, pour constater qu'il n'affiche ni lectures ni erreurs de lecture (écart M1).

## 7. Ce qui reste à confirmer en production

1. Existence, fréquence et adresse des tâches pg_cron pour `/api/cron/harvest` et `/api/cron/tick` (Q1, Q2).
2. Deux collectes par jour réellement terminées, et aucune collecte restée « En cours » (Q3, Q4).
3. La file de lecture et de vecteurs se vide entre deux collectes (Q7).
4. Aucun appel IA de plateforme en dehors des suites de collecte, et autant de résumés que d'appels (Q8, Q8 bis).
5. Nombre d'offres au texte insuffisant, aujourd'hui invisibles (Q7).
6. La barre « Vectorisées » compte-t-elle la bonne colonne (Q7 comparé à l'écran) ?
7. Fermetures France Travail : volume normal ou fermetures à tort (Q9).
8. Copies d'étudiants ouvertes sur une offre fermée (Q11).
9. Réglages réels : `AI_READER_LEASES`, `AI_GENERATION_LEASES`, `EMBEDDING_PROVIDER` (annoncés dans `docs/MVP-2026-10-07.md` et `docs/INTEGRATION-IA-2026-10-06.md`, non vérifiables dans le dépôt).
10. Les fonctions SQL en production sont-elles bien celles des migrations du dépôt ? `docs/INTEGRATION-IA-2026-10-06.md:26` signale au moins une migration appliquée sous un autre numéro de version.
11. Le refus 410 sur une vraie session (étape 8) et le parcours visuel du retrait (étape 7).
