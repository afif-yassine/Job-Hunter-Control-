# Recherche d'offres sur tout internet

Le bouton **Lancer la recherche** (page Accueil) enchaîne : chercher les offres → calculer le score
avec Gemini → rédiger CV + lettre pour les offres ≥ 80 → lire le formulaire de candidature avec Playwright.
Rien n'est jamais envoyé (mode `PREPARE_ONLY`). Le même enchaînement démarre tout seul à l'ouverture
de l'application quand la dernière recherche a plus de 12 h (désactivable dans Réglages).

Les offres sont dédoublonnées (URL canonique + entreprise/titre/ville) puis enregistrées en `DISCOVERED`.
Quand une offre n'a qu'un extrait, l'analyse lit la page de l'annonce (JSON-LD `JobPosting`, sans contourner
de protection). Si la page est protégée, l'offre attend dans « À compléter » (bouton **Coller la description**).

## Pourquoi pas « tout scraper » ?

LinkedIn, Indeed, Glassdoor… interdisent le scraping automatisé et bloquent les robots (CAPTCHA, murs de connexion).
L'appli n'essaie pas de les contourner. À la place, elle interroge des **services qui les regroupent légalement** :

| Source | Couvre | Description | Clé |
| --- | --- | --- | --- |
| **JSearch** (recommandée) | Google Emplois : LinkedIn, Indeed, Glassdoor, Welcome to the Jungle, Hellowork, APEC… | complète | `JSEARCH_API_KEY` |
| Adzuna | Des milliers de sites d'emploi français | extrait (complété depuis l'annonce) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |
| France Travail (officiel) | Offres France Travail et partenaires | complète | `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` |
| Jooble | Moteur multi-sites | extrait | `JOOBLE_API_KEY` |
| Alertes e-mail Gmail (avancé) | Alertes LinkedIn, Indeed, Hellowork, APEC, WTTJ | non | `GMAIL_*` |

**Il suffit d'en connecter une.** JSearch a un plan gratuit (~200 requêtes/mois : l'appli en utilise 3 par recherche).

## Connecter une source (dans l'appli)

Réglages → « 1 · Où chercher les offres » : chaque carte explique les étapes, ouvre la bonne page, et
a un champ pour coller la clé + un bouton **Tester**. Les clés saisies sont chiffrées (AES-256-GCM) avec
`INTEGRATIONS_SECRET` (variable Vercel) avant d'être stockées dans la table `integrations`; elles ne sont
jamais renvoyées au navigateur (on n'affiche que les 4 derniers caractères). Les variables Vercel restent
possibles et servent de repli.

Préférences de recherche (contrats, mots-clés, ville, départements, ancienneté) : Réglages → « 2 · Ce que tu cherches »
(table `user_settings`).

## France Travail (5 min)

1. Créer un compte sur <https://francetravail.io> et une application.
2. Activer l'API **Offres d'emploi v2** pour cette application.
3. Copier l'identifiant et la clé secrète dans Vercel : `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`.

## Alertes e-mail via Gmail (15 min, avancé)

1. Sur LinkedIn, Indeed, Hellowork, APEC et Welcome to the Jungle : créer des **alertes emploi** (par exemple « alternance développeur Paris », « stage IA »), envoyées à ta boîte Gmail.
2. Dans Gmail : créer le libellé `job-alerts` et un filtre qui l'applique aux e-mails de ces plateformes
   (`from:(linkedin.com OR indeed.com OR hellowork.com OR apec.fr OR welcometothejungle.com)`).
3. Google Cloud Console : créer un projet, activer **Gmail API**, créer un identifiant OAuth de type *Application Web*
   avec l'URI de redirection `https://developers.google.com/oauthplayground`.
4. Sur <https://developers.google.com/oauthplayground> : roue dentée → *Use your own OAuth credentials*, saisir l'identifiant et le secret,
   autoriser le scope `https://www.googleapis.com/auth/gmail.readonly`, puis *Exchange authorization code for tokens*.
5. Copier dans Vercel : `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
   (et `GMAIL_ALERT_LABEL` si le libellé n'est pas `job-alerts`).

Attention : tant que l'application OAuth est en mode « Testing », Google expire le refresh token au bout de
7 jours. Passe-la en « In production » (usage personnel, l'avertissement « non vérifiée » est normal).
Le scope est en **lecture seule**.

## 3. Personnaliser la recherche (optionnel)

Variable `SCAN_CONFIG` (JSON) :

```json
{"queries":[{"keywords":"alternance développeur"},{"keywords":"stage machine learning"}],"departments":["75","92","93","94","91"],"maxAgeDays":14}
```

Valeurs par défaut : alternance / stage développeur, IA, data, en Île-de-France, offres de moins de 14 jours.

## 4. Pages carrière des entreprises (sans clé)

Dans Réglages > Recherche, « Entreprises à surveiller » : colle le lien de la page carrière (une par ligne,
30 maximum). Pris en charge : Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee — ces plateformes publient
les offres de leurs clients en JSON public, prévu pour être lu (`lib/scan/sources/ats.ts`). Les offres hors de
France (sauf télétravail) et celles de plus de 30 jours sont ignorées.

### Entreprises trouvées automatiquement

Personne n'a besoin de savoir quelle plateforme utilise une entreprise : chaque plateforme héberge les pages
carrière de ses clients à une adresse reconnaissable, avec l'identifiant de l'entreprise dedans
(`jobs.lever.co/<entreprise>`, `boards.greenhouse.io/<entreprise>` ou `job-boards.greenhouse.io/<entreprise>`,
`boards.greenhouse.io/embed/job_app?for=<entreprise>`, `jobs.ashbyhq.com/<entreprise>`,
`jobs.smartrecruiters.com/<entreprise>`, `apply.workable.com/<entreprise>`, `<entreprise>.recruitee.com`). À chaque
recherche, l'appli regarde les liens des offres trouvées par JSearch (y compris ses autres liens de candidature),
France Travail, Adzuna… Si l'un d'eux a cette forme, l'entreprise est ajoutée à la liste « Entreprises trouvées
automatiquement » (Réglages → Ce que tu cherches), et ses offres sont lues directement dès la recherche suivante.

La liste garde au plus 40 entreprises lues par recherche (les plus récemment vues), oublie celles qui n'apparaissent
plus depuis 90 jours, et « Ne plus suivre » retire une entreprise pour de bon. Stockage :
`user_settings.discovered_targets` (migration `20260930090000_discovered_targets.sql`) ; avant la migration, la
découverte est simplement ignorée. Limite : une entreprise qui affiche la plateforme sous son propre domaine
(`carrieres.entreprise.fr?gh_jid=…`) ne donne pas son identifiant dans le lien, elle n'est donc pas reconnue.

## 5. Recherche automatique sur le serveur (toutes les heures ou demi-heures)

`/api/cron/tick` fait, pour **chaque compte**, sans navigateur ouvert : recherche (au plus toutes les 12 h par
compte), analyse des offres en attente, rédaction CV + lettre pour les scores ≥ 80. Il s'arrête proprement avant
la limite de 60 s de Vercel ; l'appel suivant reprend où il en était (la file d'attente, c'est le statut des
offres). Il ne postule jamais et n'ouvre jamais de navigateur.

Variables **serveur** nécessaires dans Vercel : `CRON_SECRET` (longue chaîne aléatoire) et
`SUPABASE_SERVICE_ROLE_KEY`. Ne mets jamais la clé service-role dans une variable `NEXT_PUBLIC_`.

Fréquence :
- `vercel.json` l'appelle une fois par jour (06:00 UTC) — c'est le maximum sur le plan Vercel Hobby ;
- pour une vraie automatisation, fais-le appeler toutes les 30 min par Supabase (gratuit) :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret('<le même CRON_SECRET que dans Vercel>', 'cron_secret');
select cron.schedule('job-hunter-tick', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://job-hunter-control.vercel.app/api/cron/tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'),
    timeout_milliseconds := 60000);
$$);
```

## 6. Dédoublonnage et offres « À vérifier »

Une même offre vue sur plusieurs plateformes devient **une seule** offre (table `job_sources` = tous ses liens),
notée une seule fois. Trois niveaux (`lib/scan/dedupe.ts`) : même lien ; même empreinte (entreprise + intitulé
nettoyé + ville + type de contrat) ; texte très proche (similarité par trigrammes, comme `pg_trgm`). Dans la
zone grise, l'offre est gardée mais rangée dans « À vérifier » (doublon probable). Une offre proche d'une
candidature déjà faite (y compris « Déjà postulé ailleurs ») est rangée avec l'étiquette « Déjà postulé ? ».
Les offres suspectes (paiement demandé, colis, WhatsApp + e-mail personnel…) vont aussi dans « À vérifier » :
rien n'est dépensé dessus (ni IA, ni quota) tant que tu n'as pas décidé.

## 6b. Catalogue d'offres commun et offres plus disponibles

Chaque offre trouvée est enregistrée **une seule fois** pour toute la plateforme
(table `offers`) ; chaque compte garde son propre état dessus (`jobs.offer_id` :
score, statut, documents).

- **Récolte partagée** : France Travail, JSearch, Adzuna et Jooble sont
  interrogés *requête par requête* (« alternance développeur » à Paris), et
  chaque requête est mise en cache (12 h par défaut, `SOURCE_CACHE_HOURS`).
  Deux comptes dont les recherches se recoupent ne paient que les requêtes
  nouvelles. Les fenêtres de date sont arrondies (7, 14 ou 31 jours) pour que
  10 et 14 jours partagent le même appel, puis recoupées pour chaque compte.
- **Offres plus disponibles**, trois signaux :
  1. *Page carrière* : quand la page d'une entreprise (Greenhouse, Lever…) est
     lue en entier, ses offres qui n'y sont plus sont fermées.
  2. *Plus vue depuis 21 jours* par aucune recherche : expirée (elle revient
     si une source la remontre).
  3. *Signalée* par le bouton « Offre plus disponible ? » : rangée pour ce
     compte ; signalée par 2 comptes, elle est fermée pour tout le monde.
- Les offres fermées passent dans le filtre **Plus disponibles** des comptes
  qui n'ont pas encore postulé ; l'analyse IA et la génération de documents
  refusent de dépenser quoi que ce soit dessus.
- Tout passe par la clé `SUPABASE_SERVICE_ROLE_KEY` (déjà requise pour le
  cache). Sans elle, la recherche marche comme avant, sans catalogue.

## 7. Santé des sources, budgets et alertes (page Admin)

Chaque passage de chaque source est enregistré (`source_runs`). Quand une source n'a plus de quota, que sa clé
est refusée ou qu'elle plante, les administrateurs reçoivent une alerte dans l'appli (une par source et par
problème toutes les 6 h, puis une quand elle se rétablit). Les plans gratuits sont protégés par un budget commun
à toute la plateforme (`JSEARCH_MONTHLY_BUDGET` = 180, `ADZUNA_DAILY_BUDGET` = 240, `JOOBLE_TOTAL_BUDGET` = 450) :
une fois atteint, la source est sautée, les autres continuent. Avec `SUPABASE_SERVICE_ROLE_KEY`, une même recherche
faite par deux comptes dans les 12 h (`SOURCE_CACHE_HOURS`) n'appelle la source qu'une fois.

La page **Admin** (visible des seuls administrateurs ; le premier compte l'est automatiquement, table
`app_admins`) montre l'IA utilisée, chaque point de recherche numéroté avec son état, son budget, sa qualité sur
30 jours, l'automatisation, et la liste de ce qu'il faut faire à la main.

## 7b. France Travail — 3 API secondaires (gratuites, mêmes identifiants)

`FRANCE_TRAVAIL_CLIENT_ID` / `_SECRET` donnent aussi accès, gratuitement, à 3 autres API du même compte
francetravail.io. Elles ne trouvent **pas** d'offres : au mieux elles enrichissent celles déjà trouvées via France
Travail (seules ces offres portent un code ROME, `jobs.rome_code`).

- **Marché du travail** : confirmé live (sept. 2026) — c'est en fait toute une famille de statistiques (demandeurs,
  embauches, offres, salaires, dynamique de l'emploi…), pas un simple indicateur de tension. Pour le MVP, un seul
  indicateur est branché : le nombre de demandeurs d'emploi inscrits sur ce métier, dans ce département, par
  trimestre (endpoint « Stats des demandeurs d'emploi inscrits en fin de trimestre — DE_1 »). Affiché comme une
  note courte sous l'offre.
- **Accès à l'emploi des demandeurs d'emploi** : taux de retour à l'emploi à 6 mois par métier — indicateur admin
  uniquement pour l'instant (pas encore affiché par offre). Confirmé live (sept. 2026) sur l'endpoint « Stats
  d'accès à l'emploi... catégories A et B (ACC_1) » : `POST .../stats-perspectives-retour-emploi/v1/indicateur/
  stat-acces-emploi`, scopes `api_stats-perspectives-retour-emploiv1` + `retouremploi`, corps `{codeTypeTerritoire,
  codeTerritoire, codeTypeActivite, codeActivite, codeTypePeriode, codeTypeNomenclature: "DUREEEMP"}`. Seul détail
  non repris tel quel : l'exemple de la doc utilise `codeTypeTerritoire: "REG"` — on envoie `"DEP"` à la place, comme
  pour Marché du travail (même famille, même énumération de territoire), car nos offres ne portent qu'un
  département. Le format exact de la **réponse**, lui, n'a pas encore été vu en conditions réelles.
- **Open Formation** : souscrite mais **non utilisée** — vérifié sur la doc live (sept. 2026), ses 3 endpoints ne
  permettent que de consulter les RDV/plages de candidature d'une formation déjà identifiée par un organisme de
  formation (`numeroSession`/`numeroAction`/`numeroFormation`), pas de chercher « quelle formation comble ce
  manque de compétence ». Gardée pour plus tard si France Travail (ou un autre fournisseur, ex. Mon Compte
  Formation) expose un jour une vraie recherche par métier — voir `lib/france-travail/formation.ts`.

Pour Marché du travail et Accès à l'emploi : sur `francetravail.io/compte/applications/<id>`, clique « Ajouter »
sur l'API, puis « Enregistrer ». Une fois souscrite, la page de l'application affiche son **scope** technique (ce
n'est pas un secret, juste l'identifiant du périmètre d'accès — sûr à coller dans Vercel). L'URL à mettre dans
Vercel est l'**endpoint complet avec son chemin** (pas juste le domaine — ce sont des `POST` avec un corps JSON,
pas une recherche `GET` simple) :

```
FRANCE_TRAVAIL_MARCHE_SCOPE=api_stats-offres-demandes-emploiv1 offresetdemandesemploi
FRANCE_TRAVAIL_MARCHE_URL=https://api.francetravail.io/partenaire/stats-offres-demandes-emploi/v1/indicateur/stat-demandeurs
FRANCE_TRAVAIL_ACCES_EMPLOI_SCOPE=api_stats-perspectives-retour-emploiv1 retouremploi
FRANCE_TRAVAIL_ACCES_EMPLOI_URL=https://api.francetravail.io/partenaire/stats-perspectives-retour-emploi/v1/indicateur/stat-acces-emploi
```

Tant qu'une paire scope/URL manque, la page Admin l'affiche « À terminer » dans la section « Enrichissement
(France Travail) » et rien n'est appelé : aucun risque de casser le scan principal. Chaque appel est enregistré
comme les autres sources (`source_runs`, alertes admin en cas d'erreur). Le format exact des réponses de ces 2 API
n'a pas encore été vérifié en conditions réelles (implémentation défensive, plusieurs noms de champ essayés,
réponse brute conservée) : si un champ affiché semble faux, dis-le, ça se corrige en quelques minutes une fois
qu'on voit une vraie réponse.

**Jeton OAuth — une incohérence vue dans la doc live** : la page de Open Formation et celle de Mes évènements
emploi montrent `https://authentification-partenaire.francetravail.io/...` comme URL de jeton (c'est la valeur
par défaut de l'app depuis sept. 2026), mais celle de Marché du travail montre encore l'ancien domaine
`https://entreprise.francetravail.fr/...`. Si une des 4 API renvoie une erreur d'authentification alors que la
clé et le scope sont corrects, ajoute `FRANCE_TRAVAIL_TOKEN_URL=https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire`
dans Vercel pour cette éventualité.

## 8. Scanner externe (compatibilité)

Si `SCAN_WEBHOOK_URL` est défini, il est appelé en plus (`POST`, `Authorization: Bearer $SCAN_WEBHOOK_SECRET`).
Il peut répondre `{"offers":[{"source","company","title","location","contract_type","description","url","publishedAt"}]}`.

## Limites connues

- Le format des e-mails d'alerte change : l'analyseur (`lib/scan/alerts.ts`) est prudent, laisse « À compléter »
  quand il n'est pas sûr, et doit être ajusté sur de vrais e-mails.
- Les appels France Travail ont été écrits d'après la documentation publique et testés avec des réponses simulées ;
  le premier vrai scan confirmera les identifiants et les champs.
