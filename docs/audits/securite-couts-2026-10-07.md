# Audit sécurité et coûts — 7 octobre 2026

Agent « securite-couts ». Audit **statique** : lecture du code et des migrations du dépôt, rien d'autre.

## Résumé pour le propriétaire (cinq lignes)

1. Je n'ai trouvé, à la lecture du code, **aucun chemin qui laisse un étudiant lire le profil, les documents ou le suivi d'un autre**. Mais ce n'est pas encore prouvé : les règles de base de dix tables ne sont pas dans le dépôt et aucun test avec deux comptes n'a été fait.
2. **Un seul compte peut aujourd'hui vider le plafond de 2 USD en une demi-heure environ** : le bouton « modifier un document par une consigne » lance un appel payant sans limite journalière (30 par minute).
3. **Un seul compte peut retirer des offres du catalogue pour tout le monde**, et écrire un résumé « En bref » vu par tous, parce que le serveur fait confiance à des champs que l'étudiant peut modifier.
4. Les chiffres de coût de l'admin sont **en partie mesurés, en partie estimés, sans qu'on puisse distinguer les deux**, et deux écrans calculent le même coût de deux façons. La comparaison avec les factures réelles n'est **pas faite** : il me faut tes captures (liste en fin de document).
5. **Avis : pas prêt pour un pilote ouvert à des inconnus.** Acceptable pour un pilote fermé avec quelques personnes de confiance, car le plafond Gateway de 2 USD protège ton argent ; il ne protège pas le service, qui s'arrête pour tous dès qu'il est atteint. Trois corrections avant d'ouvrir : constats E1, E2, E3.

## Méthode et limites

- Lu : les 20 migrations de `supabase/migrations/`, les 31 routes de `app/api/`, `lib/plan.ts`, `lib/quota.ts`, `lib/api.ts`, `lib/ai.ts`, `lib/ai-usage.ts`, `lib/economics.ts`, `lib/admin/*`, `lib/pipeline/*`, `lib/scan/index.ts`, `lib/scan/enrich.ts`, `lib/integrations.ts`, `lib/semantic-embeddings.ts`, `lib/embeddings.ts`, `lib/offer-reader.ts`, `lib/cv-pdf.ts`, `lib/profile-import.ts`, `lib/profile-store.ts`, `lib/writing-context.ts`, `lib/csp.ts`, `proxy.ts`, `next.config.ts`, `vercel.json`, `worker/*`, les routes `app/auth/*`, `app/admin/page.tsx`, et le guide CSP de la version Next installée (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
- Exécuté : `git log`, `git status`, `npm audit --omit=dev`, `npm audit` (lecture seule), `npm ls braces`, recherches de texte.
- **Non fait** : aucune connexion au site, aucun compte créé, aucun appel aux routes de production, aucun appel IA, aucun accès à la base de production, aucun navigateur, aucun test de charge.
- `.env*` : non lus. J'ai seulement cherché des **noms** de variables dans `.env.example` (fichier modèle versionné), valeurs masquées avant affichage. Aucune clé trouvée dans les fichiers suivis par Git (recherche par motifs de clés).
- Le dépôt bouge : dernier commit vu `db2633ed` (arrivé pendant l'audit). `lib/pipeline/server.ts`, `lib/scan/index.ts`, `lib/scan/config.ts` et `lib/scan/types.ts` ont des modifications non commitées d'une autre session : les numéros de ligne de ces fichiers peuvent bouger.
- Reprise après interruption (8 octobre) : `git log -15` et `git status` refaits, aucun commit après `db2633ed`, 20 migrations inchangées. Les constats E1, E2, E3, M1, M2, M3, M7, F1 et F4 ont été revérifiés dans le code actuel, aux mêmes lignes.
- Vocabulaire : **Établi** = lu dans le code. **À confirmer** = demande un test réel ou une vérification de configuration.

## Corrections récentes : sont-elles complètes ?

| Commit | Ce qu'il fait | Complet ? |
| --- | --- | --- |
| `f94cf85d` route Drive réservée à l'admin | `app/api/documents/[id]/drive/route.ts:25-26` refuse tout compte non admin avant toute action, refus par défaut si la vérification échoue (`lib/admin.ts:8-11`). | **Oui pour cette route.** Mais deux autres routes « plateforme » restent ouvertes aux étudiants : `/api/worker/dispatch` (M2) et `/api/integrations/test` (M3). |
| `99e15f8f` code 409 `PROFILE_REQUIRED` | `lib/pipeline/generate.ts:63` et `lib/pipeline/compare.ts:20`. | **Partiel.** `lib/pipeline/analyze.ts:186` et `app/api/documents/[id]/revise/route.ts:55-56` renvoient encore un 409 sans code, avec l'ancien message « Le profil vérifié n'est pas encore synchronisé » (F4). |
| `3e62fc74` détails plateforme hors des écrans étudiant | Écrans nettoyés. | **Partiel côté API** : `/api/status` renvoie toujours ces détails à tout compte connecté (F3). |
| `bd790bd4`, `7db66915`, `db2633ed` | Parcours et textes. | Pas d'effet de sécurité relevé. |

---

## Constats, du plus grave au moins grave

Aucun constat **critique** établi (pas de fuite de données entre comptes trouvée à la lecture).

### Gravité élevée

#### E1 — La révision IA d'un document n'a ni quota journalier, ni réservation

- **Destinataire** : backend
- **Où** : `app/api/documents/[id]/revise/route.ts:24` (seule limite : 30 requêtes/minute), appel payant ligne 93
- **Constat (établi)** : la route appelle le modèle de rédaction sans `consumeQuota`, sans `checkPlan` et sans réservation, alors que la génération d'un kit les applique (`lib/pipeline/generate.ts:111-115`).
- **Preuve** : comparer les deux fichiers ; `consumeQuota` n'apparaît pas dans la route de révision. Limites de débit dans `lib/api.ts:8-13`.
- **Risque** : un compte, même par simple script ou bouton bloqué, peut lancer 30 appels payants par minute. Au tarif codé en dur (estimation, environ 0,002 USD par révision avec un profil long), le plafond de 2 USD tombe en une demi-heure. Ensuite plus aucun étudiant n'obtient de kit, d'import ni de lecture d'offres jusqu'à ton intervention.
- **Correction proposée** : compter chaque révision dans le quota journalier `generation` (ou un quota `revision` dédié), et réserver le traitement comme pour les kits (déjà noté dans SUITE-06). Refuser si le compteur est indisponible.

#### E2 — Le serveur agit sur le catalogue partagé à partir de champs que l'étudiant peut modifier

- **Destinataire** : backend
- **Où** : `lib/pipeline/generate.ts:78-87` → `lib/pipeline/availability.ts:48-76` (fermeture d'une offre pour tous) ; `lib/pipeline/analyze.ts:225-228` (résumé partagé) ; écriture directe de `jobs` par le navigateur dans `components/dashboard.tsx:298,343-346,370`
- **Constat (établi)** : la ligne `jobs` appartient à l'étudiant, qui peut en modifier toutes les colonnes depuis son navigateur (politique `jobs_owner_all`, `supabase/migrations/20260916181531_optimize_rls_and_foreign_keys.sql:3`). Or le serveur, avec la clé de service, utilise trois de ces colonnes sans les revérifier : `offer_id` (quelle offre du catalogue), `official_url`/`source_url` (quelle page contrôler) et `description` (texte envoyé au modèle).
  - Si le contrôle « encore en ligne ? » répond « page introuvable », le serveur ferme l'offre `offer_id` **pour tous les comptes** et la marque « plus disponible » chez chacun.
  - L'analyse détaillée écrit le résumé produit par le modèle dans `offers.summary`, affiché à tous, tant que l'offre n'a pas encore de résumé.
  - Le résultat du contrôle est aussi mis en cache sur l'offre partagée (`availability.ts:58`).
- **Preuve** : dans `generateKit`, le contrôle de disponibilité passe avant le plan et le quota, donc sans autre limite que 30 requêtes/minute.
- **Risque** : un seul étudiant peut vider le catalogue pour tout le monde (les offres reviennent seulement à la collecte suivante, deux fois par jour, et il peut recommencer), ou faire afficher à tous un « En bref » trompeur. De plus un résumé écrit par ce chemin n'a pas la liste de compétences, donc l'offre n'est jamais relue et son score gratuit est faussé pour tous.
- **Correction proposée** : pour toute action sur le catalogue, relire l'offre côté serveur à partir de la table `offers` (URL et texte du catalogue, pas ceux de la ligne `jobs`) et vérifier que la ligne `jobs` y correspond. Ne plus écrire `offers.summary` depuis l'analyse d'un compte : laisser le lecteur partagé le faire. Idéalement, empêcher le navigateur de modifier `offer_id`, `source_url` et `official_url` (droits par colonne ou déclencheur).

#### E3 — La réservation des kits dépend d'une variable d'environnement

- **Destinataire** : propriétaire (vérifier Vercel), backend
- **Où** : `lib/pipeline/generate.ts:43` ; même principe pour le lecteur du catalogue, `lib/offer-reader.ts:74`
- **Constat (établi)** : si `AI_GENERATION_LEASES` ne vaut pas exactement `1`, la génération part sans réservation. Dans ce cas : un double clic lance deux appels payants pour le même kit, et la vérification « 2 kits par mois » n'est plus protégée contre des demandes simultanées sur plusieurs offres.
- **Preuve** : `docs/MVP-2026-10-07.md:16` confirme `AI_READER_LEASES=1` en production, mais ne confirme pas `AI_GENERATION_LEASES` (la ligne 11 dit seulement « conserver »).
- **Risque** : double traitement payant, et dépassement du quota gratuit (borné par 10 générations par jour et par compte). La case du backlog « Réservations des embeddings, lectures et kits » n'est vraie que si les deux variables sont posées.
- **Correction proposée** : vérifier les deux variables dans Vercel (Production). Puis rendre la réservation obligatoire dans le code (supprimer l'interrupteur) : une protection ne doit pas dépendre d'un réglage oubliable.
- **À confirmer** : valeur réelle des deux variables ; test de double clic en réel.

### Gravité moyenne

#### M1 — Le quota « 2 kits par mois » est compté sur une table que l'étudiant peut modifier

- **Destinataire** : backend
- **Où** : `lib/plan.ts:43-54` ; politique `documents_owner_all`, `20260916181531_optimize_rls_and_foreign_keys.sql:4`
- **Constat (établi)** : le nombre de kits du mois est le nombre d'offres ayant un document `TAILORED_CV` créé ce mois-ci. Ces lignes appartiennent à l'étudiant, qui a tous les droits dessus (suppression et modification comprises) via l'accès direct à la base. De plus, refaire le kit d'une offre déjà préparée ne compte pas (`plan.ts:6`), et l'étudiant peut changer le texte de cette offre.
- **Risque** : la limite gratuite réelle n'est pas 2 par mois mais le quota journalier de 10 générations (import de CV compris), soit jusqu'à environ 300 par mois et par compte. Le compteur journalier, lui, n'est pas contournable (ajout seul, `20260927120000_phase1_mvp.sql:59-65`).
- **Correction proposée** : tenir le compte mensuel dans un registre que seul le serveur écrit (par exemple une ligne par kit facturé, sans droit d'écriture pour le client).
- **À confirmer** : avec un compte de test, vérifier qu'une suppression directe d'un document est bien acceptée par la base.

#### M2 — Le worker Railway est accessible à tout étudiant, sans quota journalier

- **Destinataire** : backend
- **Où** : `app/api/worker/dispatch/route.ts:14,38-50,75-82` ; `worker/index.ts:8-18,38`
- **Constat (établi)** : tout compte connecté peut faire ouvrir un navigateur sur Railway (10 fois par minute, pas de limite par jour) vers l'adresse enregistrée dans sa ligne `jobs`, qu'il choisit lui-même. Le filtre d'adresse du worker est plus faible que celui du site (`lib/scan/enrich.ts:13-21`) : il ne retire pas les crochets des adresses IPv6, ne bloque ni `.localhost` ni les noms internes, et le navigateur suit ensuite toute redirection. Le secret partagé est comparé avec `!==` (pas à temps constant).
- **Risque** : coût Railway non compté dans l'admin et non plafonné par l'application ; le navigateur du worker peut être dirigé vers des adresses qui ne sont pas des offres. La route renvoie le titre de la page, l'adresse finale et les libellés de formulaire.
- **Correction proposée** : réserver la route à l'administrateur comme la route Drive, ou ajouter un quota journalier ; reprendre dans le worker le filtre de `enrich.ts`, refuser les redirections hors HTTPS public, comparer le secret à temps constant.
- **À confirmer** : le worker est-il encore utilisé dans le parcours étudiant ? Si non, fermer la route.

#### M3 — Le test d'une source utilise les clés de la plateforme sans passer par le budget partagé

- **Destinataire** : backend, propriétaire (vérifier Vercel)
- **Où** : `app/api/integrations/test/route.ts:25-42` ; `lib/scan/index.ts:113-116,221-228`
- **Constat (établi)** : la route fusionne les variables du serveur et les clés du compte, puis lance une vraie recherche. Si une clé plateforme existe (JSearch, Adzuna, Jooble), n'importe quel étudiant déclenche un appel avec **ta** clé, 10 fois par minute, sans décompte dans `source_budget` (le décompte n'existe que dans `runScan`, `lib/scan/index.ts:247-248`). Si des identifiants Gmail sont posés dans Vercel, la source « alertes e-mail » lit **ta** boîte pour chaque compte, et le test renvoie trois titres d'offres tirés de tes e-mails.
- **Risque** : épuisement du forfait gratuit JSearch (environ 200 appels par mois) ou facture RapidAPI ; exposition de contenus de ta boîte Gmail aux étudiants.
- **Correction proposée** : dans la route de test, n'utiliser que les clés du compte, ou réserver le test des clés plateforme à l'admin et le faire passer par le budget partagé. Ne jamais activer Gmail au niveau plateforme.
- **À confirmer** : présence de `JSEARCH_API_KEY`, `ADZUNA_*`, `JOOBLE_API_KEY`, `GMAIL_*` dans Vercel (Production).

#### M4 — Les chiffres de coût de l'admin peuvent être faussés par n'importe quel compte

- **Destinataire** : backend
- **Où** : `supabase/migrations/20261004150000_rate_limits_ai_usage.sql:51-52` ; `lib/ai-usage.ts:18-25` ; `lib/admin/ai-costs.ts:28-30`
- **Constat (établi)** : la table `ai_usage` accepte les ajouts de l'étudiant pour son propre compte (c'est ainsi que le serveur enregistre l'usage). Rien n'empêche un compte d'ajouter lui-même des lignes avec des jetons ou un coût inventés. La colonne `cost_usd` n'interdit pas les valeurs négatives (`20261007090000_admin_growth.sql:5`).
- **Risque** : fausse alerte « seuil atteint », ou au contraire masquage de sa propre consommation. Le coût par compte n'est donc pas une preuve.
- **Correction proposée** : enregistrer l'usage avec le client de service et supprimer la politique d'ajout pour les comptes ; ajouter une contrainte `cost_usd >= 0`.

#### M5 — Coûts affichés : mélange de mesuré et d'estimé, deux méthodes, appels non comptés

- **Destinataire** : backend, propriétaire
- **Où** : `lib/economics.ts:12-26,36-43` ; `lib/ai.ts:125-136` ; `lib/ai-usage.ts:16-24` ; `lib/admin/ai-costs.ts:17-50` ; `lib/admin/growth.ts:91-99` ; `components/views/admin-view.tsx:578-579,615`
- **Constat (établi)** : voir la section « Comment l'admin calcule les coûts » plus bas. Points principaux : la page Croissance recalcule le coût avec les prix codés en dur et ignore le coût renvoyé par le fournisseur, alors que la page Coûts IA l'utilise ; aucune colonne ne dit si une ligne est mesurée ou estimée ; les appels en échec ou tronqués ne sont pas enregistrés alors qu'ils peuvent être facturés ; l'alerte à 80 % n'apparaît que si tu ouvres la page.
- **Risque** : deux montants différents pour la même dépense ; dépense réelle supérieure à l'affichage ; plafond atteint sans que tu sois prévenu.
- **Correction proposée** : une seule méthode (coût stocké, estimation seulement à défaut) ; une colonne `cost_source` (`provider` ou `estimate`) ; enregistrer aussi les appels refusés ou tronqués ; envoyer l'alerte par e-mail ou notification (SUITE-14).

#### M6 — L'isolation de dix tables de base ne peut pas être prouvée depuis le dépôt

- **Destinataire** : backend, coordinateur
- **Où** : `supabase/migrations/20260916181531_optimize_rls_and_foreign_keys.sql:1-11` (première migration : elle modifie des politiques sans créer les tables)
- **Constat (établi)** : la création de `candidate_profiles`, `agent_rules`, `jobs`, `documents`, `applications`, `application_questions`, `notifications`, `agent_schedules`, `agent_runs`, `audit_events` et l'activation de leur RLS ne sont dans aucune migration. Une politique sans RLS activée ne protège rien. Par ailleurs les migrations ne sont pas rejouables dans l'ordre : `20261006145105_versioned_perplexity_vectors.sql:74-83,98-109` utilise la colonne `skills`, créée seulement dans `20261007120000_free_score.sql:5`.
- **Risque** : la case « accès limité aux données de son propre compte » repose sur l'état de la base de production, non vérifiable ici ; impossible de reconstruire la base ou de tester la RLS en local.
- **Correction proposée** : exporter le schéma de production (structure seule, sans données) dans une migration de base ; corriger l'ordre.
- **À confirmer** : dans Supabase, colonne `rowsecurity` de `pg_tables` pour le schéma `public`, et le conseiller de sécurité (Security Advisor).

#### M7 — Le vecteur du profil est recalculé sans quota

- **Destinataire** : backend
- **Où** : `app/api/profile/route.ts:28-31` ; `lib/semantic-embeddings.ts:59-83`
- **Constat (établi)** : chaque enregistrement d'un profil différent déclenche un appel d'embedding payant ; seule limite : 120 requêtes par minute. La réservation empêche les appels simultanés, pas leur répétition.
- **Risque** : faible par appel, mais un script peut atteindre environ 1 USD par jour (estimation au tarif codé en dur), soit la moitié du plafond.
- **Correction proposée** : quota journalier sur les enregistrements de profil (quelques dizaines par jour suffisent).

#### M8 — Dix comptes suffisent à fermer définitivement une offre

- **Destinataire** : backend
- **Où** : `supabase/migrations/20261003120000_offer_reports_threshold.sql:10,25-31`
- **Constat (établi)** : dix signalements de comptes différents ferment l'offre avec le motif « reported », qui ne se rouvre jamais à la collecte. La fonction ne limite pas le nombre de signalements par compte et par jour, et un compte peut rattacher une ligne `jobs` à n'importe quelle offre.
- **Risque** : dix comptes jetables peuvent retirer durablement des offres choisies.
- **Correction proposée** : limite journalière de signalements par compte, ancienneté minimale du compte, et réouverture possible par l'admin.

### Gravité faible

| N° | Destinataire | Où | Constat (établi sauf mention) | Correction proposée |
| --- | --- | --- | --- | --- |
| F1 | backend | `lib/pdf.ts:34-39,427` | Nom, ville, adresse e-mail personnelle et liens du propriétaire codés en dur comme identité par défaut des PDF. Un document rendu pour un compte sans nom de profil porterait ces coordonnées. | Remplacer par des champs vides ; refuser le rendu sans identité. |
| F2 | backend | `app/api/documents/[id]/revise/route.ts:74,97` ; `lib/pipeline/analyze.ts:203,231-232` ; `lib/pipeline/generate.ts:127` | Le prénom du propriétaire est écrit dans la consigne envoyée au modèle pour chaque étudiant ; plusieurs messages d'erreur parlent encore de « Gemini ». | Texte neutre (« le candidat », « l'IA »). |
| F3 | backend | `app/api/status/route.ts:26-51` | Tout compte connecté reçoit l'état de la configuration plateforme (fournisseur IA, Drive, worker, secrets présents ou non). Pas de secret, mais des détails que `3e62fc74` voulait cacher. | Ne renvoyer ces champs qu'à l'admin. |
| F4 | backend, front | `lib/pipeline/analyze.ts:186` ; `app/api/documents/[id]/revise/route.ts:55-56` | 409 sans code `PROFILE_REQUIRED`. | Même code et même message que `generate.ts:63`. |
| F5 | backend | `lib/scan/enrich.ts:13-21,63` | Le filtre d'adresse ne vérifie pas vers quelle adresse IP le nom pointe, et la lecture de page suit les redirections. Sur Vercel le risque est limité. | Redirections en mode manuel avec revérification à chaque saut. |
| F6 | backend | `20261005120000_embeddings_pgvector.sql:29-39,42-51` ; `20261003090000_offers_catalogue.sql:42,81,102` ; `20261004150000_rate_limits_ai_usage.sql:14-37` | `match_offers_for_me` et `my_job_similarity` ne sont pas retirées au rôle `anon` (sans effet visible : elles filtrent sur le compte connecté). Plusieurs fonctions `security definer` fixent `search_path = public` au lieu de vide. Toute la table `offers`, jetons de réservation compris, est lisible par les comptes connectés. `hit_rate_limit` accepte n'importe quel nom de compteur. | Révoquer `anon`/`public` ; `search_path = ''` ; vue ou droits par colonne sur `offers` ; liste fermée de compteurs. |
| F7 | backend | `lib/csp.ts:21-22` ; `next.config.ts:3-6` | CSP conforme au guide de la version Next installée (nonce par requête, `strict-dynamic`, `proxy.ts`). Deux assouplissements : styles en ligne autorisés, images depuis tout site HTTPS. Le commentaire de `next.config.ts` dit encore « pas de CSP ». | Nonce sur les styles si possible ; corriger le commentaire. |
| F8 | backend | `20261007090000_admin_growth.sql:39,53,66` ; `lib/scan/health.ts:52-53` | La barre « Vectorisées » de l'admin compte l'ancienne colonne Gemini `embedding`, pas `semantic_embedding` (Perplexity). « Nouveaux aujourd'hui » et les budgets de sources suivent le jour UTC, les quotas suivent le jour de Paris. | Compter `semantic_embedding` ; un seul fuseau. **À confirmer** sur l'écran admin. |
| F9 | coordinateur | `package.json` (dépendances de dev) | SUITE-15, voir section dédiée. | Suivre le correctif amont. |
| F10 | coordinateur, propriétaire | `docs/SCANNER.md:114` ; `vercel.json:5-10` | La doc du planificateur pointe encore vers l'ancienne adresse `vercel.app`. La collecte dépend d'un `pg_cron` Supabase non versionné. | Mettre la doc à jour. **À confirmer** : les tâches `cron.job` de production visent `lebontaf.com`. |
| F11 | backend | `app/api/profile/import/route.ts:11,23,34` | Limite annoncée 5 Mo ; la plateforme peut refuser avant, avec un message non traduit (**à confirmer** en réel). Pas de réservation à l'import : un double clic fait deux appels payants (comptés dans le quota). | Limite à 4 Mo ; désactiver le bouton pendant l'envoi. |
| F12 | coordinateur | dossier `capture d'écrant/` à la racine (non suivi) | Trois captures d'écran non suivies par Git. | Les vérifier avant tout commit ; ajouter le dossier à `.gitignore`. |
| F13 | backend | `lib/scan/index.ts:382-386` | Les offres trouvées par la recherche d'un compte (dont les pages carrière qu'il choisit) entrent dans le catalogue partagé via la clé de service. | Marquer l'origine ; n'accepter que les sources plateforme pour le catalogue commun. |

---

## 1. Isolation — tables, politiques, fonctions

### Tables créées dans les migrations

| Table | RLS | Lecture | Ajout | Modif. | Suppr. | Remarque |
| --- | --- | --- | --- | --- | --- | --- |
| `profile_answers` | oui | propriétaire | propriétaire | propriétaire | propriétaire | |
| `integrations` | oui | propriétaire | propriétaire | propriétaire | propriétaire | Clés chiffrées côté serveur (AES-256-GCM) |
| `user_settings` | oui | propriétaire | propriétaire | propriétaire | propriétaire | Colonne `plan` protégée par déclencheur |
| `job_sources` | oui | propriétaire | propriétaire | propriétaire | propriétaire | |
| `usage_events` | oui | propriétaire + admin | propriétaire | — | — | Compteur non effaçable |
| `app_admins` | oui | soi-même | — | — | — | Écriture service seulement |
| `source_runs` | oui | admin | — | — | — | |
| `source_budget` | oui | admin | — | — | — | |
| `source_cache` | oui | — | — | — | — | **Aucune politique** (service seul, voulu) |
| `offers` | oui | tout compte connecté | — | — | — | Voir F6 |
| `offer_reports` | oui | propriétaire | — | — | — | Écrit par fonction |
| `harvest_runs`, `harvest_tasks` | oui | — | — | — | — | **Aucune politique** (voulu) |
| `rate_limits` | oui | — | — | — | — | **Aucune politique** (écrit par fonction) |
| `ai_usage` | oui | propriétaire | propriétaire | — | — | Voir M4 |
| `admin_quests` | oui | admin | admin | admin | admin | |
| `document_generation_leases` | oui | — | — | — | — | Droits retirés aux comptes (`20261007111753…:7`) |

### Tables de base (hors migrations)

`candidate_profiles`, `agent_rules`, `jobs`, `documents`, `applications`, `application_questions`, `notifications`, `agent_schedules`, `agent_runs`, `audit_events` : une politique « propriétaire » existe (elle est modifiée par la première migration), mais **l'activation de la RLS n'est pas vérifiable** (M6).

### Fonctions `security definer`

| Fonction | `search_path` | Contrôle de l'appelant | Appelable par |
| --- | --- | --- | --- |
| `is_admin` | vide | lit le compte connecté | connecté, service |
| `record_source_run`, `consume_source_budget` | vide | compte connecté ou service | service seul depuis `20261004120000` |
| `admin_source_stats`, `admin_growth_stats` | vide / `public` | admin ou service | connecté (refus si non admin), service |
| `flag_gone_offers`, `upsert_offers`, `expire_offers`, `close_board_offers`, `close_unseen_offers`, `set_offer_categories`, `set_offer_embeddings`, `close_offer` | `public` | aucun (réservées) | service seul |
| `report_offer_gone` | `public` | compte connecté, propriétaire de la ligne | connecté (M8) |
| `hit_rate_limit` | `public` | compte connecté, son seul compteur | connecté |
| `offer_applicants` | `public` | aucun ; renvoie un nombre à partir de 3 | connecté, service |

Les fonctions de réservation (`claim_*`, `finish_*`, `release_*`) sont `security invoker` et réservées au service, sauf celles du profil (`claim_semantic_profile`, `set_semantic_profile_embedding`), ouvertes au compte pour sa propre ligne.

**RPC appelables par `anon` qui ne devraient pas l'être** : `match_offers_for_me`, `my_job_similarity` (F6, sans effet constaté). Aucune autre trouvée.

## 2. Routes `app/api/**`

Légende : *connecté* = session + limite de débit (`lib/api.ts:20-46`, refus si le compteur est indisponible).

| Route | Méthode | Accès | Clé de service | Filtre `user_id` |
| --- | --- | --- | --- | --- |
| `account` | GET, DELETE | connecté ; DELETE vérifie l'origine et une phrase de confirmation | oui (suppression du compte connecté) | oui |
| `account/export` | GET | connecté | oui | oui, sur chaque table |
| `admin/ai-costs` | GET | admin | oui | sans objet |
| `admin/growth` | GET, POST | admin | non (la fonction revérifie l'admin) | sans objet |
| `admin/harvest` | GET, POST | admin | oui | sans objet |
| `admin/overview` | GET | admin | oui | sans objet |
| `catalogue/counts` | GET | connecté | non | catalogue partagé |
| `cron/embeddings` | POST | secret cron | oui | sans objet |
| `cron/harvest` | GET, POST | secret cron | oui | sans objet |
| `cron/tick` | GET, POST | secret cron | oui | oui, par compte traité |
| `documents/[id]/approve` | POST | connecté | non | oui |
| `documents/[id]/drive` | POST | **admin** | non | oui |
| `documents/[id]/edit` | PATCH | connecté | non | oui |
| `documents/[id]/latex` | GET | connecté | non | oui |
| `documents/[id]/pdf` | GET, POST | connecté | non | oui |
| `documents/[id]/revise` | POST | connecté (30/min) | non | oui — **E1** |
| `integrations` | GET, POST, DELETE | connecté | non | oui |
| `integrations/test` | POST | connecté (10/min) | non | oui — **M3** |
| `jobs/[id]/analyze` | POST | connecté (30/min) | **oui, sur l'offre partagée** | ligne `jobs` oui ; offre partagée non revérifiée — **E2** |
| `jobs/[id]/availability` | POST | connecté | non (fonction SQL) | oui |
| `jobs/[id]/generate` | POST | connecté (30/min) | **oui, réservation et fermeture d'offre** | ligne `jobs` oui ; offre partagée non revérifiée — **E2** |
| `jobs/[id]/review` | POST | connecté | non | oui |
| `profile` | GET, PUT | connecté | non | oui — M7 |
| `profile/import` | POST | connecté (30/min) + quota | non | sans objet (rien n'est enregistré) |
| `questions/[id]/answer` | POST | connecté | non | oui |
| `scan` | POST | connecté (6/min) + quota | oui (cache, budgets, catalogue) | oui pour les données du compte — F13 |
| `searches` | GET, PUT | connecté | non | oui |
| `settings`, `settings/discovered` | GET, PUT, DELETE | connecté | non | oui |
| `status` | GET | connecté | non | oui — F3 |
| `worker/dispatch` | POST | connecté (10/min) | non | oui — **M2** |

- **Aucune route sans contrôle d'accès.**
- **Routes admin** : les quatre routes `admin/*` et la route Drive vérifient `is_admin` et refusent par défaut. La page `/admin` aussi (`app/admin/page.tsx:22-25`).
- **Secret cron** : comparaison correcte, à temps constant après hachage (`app/api/cron/tick/route.ts:16-20`, `cron/harvest/route.ts:8-12`, `lib/embedding-backfill.ts:16-18`) ; refus si le secret n'est pas configuré.
- **Clé de service sans vérification du propriétaire** : les deux cas de E2. Les autres usages filtrent sur le compte connecté ou sont derrière admin/cron.

## 3. Quotas et concurrence

### Ce que le code garantit (établi)

- **Limite de débit** par compte ; compteur illisible = refus 503 (`lib/api.ts:32-37`).
- **Quota journalier** (3 recherches, 20 analyses détaillées, 10 générations, jour de Paris) : la fonction SQL verrouille par compte et par type avant de compter, donc deux demandes simultanées ne passent pas à deux pour une seule place (`20260927120000_phase1_mvp.sql:82-88`). Réponse illisible = refus 503 (`lib/quota.ts:59`).
- **Plan gratuit** : compte illisible = refus 503 `PLAN_UNAVAILABLE` (`lib/plan.ts:95-98`) ; limite atteinte = 402 avec la date du prochain renouvellement. Le plan `pro` ne peut pas être modifié par le compte (déclencheur, `20261006090000…:158-177`).
- **Réservation de kit**, si la variable est active : une seule par compte, 2 minutes, réservée au serveur ; indisponible = 503 sans appel IA ; déjà en cours = 409 `GENERATION_IN_PROGRESS` (`generate.ts:44-53`).
- **Réouverture** : même profil, même offre, même modèle = documents existants rendus sans appel IA (`generate.ts:90-100`).
- **Ordre à la génération** : offre retirée → cache → plan → quota → appel payant. Le quota est donc consommé juste avant l'appel.
- **Import** : taille, signature PDF, 10 pages et 30 000 caractères vérifiés avant de consommer le quota (`profile/import/route.ts:23-38`, `lib/cv-pdf.ts:5-25`).
- **Catalogue** : embeddings toujours réservés ; lectures réservées si `AI_READER_LEASES=1` ; un résultat n'est enregistré que si le texte n'a pas changé entre-temps.
- **Tâche planifiée** : les comptes gratuits ne reçoivent jamais de kit automatique (`plan.ts:86-91`).

### Ce que le code ne garantit pas

- Révision IA sans quota (E1). Quota mensuel contournable (M1). Réservation de kit optionnelle (E3). Import sans réservation (F11). Vecteur de profil sans quota (M7).
- Un appel IA qui échoue après le quota consomme quand même une unité du jour.
- L'appel IA peut durer 60 s, comme la durée maximale de la fonction : si la plateforme coupe avant la fin, la réservation reste bloquée jusqu'à 2 minutes et l'étudiant voit une erreur de la plateforme, pas un message clair.

### À tester en réel (comptes de test, budget prévenu)

1. Double clic et deux onglets sur « créer le dossier » : un seul appel payant, une seule paire de documents, une seule ligne `ai_usage`.
2. Deux offres différentes lancées en même temps avec 1 kit restant : une seule passe.
3. Troisième kit du mois : message 402 lisible. Onzième génération du jour : message 429 lisible.
4. Plafond Gateway atteint : relever le code renvoyé par AI Gateway. Le message étudiant dépend de ce code (`lib/ai.ts:54-64`) : un 402 donne « Crédit IA épuisé », un 403 donnerait « Clé IA refusée : vérifie la clé… dans Vercel », qui n'est pas un message pour un étudiant.
5. Import : PDF de 4,6 Mo, PDF scanné, fichier renommé en `.pdf`, PDF protégé, 11 pages ; double clic.
6. Isolation : avec deux comptes, lecture et modification croisées de `jobs`, `documents`, `candidate_profiles`, `applications`, `notifications`, et appel de chaque route avec l'identifiant d'un document de l'autre compte (attendu : 404).
7. Charge : 100 inscrits ne veut pas dire 100 simultanés ; mesurer séparément.

## 4. Entrées non fiables

- **PDF** : contrôles corrects (voir section 3). Le PDF n'est pas stocké. En mode Gateway, seul le texte extrait part au modèle.
- **Injection d'instructions** : le texte du CV est passé comme donnée encodée avec la consigne d'ignorer toute instruction (`lib/ai.ts:191-193`) ; la réponse est renormalisée avec des tailles maximales (`lib/profile-import.ts:59-100`). Pour le kit, offre et preuves sont déclarées « données, jamais instructions » (`lib/writing-context.ts:77`), la sortie suit un schéma strict, et une compétence absente des preuves fait refuser le document (`generate.ts:136-137`). Ces garde-fous réduisent le risque sans l'annuler : la relecture par l'étudiant reste nécessaire. Le seul effet sur d'autres comptes passe par le résumé partagé (E2).
- **Texte libre** : consigne de révision limitée à 2 000 caractères, réponse aux questions à 4 000, notes à 4 000 ; contexte envoyé au Gateway limité à 80 000 octets (`lib/ai.ts:110`).
- **Redirection après connexion** : `safeNext` n'accepte qu'un chemin du site (`lib/auth-messages.ts:28-39`), utilisée dans les trois routes `app/auth/*`. Correct.
- **En-têtes** : `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS deux ans, COOP (`next.config.ts:7-15`). CSP avec nonce (F7).
- **Aucun `dangerouslySetInnerHTML`** dans `app/` ni `components/`.

## 5. Secrets côté navigateur

- Variables publiques : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_SIGNIN`. Toutes trois sont faites pour être publiques.
- Aucun composant client n'importe `lib/supabase/admin.ts` ni ne lit une variable serveur.
- Aucune clé dans les fichiers suivis par Git (recherche par motifs). `.gitignore` exclut `.env*`.
- Les clés de sources saisies par un compte ne reviennent jamais au navigateur (quatre derniers caractères seulement).
- Donnée personnelle dans le code livré : F1.

## 6. Comment l'admin calcule les coûts

| Sujet | Fonctionnement lu dans le code |
| --- | --- |
| Prix par modèle | Codés en dur, en USD par million de jetons (`lib/economics.ts:12-26`). Modèles actuels : GPT-6 Luna 0,10 entrée / 0,50 sortie ; Qwen 3.7 Flash 0,03 / 0,13 ; embedding Perplexity 0,004. **Non vérifiés** face aux tarifs réels. |
| Modèle inconnu | Prix par défaut 0,30 / 2,50 (`economics.ts:37-42`), signalé « prix estimé » sur la page Croissance. |
| Ce qui est mesuré | Les jetons d'entrée et de sortie renvoyés par le Gateway (`ai.ts:130-134`) et, **si le Gateway le renvoie**, le coût de l'appel (`ai.ts:131,135`). |
| Ce qui est estimé | Le coût quand le Gateway ne le renvoie pas (jetons × prix codés) ; les jetons des anciens embeddings Gemini (longueur du texte ÷ 4, `embeddings.ts:33`) ; toutes les prévisions (jetons types par tâche, 35 % d'usage moyen, `economics.ts:51-80`). |
| Peut-on distinguer ? | **Non** : `ai_usage.cost_usd` ne dit pas d'où vient le montant. |
| Unités et arrondis | USD ; stockage à 6 décimales ; affichage à 2 décimales, « < 0,01 $ » en dessous. Un appel d'embedding très court peut être arrondi à zéro. |
| Devise | USD partout pour les coûts. L'euro ne sert qu'aux recettes Pro, avec un taux fixe de 1,15 (`economics.ts:111-113`). |
| Périodes | Coûts IA : **30 jours glissants**. Croissance : **mois civil de Paris**. Quotas : jour de Paris. Budgets de sources et « nouveaux aujourd'hui » : UTC. |
| Deux méthodes | Coûts IA : coût stocké, estimation à défaut. Croissance : jetons × prix codés, coût stocké ignoré. Les deux pages peuvent donc diverger. |
| Projection | Dépense depuis le 1er ÷ jours écoulés × 30 (`growth.ts:98-99`). |
| Hébergement | 0 USD Vercel, 0 USD Supabase, 2 USD « autres » tant que tu n'as pas coché les étapes « Vercel Pro » / « Supabase Pro » (`growth.ts:112-116`). Ce sont des hypothèses, pas des factures. |

### Appels payants non comptés dans l'admin

- Appels IA en erreur, coupés au délai, ou dont la réponse est tronquée : rien n'est enregistré (`ai.ts:125-129`).
- Appels dont le fournisseur ne renvoie pas l'usage (`ai-usage.ts:16`).
- Vecteur de profil par l'ancien chemin Gemini (`embeddings.ts:138-164`), si `EMBEDDING_PROVIDER` n'est pas `gateway`.
- Worker Railway, e-mails Resend, fonctions et bande passante Vercel, base et Auth Supabase, appels aux sources d'offres.
- Les embeddings Perplexity **sont** comptés quand le Gateway renvoie l'usage (`semantic-embeddings.ts:30-31`).

### Alerte à 80 % et plafond de 2 USD

- L'alerte compare le total estimé des **30 derniers jours** (tous comptes + catalogue) au seuil `AI_SPEND_ALERT_USD`, 2 par défaut : « à surveiller » à 80 %, « atteint » à 100 % (`lib/admin/ai-costs.ts:47-49`).
- C'est un bandeau sur la page admin. **Aucun e-mail, aucune notification, aucun blocage.**
- **Le plafond de 2 USD n'existe pas dans le code.** Il vit uniquement dans le réglage de la clé AI Gateway. L'application ne lit pas le budget restant et ne vérifie aucun budget global avant un appel payant.
- Si le plafond Gateway est un total et non un montant mensuel, l'alerte sur 30 jours glissants ne mesure pas la même chose : à confirmer.

### Comparaison avec les factures réelles : NON FAITE

Je n'ai accès à aucun tableau de bord. Pour la faire, il me faut, **sur la même période** (du 1er au 7 octobre 2026 inclus, et du 8 septembre au 7 octobre pour la vue 30 jours), en précisant le fuseau affiché :

1. **Vercel AI Gateway** : dépense totale en USD ; dépense, nombre de requêtes et jetons entrée/sortie **par modèle** ; réglage de la clé (montant du plafond, mensuel ou total, date de remise à zéro) ; crédit restant.
2. **Tarifs publiés** des trois modèles utilisés, à la date de la capture.
3. **Admin LeBonTaf, au même moment** : onglet Plateforme, bloc « Coûts IA » (total, appels, jetons, tableau par compte, bandeau d'alerte) ; onglet Croissance, tableau par modèle, « dépensés depuis le 1er » et « prévus ».
4. **Export en lecture seule de `ai_usage`** : par jour et par modèle, nombre d'appels, somme des jetons entrée et sortie, somme de `cost_usd`, nombre de lignes sans coût.
5. **Vercel** (Usage et Billing) : forfait, invocations de fonctions, durée, bande passante.
6. **Supabase** (Usage) : forfait, taille de la base, trafic sortant, utilisateurs actifs.
7. **Railway** : dépense du mois et heures de fonctionnement du worker.
8. **Resend** : forfait et e-mails envoyés.
9. **RapidAPI (JSearch), Adzuna, Jooble** : appels consommés, à comparer à la table `source_budget`.

## 7. SUITE-15 — dépendances

- `npm audit --omit=dev` : **0 vulnérabilité** sur les dépendances de production.
- `npm audit` complet : 5 alertes « high », toutes la même chaîne de développement : `eslint-config-next@16.3.6` → `@next/eslint-plugin-next` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3` (avis GHSA-vfj7-8cjw-p6xm, déni de service par motif très imbriqué).
- Le seul correctif proposé par npm rétrograde `eslint-config-next` en 14.2.35 : **à ne pas faire**.
- Risque réel : nul en production (outil de vérification du code, absent du site). **Statut inchangé : attendre le correctif amont.**

## Incohérences à réclamer

- **Backlog, « Réservations des embeddings, lectures et kits »** (case cochée) : vraie seulement si les deux variables sont actives (E3).
- **Backlog, « Comptes et accès limité aux données de son propre compte »** (case cochée) : aucune preuve retrouvable dans le dépôt (M6), aucun test à deux comptes consigné.
- **Backlog, « Coûts IA maîtrisés : Fait »** : contredit par E1 et M1.
- **Backlog, « Alertes administrateur »** : c'est un bandeau à l'écran, pas une alerte envoyée.
- **Contradiction** : `docs/PRODUCT-BACKLOG.md:127` dit MVP-02 vérifié le 7 octobre ; `docs/CONTEXTE-PROJET.md:36` et `docs/MVP-2026-10-07.md:26` disent encore « expéditeur et réinitialisation complète à vérifier ».
- **Contexte périmé** : `docs/CONTEXTE-PROJET.md:33` cite `f71510e7` comme dernière base ; sept commits ont suivi.
- **Capacité 100 utilisateurs** : non mesurée, correctement signalée comme telle dans le backlog.
- Je n'ai modifié ni le backlog ni le contexte.

## Vérifications non faites

| Vérification | Pourquoi non faite | Ce qu'il faut |
| --- | --- | --- |
| Isolation réelle entre deux comptes | Audit statique, pas de compte | Deux comptes de test dédiés et l'accord du propriétaire |
| RLS activée sur les dix tables de base | Pas d'accès à la base | Résultat du Security Advisor Supabase ou requête sur `pg_tables` |
| Variables Vercel (`AI_GENERATION_LEASES`, `AI_READER_LEASES`, `AI_PROVIDER`, `EMBEDDING_PROVIDER`, clés de sources, `GMAIL_*`, `WORKER_*`) | `.env` et Vercel non consultés | Liste des **noms** de variables de Production, et la valeur des deux interrupteurs |
| Double clic, appels simultanés, limites atteintes | Consomme du budget IA | Comptes de test, budget annoncé à l'avance |
| Message affiché quand le plafond Gateway est atteint | Ne peut pas être provoqué sans dépense | Clé de test à plafond très bas, ou capture d'un cas réel |
| Tâches `pg_cron` de production | Non versionnées | Export de `cron.job` (sans le secret) |
| Limite réelle de taille à l'import | Pas d'appel à la production | Essai avec un PDF de 4,6 Mo |
| Charge représentative | Interdite dans cette exécution | Plan de test borné, validé par le propriétaire |
| Comparaison coûts admin / factures | Pas d'accès aux tableaux de bord | Les neuf éléments de la section 6 |
| Écrans admin réels | Pas de connexion | Captures des onglets Croissance et Plateforme |
