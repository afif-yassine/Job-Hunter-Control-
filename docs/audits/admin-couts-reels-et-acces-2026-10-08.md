# Page d'administration : coûts réels et gestion des accès — 8 octobre 2026

Agent « securite-couts ». Audit **en lecture seule** du dépôt au commit `09d625ba`. Aucun code modifié, aucun SQL exécuté, aucun fichier `.env` lu, aucun appel à la production, aucun appel IA.

Demande du propriétaire : que la page d'administration montre « chaque centime réellement dépensé, données réelles, pas estimées », permette de modifier les paramètres de la plateforme, et de gérer chaque utilisateur et ses accès.

## Résumé pour le propriétaire

1. **Aujourd'hui, aucun montant de la page admin n'est une facture.** Le plus fiable est le « Coût IA par compte » : il reprend le coût que le Gateway renvoie à chaque appel réussi. Mais il oublie les appels ratés ou coupés, il peut être faussé par un compte, et il perd l'historique d'un compte supprimé.
2. **La page Croissance affiche « Dépense réelle par modèle » alors que c'est un calcul** (jetons × prix écrits dans le code). L'hébergement « 2 $ », « Pro à 7,99 € », le taux 1,15 et le simulateur sont des hypothèses. Plusieurs textes sont périmés (Gemini, script de déploiement, Sprint 6/7).
3. **Le vrai chiffre IA existe et peut être lu gratuitement** : Vercel fournit le solde et le total dépensé (`/v1/credits`) et le coût facturé de chaque appel (`/v1/generation`). Le rapport par jour (`/v1/report`) est fermé au forfait Hobby.
4. **Pour Vercel, Supabase, Railway, Resend, JSearch et le nom de domaine** : pas de lecture fiable par API à ce stade (ou non vérifiée). Il faut une **saisie manuelle** de tes factures, clairement étiquetée.
5. **Gestion des utilisateurs et des paramètres : rien n'existe.** C'est faisable en petites étapes ; les deux premières ne demandent **aucune migration**. Les suivantes en demandent trois au plus, à lancer après la décision sur les trois migrations déjà en attente.

Vocabulaire : **établi** = lu dans le code. **Vérifié dans la documentation** = lu dans la documentation Vercel le 8 octobre 2026. **Non vérifié** = à confirmer, je ne devine pas.

---

## 1. Coûts IA : d'où vient chaque chiffre

### 1.1 Le coût écrit dans `ai_usage` : mesuré ou calculé ?

Les deux, sans qu'on puisse les distinguer.

- `lib/ai.ts:130-135` : après un appel réussi au Gateway, le code lit le coût dans la réponse (`usage.cost`, ou à défaut `provider_metadata.gateway.cost`). S'il existe, il est transmis.
- `lib/ai-usage.ts:24` : si ce coût est présent, il est enregistré tel quel. **Sinon** le code enregistre `jetons × prix codés en dur` (`lib/economics.ts:12-26`, `callCost` lignes 37-43), arrondi à 6 décimales.
- Aucune colonne ne dit laquelle des deux méthodes a servi (`supabase/migrations/20261007090000_admin_growth.sql:5` : une seule colonne `cost_usd`).

Preuve que le Gateway renvoie bien un coût : `docs/RESULTATS-COMPARATIF-IA-2026-10-06.md:9` (« Coût total déclaré dans usage.cost par Gateway : $0.006141 » sur 209 réponses) et `docs/INTEGRATION-IA-2026-10-06.md:9` (un kit réel à 0,001082 USD). Ce même document rappelle : « le coût déclaré par l'API n'est pas une facture ».

Chemin Gemini direct (`lib/ai.ts:96-104` et `182-187`) : aucun coût renvoyé, donc toujours une estimation. Ce chemin ne sert que si `AI_PROVIDER` n'est pas `gateway` (**non vérifié** en production ; le contexte indique `gateway`).

**Le SDK installé.** Le dépôt n'installe **aucun SDK Vercel AI** : ni `ai`, ni `@ai-sdk/gateway` dans `package.json:14-28`. Les appels sont des `fetch` directs (`lib/ai.ts:112`, `lib/semantic-embeddings.ts:18`). La question « que montre le SDK ? » se ramène donc à « que contient la réponse HTTP ? ». Je n'ai pas appelé le Gateway ; je m'appuie sur les deux documents ci-dessus et sur la documentation.

### 1.2 Quels appels payants écrivent une ligne ?

| Appel payant | Enregistré ? | Où | Compte |
| --- | --- | --- | --- |
| Lecture d'une offre du catalogue | Oui, si réponse complète | `lib/offer-reader.ts:94-95` | plateforme (sans compte) |
| Analyse détaillée d'une offre | Oui, si réponse complète | `lib/pipeline/analyze.ts:203-204` | étudiant |
| Rédaction du kit CV + lettre | Oui, si réponse complète | `lib/pipeline/generate.ts:123-124` | étudiant |
| Révision d'un document | Oui, si réponse complète | `app/api/documents/[id]/revise/route.ts:101-102` | étudiant |
| Import de CV | Oui, si réponse complète | `app/api/profile/import/route.ts:40-43` | étudiant |
| Vecteurs Perplexity des offres | Oui | `lib/semantic-embeddings.ts:30-31,47` | plateforme |
| Vecteur Perplexity du profil | Oui | `lib/semantic-embeddings.ts:75` | étudiant |
| Anciens vecteurs Gemini des offres | Oui, mais **jetons devinés** (longueur ÷ 4) | `lib/embeddings.ts:33,128` ; `lib/scan/harvest.ts:220` | plateforme |

### 1.3 Ce qui échappe au suivi (établi)

| N° | Ce qui manque | Où | Effet |
| --- | --- | --- | --- |
| A | **Réponse tronquée** : si le modèle s'arrête pour une autre raison que « stop » (par exemple limite de longueur), le code lève une erreur **avant** d'enregistrer. Les jetons sont pourtant facturés. | `lib/ai.ts:128-129` | Dépense réelle supérieure à l'affichage |
| B | **Appel en erreur ou coupé à 60 s** : rien n'est enregistré. Un appel coupé peut avoir été facturé. | `lib/ai.ts:114,125` ; `lib/semantic-embeddings.ts:19,23` | Idem |
| C | **Réponse sans bloc d'usage** : la fonction sort sans rien écrire. | `lib/ai-usage.ts:16` | Appel invisible |
| D | **Écriture qui échoue** : l'erreur d'insertion est ignorée en silence (le client Supabase ne lève pas d'exception, il renvoie une erreur que personne ne lit). | `lib/ai-usage.ts:17-28` | Appel invisible, aucune trace |
| E | **Ancien vecteur de profil Gemini** : appel payant sans aucun enregistrement. | `lib/embeddings.ts:138-164`, appelé par `lib/scan/index.ts:151,519` et `app/api/profile/route.ts:31` | Seulement si `EMBEDDING_PROVIDER` n'est pas `gateway` |
| F | **Scripts de comparaison** (`scripts/compare-ai.mjs`, `compare-writing.mjs`, `compare-embeddings.mjs`, `compare-rerank.mjs`, `test-grounded-rag.mjs`, `test-cv-extraction.mjs`) : ils dépensent sur le Gateway sans écrire dans `ai_usage`. | `scripts/` | Le solde Vercel baisse sans trace dans l'admin |
| G | **Compte supprimé** : ses lignes de coût sont effacées avec lui (`on delete cascade`). | `supabase/migrations/20261004150000_rate_limits_ai_usage.sql:42` | Le total du mois **diminue** après une suppression |
| H | **Lignes inventées par un compte** : tout compte connecté peut ajouter ses propres lignes. La migration en attente n° 3 interdit seulement les valeurs négatives ; gonfler son propre coût reste possible. | même fichier, ligne 52 | Le coût par compte n'est pas une preuve |
| I | **Identifiant de l'appel non conservé** : chaque réponse du Gateway porte un identifiant (`id`, forme `gen_…`). Le code ne le lit pas. | `lib/ai.ts:126-136` (aucune lecture de `result.id`) | Impossible de rapprocher une ligne de la facture |

### 1.4 Peut-on enregistrer le coût réellement facturé par appel ?

**Oui.** Vérifié dans la documentation Vercel (page « AI Gateway REST API Reference », mise à jour le 11 septembre 2026) :

- Chaque réponse de `chat/completions` contient un identifiant de génération dans le champ `id`.
- `GET https://ai-gateway.vercel.sh/v1/generation?id=gen_…`, avec la même clé, renvoie `total_cost` (« montant débité de ton solde »), `market_cost`, `surcharge_cost`, `finish_reason`, les jetons, la date. L'enregistrement arrive avec quelques secondes de retard : une première réponse « introuvable » veut dire « pas encore ».
- La documentation ne donne pas de tarif pour cette lecture (**non vérifié** : gratuité à confirmer sur un essai).

Deux façons de faire, de la plus simple à la plus sûre :
1. **Garder le coût de la réponse** (déjà fait) et **ajouter une colonne qui dit d'où il vient**. Simple, mais ne couvre pas les appels tronqués ou coupés.
2. **Enregistrer l'identifiant `gen_…`** à chaque appel, puis faire relire le coût facturé par une tâche de rapprochement. C'est la seule méthode qui donne « le montant débité » et qui rattrape les appels tronqués (leur identifiant est dans la réponse). Les appels coupés avant toute réponse restent invisibles côté application : seul le total Vercel les montre.

**Non vérifié** : la réponse des embeddings contient-elle aussi un `id` de génération ? La documentation lue ne le dit que pour les « chat completions ».

### 1.5 Existe-t-il une API de solde ou de dépense côté serveur ?

Vérifié dans la documentation Vercel :

| API | Ce qu'elle donne | Utilisable avec le forfait Hobby ? |
| --- | --- | --- |
| `GET /v1/credits` | `balance` (crédit restant) et `total_used` (total dépensé **depuis toujours**), en USD, pour **toute l'équipe** | Oui d'après la documentation (aucune restriction indiquée) |
| `GET /v1/generation?id=…` | Coût facturé d'un appel | Oui d'après la documentation |
| `GET /v1/report` | Dépense par jour, modèle, utilisateur, étiquette, clé | **Non** : « Hobby and Pro-trial plans cannot use this endpoint » (réponse 403). Payant : 5 USD les 1 000 requêtes |
| `GET /v1/models` | Tarifs publics de chaque modèle, sans clé | Oui |

Limites à connaître :
- `total_used` n'a **pas de période** et couvre **toutes les clés** de l'équipe, scripts de test compris. Pour obtenir « dépensé aujourd'hui » ou « ce mois-ci », il faut relever ce total régulièrement et faire la différence. Cela demande une petite table.
- **Le plafond de 2 USD de la clé n'apparaît dans aucune de ces trois API.** La documentation mentionne une API de budgets (`GET /ai-gateway/budgets/list`) dans l'API générale de Vercel : elle demanderait un jeton d'accès Vercel, plus puissant que la clé Gateway. **Non vérifié**, et je déconseille de donner ce jeton à l'application (voir section 4).

---

## 2. Autres dépenses

Je n'ai accès à aucun tableau de bord. La comparaison avec les montants réels est **non faite**. Pour chaque fournisseur, la colonne « lecture par API » reflète ce que je sais ; ce qui n'a pas été vérifié le 8 octobre est marqué.

| Fournisseur | Dépense lisible par API ? | Ce que la plateforme compte déjà | Recommandation |
| --- | --- | --- | --- |
| **Vercel** (Hobby) | Non vérifié. Une API de facturation existe pour les équipes payantes ; en Hobby le montant est 0 USD et la vraie question est la **consommation face aux limites gratuites**. Demande un jeton d'accès Vercel. | Rien | Saisie manuelle (montant + capture « Usage ») |
| **AI Gateway** | Oui : `/v1/credits` (voir 1.5) | `ai_usage` (partiel) | Lecture automatique |
| **Supabase** (Free) | Non vérifié. L'API de gestion demande un jeton personnel qui donne accès à tout le projet. La taille de la base se lit en SQL sans jeton (non fait ici). | Rien | Saisie manuelle ; plus tard, taille de la base en lecture SQL |
| **Railway** (worker) | Non vérifié (API GraphQL avec jeton de compte). | Rien : `/api/worker/dispatch` ne compte ni les appels ni la durée. État en ligne seulement (`lib/worker-status.ts`). | Saisie manuelle |
| **Resend** | Non vérifié. Les e-mails partent par le SMTP de Supabase Auth : **le code n'appelle jamais Resend** (aucune occurrence dans `lib/` ni `app/`). | Rien | Saisie manuelle (forfait + e-mails envoyés) |
| **JSearch** (RapidAPI) | Pas de dépense par API à ma connaissance ; RapidAPI renvoie d'habitude le quota restant dans les en-têtes de réponse (**non vérifié**, non lu par le code). | Oui : `source_budget`, 180 appels par mois (`lib/scan/health.ts:60-61`) | Compteur existant + saisie manuelle du forfait |
| **Adzuna** | Non vérifié, probablement non. | Oui : 240 appels par jour (`lib/scan/health.ts:63-64`) | Compteur existant ; gratuit |
| **Jooble** | Non vérifié, probablement non. | Oui : 450 appels au total (`lib/scan/health.ts:66-67`) | Compteur existant ; gratuit |
| **France Travail** | Gratuit | **Aucun compteur** (`budgetFor` renvoie `null`) ; seulement l'historique des passages dans `source_runs` | Rien à payer |
| **Nom de domaine** | Non | Rien | Saisie manuelle, une fois par an |

Réserves sur les compteurs de sources (établi) :
- Ils comptent **nos appels**, pas ce que le fournisseur a compté. Ce sont des mesures internes, pas des relevés.
- Ils ne comptent que les appels faits avec la **clé de la plateforme** (`lib/admin/overview.ts:151`).
- **Si le compteur est illisible, l'appel part quand même** : `lib/scan/health.ts:87-88` (« A missing counter never blocks a search »). C'est l'inverse de la règle « compteur indisponible = refus » appliquée à l'IA.
- Périodes en **UTC** (`lib/scan/health.ts:52-53`), alors que les quotas IA suivent le jour de Paris.
- L'audit du 7 octobre (constat M3) notait que le bouton « tester une source » utilise la clé plateforme sans décompte. Aujourd'hui `app/api/integrations/test/route.ts` ne contient toujours aucun appel au budget : **toujours vrai**.
- Écart signalé par les agents business (`docs/business/jugement-2026-10-08-trois-defauts.md:86`) : Adzuna, environ 3 300 appels prévus par mois contre 2 500 autorisés. **Non mesuré.**

---

## 3. Classement de chaque chiffre de la page admin

### Onglet « Croissance » (`components/admin/growth-view.tsx`, données de `lib/admin/growth.ts`)

| Chiffre affiché | Source | Classement |
| --- | --- | --- |
| Étudiants inscrits, nouveaux, actifs, avec CV, dossiers, candidatures, entretiens | Comptages SQL (`20261007090000_admin_growth.sql:38-54`) | **Réel mesuré** |
| Abonnés Pro | Comptage SQL de `plan = 'pro'` | Réel mesuré (0 tant que Stripe n'existe pas) |
| Revenu par mois, « après Stripe » | Abonnés × 7,99 € (`lib/economics.ts:101-108`) | **Inventé** : aucun tarif adopté, aucun encaissement |
| « Pro à 7,99 € » | `lib/economics.ts:102` ; `lib/admin/levels.ts:124` | **Inventé / périmé** |
| « Coûts du mois (prévus) » | IA projetée + hébergement | **Estimé** |
| Hébergement 2 $ (puis 47 $, 135 $) | `lib/admin/growth.ts:112-116` ; `lib/admin/levels.ts:70,113,139` | **Inventé** : aucune facture |
| Marge du mois, « rentable à partir de N Pro » | Calcul sur les chiffres ci-dessus | **Inventé** |
| « Dépense réelle par modèle » | `lib/admin/growth.ts:91-95` : jetons × prix codés. La fonction SQL renvoie pourtant le coût enregistré (`usd`, ligne 61 de la migration) ; **le code ne le lit pas**. | **Estimé, mal étiqueté** |
| « X $ dépensés depuis le 1er » | Somme du calcul ci-dessus | **Estimé** |
| « environ Y $ sur le mois » | Dépense ÷ jours écoulés × 30 (`growth.ts:98-99`) | Estimé (projection) |
| Coût d'un étudiant (gratuit actif, moyen, Pro), « lire 1 000 offres » | Jetons types et 35 % d'usage (`lib/economics.ts:51-80`) | **Inventé** (hypothèses jamais mesurées) |
| Simulateur, tableau « Coût par niveau » | `forecast` (`lib/economics.ts:138-155`) | **Inventé** |
| « 1 € ≈ 1,15 $ » | `lib/economics.ts:111-113` | **Inventé** (taux fixe) |
| « Héberger nos propres modèles ? » 175 à 240 $ ; « 60 % de la dépense » | `lib/economics.ts:158-161` ; `growth-view.tsx:398` | **Inventé** |
| Barre « Vectorisées » | Compte l'ancienne colonne Gemini `embedding`, pas `semantic_embedding` (`…admin_growth.sql:53`) | **Périmé** : explique en partie « moins de la moitié vectorisée » |
| « Nouveaux aujourd'hui » | Jour UTC (`…admin_growth.sql:39`) | Réel, mais pas le jour de Paris |

### Onglet « Plateforme » (`components/views/admin-view.tsx`, données de `lib/admin/overview.ts` et `lib/admin/ai-costs.ts`)

| Chiffre affiché | Source | Classement |
| --- | --- | --- |
| Coût IA par compte et total, 30 jours | `ai_usage.cost_usd`, estimation à défaut (`lib/admin/ai-costs.ts:28-30`) | **Mélange** : mesuré par appel quand le Gateway renvoie le coût, sinon estimé. Incomplet (section 1.3) |
| Appels, jetons lus, jetons écrits | `ai_usage` | Réel mesuré pour les appels réussis ; devinés pour les anciens vecteurs Gemini |
| Tableau par compte | 25 premiers comptes (`ai-costs.ts:50`) ; e-mails limités aux 1 000 premiers utilisateurs (`ai-costs.ts:37`) | Réel, tronqué au-delà |
| Bandeau « seuil atteint » | 30 jours glissants comparés à `AI_SPEND_ALERT_USD` (2 par défaut) | **Estimé** ; ne mesure pas le plafond de la clé |
| « Aujourd'hui : N analyses, N CV + lettres, N recherches » | `usage_events`, jour de Paris (`overview.ts:98`) | Réel mesuré ; les révisions ne sont pas affichées ; plafonné par la limite de lignes de l'API |
| Budget gratuit des sources (JSearch, Adzuna, Jooble) | `source_budget` | Mesure interne (section 2) |
| Coûts des sources (« Gratuit 200 req/mois · Pro 25 $… ») | Textes fixes, « vérifiés en septembre 2026 » (`lib/admin/catalog.ts:4,39`) | **Périmé possible** |
| Offres ouvertes, collectes, tâches | Tables de collecte | Réel mesuré |
| Robot Railway, Drive, recherche automatique | Présence de variables + un appel d'état | État, pas un coût |

### Textes périmés relevés (établi)

- `lib/admin/levels.ts:72` : « Mettre en ligne le Sprint 6… Lance deploy-job-hunter.bat » (script abandonné).
- `lib/admin/levels.ts:74-78` : « Clé Gemini payante… plafond conseillé 20 $/mois ». Le fournisseur est le Gateway, plafond 2 USD.
- `lib/admin/levels.ts:83,97` : « gemini-2.5-flash-lite par défaut depuis le Sprint 7 ».
- `lib/admin/levels.ts:124` : « Activer Stripe : Pro à 7,99 €/mois ».
- `components/admin/growth-view.tsx:407-408` : conseil « mets AI_MODEL_ANALYSIS = gemini-2.5-flash-lite ».
- `components/admin/growth-view.tsx:539` : « c'est le Sprint 7 ».
- `lib/admin/growth.ts:104` : les prévisions des niveaux utilisent de force `gemini-2.5-flash-lite`, un modèle qui n'est plus celui de la plateforme.
- `lib/admin/catalog.ts:171-176` : « Recherche intelligente : prévu, pas encore activé », affiché si `EMBEDDING_PROVIDER` n'est pas `gateway`.
- `lib/admin/catalog.ts:129` : « Job Hunter Control ».
- `components/views/admin-view.tsx:523` : adresse `job-hunter-control.vercel.app` dans le modèle de tâche planifiée, au lieu de `lebontaf.com`.
- `lib/admin/overview.ts:219` : renvoi à `docs/SCANNER.md §5`.
- `lib/admin/overview.ts:230` : « Active la protection des mots de passe compromis » alors qu'elle est réservée au forfait Pro de Supabase (PUBLIC-01).
- `lib/ai.ts:139-152` et `lib/admin/ai-costs.ts:50` : le champ `prices` (0,30 / 2,50) est encore renvoyé à la page, qui ne l'affiche plus.

---

## 4. Accès : état actuel et minimum sûr

### 4.1 Comment un administrateur est défini

- Table `public.app_admins` : une ligne par administrateur (`supabase/migrations/20260928090000_source_health_admin.sql:7-10`).
- **Le premier compte créé sur la plateforme est devenu administrateur** au passage de cette migration (lignes 17-22).
- Aucune règle d'écriture : seule la clé de service ou l'éditeur SQL de Supabase peut ajouter ou retirer un administrateur. Un compte ne peut lire que sa propre ligne (lignes 13-14).
- Fonction `is_admin()` (lignes 24-34) : répond vrai si le compte connecté est dans la table. Interdite aux visiteurs anonymes.
- `lib/admin.ts:8-17` : deux aides (`adminRefusal`, `isAdmin`) ; toute réponse illisible vaut refus.
- Il n'existe **qu'un seul rôle** (administrateur ou non), **aucun écran** pour le donner, **aucun journal** des actions d'administration, **aucune double authentification** exigée (aucune occurrence de `mfa` ou `aal2` dans `lib/` et `app/`).

### 4.2 Routes d'administration et protection (établi)

| Route | Méthodes | Protection | Clé de service |
| --- | --- | --- | --- |
| Page `/admin` | — | Session, puis `is_admin` ; sinon retour à l'accueil (`app/admin/page.tsx:22-25`). Mode démo seulement si `DEMO_MODE=1` (ligne 16) | non |
| `/api/admin/overview` | GET | Session + limite de débit + `is_admin` (`route.ts:10-13`) | oui |
| `/api/admin/ai-costs` | GET | idem (`route.ts:9-14`) | oui |
| `/api/admin/growth` | GET, POST | idem (`route.ts:7-13`) ; la fonction SQL revérifie | non |
| `/api/admin/harvest` | GET, POST | idem (`route.ts:8-16`) | oui |
| `/api/documents/[id]/drive` | POST | `adminRefusal` (`route.ts:25`) | non |
| `/api/cron/*` | GET, POST | Secret comparé à temps constant ; refus si non configuré (`cron/harvest/route.ts:8-24`) | oui |

Points à noter :
- Les trois routes `admin/*` recopient le même contrôle au lieu d'utiliser `lib/admin.ts`. Sans gravité aujourd'hui ; à unifier avant d'ajouter des routes qui **modifient**.
- Les deux routes POST (`growth`, `harvest`) ne vérifient pas l'origine de la requête. La suppression de compte, elle, le fait (`app/api/account/route.ts`). À reprendre pour toute nouvelle action d'administration.
- `admin_quests` est modifiable directement depuis le navigateur par un administrateur (`20261007090000_admin_growth.sql:18-19`). Acceptable pour des cases à cocher. **À ne pas copier** pour des paramètres ou des comptes.

### 4.3 Ce qu'il faut au minimum, sans risque

**(a) Lister les utilisateurs avec leur usage et leur coût**

- Une route `GET /api/admin/users`, lecture seule, clé de service côté serveur.
- Données déjà disponibles : comptes (`auth.admin.listUsers`, **à paginer** : `ai-costs.ts:37` ne lit que la première page de 1 000), `user_settings.plan`, `usage_events`, `ai_usage`, nombre de documents.
- Ne renvoyer que : e-mail, date d'inscription, dernière connexion, forfait, compteurs, coût. **Jamais** le contenu du profil, du CV ou des documents.
- Mettre à jour `docs/audits/destinataires-donnees-2026-10-07.md` : l'administrateur devient un lecteur d'adresses e-mail.
- **Migration : non.**

**(b) Changer le quota ou le statut d'un compte**

Aujourd'hui c'est impossible sans code :
- Les quotas sont **les mêmes pour tous**, lus dans les variables Vercel (`lib/quota.ts:12-27`, `lib/plan.ts:19-23`).
- Le forfait (`user_settings.plan`) est protégé : un déclencheur empêche le compte de le changer, seul le service le peut (`20261006090000_offer_journey_free_plan.sql:157-176`). Bonne base.
- Aucun statut « suspendu » n'existe.

Minimum : une table `account_overrides` (compte, statut actif ou suspendu, quotas particuliers facultatifs, motif, auteur, date), **sans aucun droit pour les comptes**, lue par le serveur dans `consumeQuota` et `authenticatedClient`. Règles :
- illisible = refus, comme les autres compteurs ;
- un quota particulier ne peut pas dépasser une borne écrite dans le code ;
- la suspension doit être vérifiée **par le serveur à chaque requête**. Bloquer seulement la connexion dans Supabase Auth ne suffit pas : une session déjà ouverte reste valable jusqu'à son expiration (la durée dépend du réglage Supabase, **non vérifié**).
- **Migration : oui.**

**(c) Donner ou retirer un rôle**

- Écriture de `app_admins` uniquement par une route serveur avec la clé de service. **Ne jamais ajouter de règle « un administrateur peut écrire dans `app_admins` »** : une session d'administrateur volée deviendrait un accès permanent.
- Garde-fous : impossible de retirer le dernier administrateur ; impossible de se retirer soi-même par erreur sans confirmation ; saisie de l'adresse e-mail exacte de la cible ; connexion récente exigée ; ligne de journal obligatoire, écrite **avant** l'effet.
- Mon avis : tant que tu es seul administrateur, **ne construis pas cet écran**. Une ligne SQL dans Supabase, faite par toi, est plus sûre qu'un bouton. À faire seulement à l'arrivée d'une deuxième personne.
- **Migration : oui** (journal), partagée avec (b).

**(d) Modifier des paramètres depuis la page plutôt que dans Vercel**

Aujourd'hui tout est lu dans les variables Vercel, de façon immédiate, à des dizaines d'endroits (`lib/quota.ts:23`, `lib/plan.ts:19`, `lib/scan/config.ts:64`, `lib/pipeline/generate.ts:43`, `lib/offer-reader.ts:74`, `lib/ai.ts:39-46`, `lib/scan/health.ts:54-67`).

Minimum : une table `platform_settings` (clé, valeur, auteur, date), sans droit pour les comptes, écrite seulement par une route serveur. Le code lit la table, et **retombe sur la variable Vercel puis sur la valeur par défaut** si la table est illisible. Chaque clé modifiable est inscrite dans une **liste fermée dans le code**, avec son type et ses bornes.

Modifiables sans danger, avec bornes :
- quotas journaliers (recherches, analyses, rédactions, révisions) ;
- dossiers gratuits par mois ;
- interrupteur `STUDENT_CATALOGUE_ONLY` ;
- budgets d'appels des sources (à la baisse librement, à la hausse dans la limite du forfait gratuit) ;
- seuil d'**alerte** de dépense IA.

À ne **jamais** rendre modifiables depuis une page web :
- toute clé ou secret (`AI_GATEWAY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `WORKER_SHARED_SECRET`, clés de sources, identifiants Google) ;
- **le plafond de budget de la clé Gateway** : il doit rester dans Vercel, hors de portée de l'application. C'est la seule protection qui tient si l'application elle-même est compromise. Conséquence : ne pas donner à l'application de jeton d'accès Vercel ;
- la valeur « 0 = illimité » des quotas (`lib/quota.ts:55`, `lib/plan.ts:93`) : à interdire dans la page ;
- `AI_GENERATION_LEASES` et `AI_READER_LEASES` : ce sont des protections contre le double paiement, pas des réglages (constat E3 du 7 octobre : les rendre obligatoires dans le code) ;
- le fournisseur IA et les adresses appelées ;
- le choix du modèle : seulement plus tard, dans une liste fermée de modèles dont le prix est connu ; un modèle dix fois plus cher choisi par erreur vide le plafond ;
- `DEMO_MODE`, adresses de redirection, expéditeur des e-mails.

### 4.4 Dangers à traiter dans toutes ces étapes

| Danger | Parade |
| --- | --- |
| **Élévation de privilège** | Aucune écriture d'administration par les règles RLS. Tout passe par une route serveur qui revérifie `is_admin`, valide les bornes, puis écrit avec la clé de service. |
| **Clé de service** | Reste dans `lib/supabase/admin.ts`, jamais importée par un composant client (vrai aujourd'hui). Chaque nouvelle route l'utilise après le contrôle d'administrateur, jamais avant. |
| **RLS des nouvelles tables** | RLS activée, **aucune règle** pour les comptes (comme `source_cache` et `harvest_runs`). La lecture passe par les routes. |
| **Journal des modifications** | Table `admin_audit_log` en ajout seul : qui, quand, quoi, ancienne et nouvelle valeur, cible. Aucune modification ni suppression possible, même pour un administrateur. Aucun secret ni contenu de CV dans le journal. |
| **Requête forgée depuis un autre site** | Vérifier l'origine sur chaque action qui modifie (comme `app/api/account/route.ts`). |
| **Session d'administrateur volée** | Double authentification pour le compte administrateur ; connexion récente exigée pour les actions sensibles. **Non vérifié** : disponibilité de la double authentification sur le forfait Supabase actuel. |
| **Erreur humaine** | Confirmation avec saisie du nom de la cible ; bornes ; pas d'action en masse dans la première version. |
| **Coût par compte faussé** | Écrire `ai_usage` avec la clé de service et retirer la règle d'ajout des comptes (constat M4 du 7 octobre, toujours ouvert). |
| **Données personnelles** | L'administrateur voit des adresses e-mail et de l'activité : à écrire dans la page de confidentialité et le registre des destinataires. |

---

## 5. Découpage proposé, dans l'ordre

Principe : d'abord dire la vérité avec ce qui existe, ensuite mesurer mieux, ensuite donner des commandes. Chaque lot est livrable seul.

| Lot | Contenu | Migration SQL ? | Destinataire |
| --- | --- | --- | --- |
| **1. Dire vrai** | Retirer ou étiqueter « hypothèse » : 7,99 €, hébergement 2 $, marge, simulateur, coût par étudiant, GPU. Renommer « Dépense réelle par modèle ». Corriger les textes périmés de la section 3. Faire lire à la page Croissance le coût déjà enregistré (la fonction SQL le renvoie déjà). | **Non** | front + backend |
| **2. Le vrai solde Gateway** | Côté serveur, lire `/v1/credits` et afficher « crédit restant » et « total dépensé depuis l'origine (mesuré par Vercel, toutes clés) ». Afficher l'écart avec la somme de `ai_usage`. Comparer les prix codés aux tarifs publics de `/v1/models`. Clé jamais envoyée au navigateur ; résultat gardé quelques minutes. | **Non** | backend + front |
| **3. Liste des utilisateurs (lecture seule)** | Route `GET /api/admin/users` paginée, onglet « Utilisateurs ». Unifier le contrôle d'administrateur dans `lib/admin.ts`. | **Non** | backend + front |
| **4. Suivi IA fiable** | Colonnes sur `ai_usage` : origine du coût (réponse, facturé, estimé), identifiant `gen_…`, état de l'appel (réussi, tronqué, erreur, coupé). Enregistrer aussi les appels ratés. Écriture par le service seulement, suppression de la règle d'ajout des comptes. Conserver les lignes d'un compte supprimé (sans son identifiant). Tâche de rapprochement par `/v1/generation`. | **Oui — migration A.** Touche la même table que la migration en attente n° 3 : à faire **après** elle | backend |
| **5. Dépenses hors IA** | Table des relevés du solde Gateway (dépense par jour) et table des factures saisies à la main (fournisseur, période, montant, devise, référence, auteur). Formulaire de saisie. Page « Dépenses » : chaque ligne porte son étiquette **mesuré**, **facture saisie** ou **estimé**. | **Oui — migration B** | backend + front |
| **6. Journal et comptes** | `admin_audit_log` et `account_overrides`. Suspendre ou réactiver un compte, quota particulier borné, changement de forfait par le service. Contrôle d'origine sur les actions. | **Oui — migration C** | backend + front |
| **7. Paramètres de plateforme** | `platform_settings` avec liste fermée et bornes ; lecture avec repli sur les variables Vercel. Écran « Paramètres ». | Oui — à **fusionner dans la migration C** si les lots 6 et 7 sont préparés ensemble | backend + front |
| **8. Rôles** | Donner ou retirer le rôle d'administrateur, avec les garde-fous de 4.3 (c). | Non (utilise le journal du lot 6) | backend + front ; **à reporter** tant qu'il n'y a qu'un administrateur |

Sur les migrations :
- Trois sont déjà en attente et **n'ont jamais été exécutées** (`docs/MIGRATIONS-EN-ATTENTE-2026-10-08.md`). Je déconseille d'en empiler de nouvelles avant ta décision (REVUE-03). Les lots 1, 2 et 3 n'en ont pas besoin et couvrent déjà l'essentiel de la demande « ne plus afficher de faux chiffres ».
- La base complète ne se reconstruit pas depuis le dépôt (constat M6 du 7 octobre). Toute nouvelle migration est donc « relue, pas testée » tant qu'il n'existe pas de copie de la base.

Limite à accepter, à écrire sur la page elle-même : même après le lot 5, « chaque centime réel » ne sera vrai que pour le Gateway (mesuré par Vercel) et pour ce que tu saisis à la main. Le reste sera affiché comme estimation ou comme « non renseigné », jamais comme un zéro.

---

## Constats classés

| Gravité | Destinataire | Où | Constat et preuve | Risque | Correction |
| --- | --- | --- | --- | --- | --- |
| Élevée | backend, front | `lib/admin/growth.ts:91-95` ; `components/admin/growth-view.tsx:413,446` | Le bloc « Dépense réelle par modèle » est un calcul jetons × prix codés. Le coût enregistré, renvoyé par la fonction SQL, est ignoré. Les deux onglets peuvent donc afficher deux montants pour la même dépense. | Décision prise sur un faux « réel » | Lot 1 |
| Élevée | backend | `lib/ai.ts:125-129` ; `lib/ai-usage.ts:16-28` | Appels tronqués, en erreur, coupés ou sans bloc d'usage : aucune ligne. Erreur d'écriture ignorée. | Dépense réelle supérieure à l'affichage, sans signal | Lot 4 ; lot 2 pour voir l'écart tout de suite |
| Élevée | propriétaire, front | `lib/economics.ts:101-116` ; `lib/admin/growth.ts:112-121` ; `lib/admin/levels.ts:70-139` | Revenu, marge, hébergement, seuil de rentabilité reposent sur un tarif non adopté et des montants sans facture. | Chiffres d'affaires affichés qui n'existent pas | Lot 1 |
| Moyenne | backend | `supabase/migrations/20261004150000_rate_limits_ai_usage.sql:42,52` | Un compte peut ajouter ses propres lignes de coût ; la suppression d'un compte efface son historique de coût. | Totaux faux à la hausse comme à la baisse | Lot 4 |
| Moyenne | backend | `lib/admin/ai-costs.ts:47-49` ; `components/views/admin-view.tsx:578-580` | L'alerte compare 30 jours glissants estimés à 2 USD. Le plafond de la clé est un total sans renouvellement (`docs/INTEGRATION-IA-2026-10-06.md:10`). Les deux ne mesurent pas la même chose. | Plafond atteint sans alerte, ou alerte sans raison | Lot 2 : alerte sur le crédit restant réel |
| Moyenne | backend | `lib/scan/health.ts:87-88` ; `app/api/integrations/test/route.ts` | Compteur de source illisible = appel autorisé ; test de source hors budget. | Forfait gratuit JSearch dépassé | Refuser si le compteur est illisible ; compter le test |
| Moyenne | backend | `scripts/compare-*.mjs`, `scripts/test-*.mjs` | Dépense Gateway hors `ai_usage`. | Écart inexpliqué avec le solde | Utiliser une clé distincte pour les essais ; lot 2 |
| Faible | front | Section 3, « Textes périmés » | Treize textes périmés ou faux. | Confusion | Lot 1 |
| Faible | backend | `supabase/migrations/20261007090000_admin_growth.sql:39,53` | Barre « Vectorisées » sur l'ancienne colonne ; « aujourd'hui » en UTC. | Indicateur trompeur | Compter `semantic_embedding` ; jour de Paris. Demande une migration : à joindre à la migration A |
| Faible | backend | `lib/admin/ai-costs.ts:37,50` | E-mails limités aux 1 000 premiers comptes ; tableau limité à 25. | Sans effet au pilote | Lot 3 |
| Faible | backend | `app/api/admin/growth/route.ts:27` ; `app/api/admin/harvest/route.ts:37` | Actions d'administration sans contrôle d'origine. | Faible aujourd'hui ; plus grave avec les lots 6 à 8 | Lot 6 |

## Incohérences à réclamer

- `docs/PRODUCT-BACKLOG.md:112` (case cochée) : « Espace admin séparé : utilisateurs, activité, catalogue, coûts par compte **et par jour** ». Aucun coût par jour n'est affiché ni calculé ; aucune liste d'utilisateurs n'existe, seulement des comptages.
- `docs/PRODUCT-BACKLOG.md:114` (case cochée) : « suivi des coûts **fournisseur** ». Le suivi est interne ; aucun chiffre ne vient d'un fournisseur.
- `lib/economics.ts:4-5` dit que tout y est « une estimation que l'admin peut comparer au mois réel (ai_usage) », alors que l'écran appelle ce même calcul « dépense réelle ».
- `docs/CONTEXTE-PROJET.md:11` : « Aucun tarif Pro adopté » ; la page admin affiche « Pro à 7,99 € » à quatre endroits.

Je n'ai modifié ni le backlog ni le contexte.

## Vérifications non faites

| Vérification | Raison | Ce qu'il faut |
| --- | --- | --- |
| Comparaison des montants de l'admin avec Vercel, AI Gateway, Supabase, Railway, Resend | Aucun accès aux tableaux de bord | Les captures listées dans `docs/audits/securite-couts-2026-10-07.md`, section 6, plus le résultat de `/v1/credits` |
| Contenu réel d'une réponse du Gateway (champ de coût, identifiant, embeddings compris) | Aucun appel IA dans cet audit | Un appel de test unique, budget annoncé |
| Gratuité et disponibilité en Hobby de `/v1/credits` et `/v1/generation` | Lu dans la documentation, non essayé | Un appel de lecture avec la clé |
| Part des lignes `ai_usage` mesurées ou estimées | Aucun SQL exécuté ; aucune colonne ne le dit | Lot 4 |
| Prix codés face aux tarifs actuels | Non comparés ligne à ligne | Lot 2 (comparaison automatique avec `/v1/models`) |
| API de dépense de Vercel, Supabase, Railway, Resend, RapidAPI | Non vérifiées | Lecture de leur documentation avant le lot 5 |
| Valeurs des variables de production | `.env` et Vercel non consultés | REVUE-02 |
| Écrans admin réels | Aucune connexion | Captures des deux onglets |
