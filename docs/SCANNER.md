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

- **Marché du travail** : tension, volume d'embauches et fourchette de salaire sur ce métier/territoire. Affiché
  comme une note courte sous l'offre, une fois son scope/URL confirmés (voir plus bas).
- **Accès à l'emploi des demandeurs d'emploi** : taux de retour à l'emploi à 6 mois par métier — indicateur admin
  uniquement pour l'instant (pas encore affiché par offre).
- **Open Formation** : souscrite mais **non utilisée** — vérifié sur la doc live (sept. 2026), ses 3 endpoints ne
  permettent que de consulter les RDV/plages de candidature d'une formation déjà identifiée par un organisme de
  formation (`numeroSession`/`numeroAction`/`numeroFormation`), pas de chercher « quelle formation comble ce
  manque de compétence ». Gardée pour plus tard si France Travail (ou un autre fournisseur, ex. Mon Compte
  Formation) expose un jour une vraie recherche par métier — voir `lib/france-travail/formation.ts`.

Pour Marché du travail et Accès à l'emploi : sur `francetravail.io/compte/applications/<id>`, clique « Ajouter »
sur l'API, puis « Enregistrer ». Une fois souscrite, la page de l'application affiche son **scope** technique (ce
n'est pas un secret, juste l'identifiant du périmètre d'accès — sûr à coller dans Vercel) et l'URL de base de son
endpoint de recherche/stats. Mets les deux dans Vercel :

```
FRANCE_TRAVAIL_MARCHE_SCOPE=...
FRANCE_TRAVAIL_MARCHE_URL=...
FRANCE_TRAVAIL_ACCES_EMPLOI_SCOPE=...
FRANCE_TRAVAIL_ACCES_EMPLOI_URL=...
```

Tant qu'une paire scope/URL manque, la page Admin l'affiche « À terminer » dans la section « Enrichissement
(France Travail) » et rien n'est appelé : aucun risque de casser le scan principal. Chaque appel est enregistré
comme les autres sources (`source_runs`, alertes admin en cas d'erreur). Le format exact des réponses de ces 2 API
n'a pas encore été vérifié en conditions réelles (implémentation défensive, plusieurs noms de champ essayés,
réponse brute conservée) : si un champ affiché semble faux, dis-le, ça se corrige en quelques minutes une fois
qu'on voit une vraie réponse.

## 8. Scanner externe (compatibilité)

Si `SCAN_WEBHOOK_URL` est défini, il est appelé en plus (`POST`, `Authorization: Bearer $SCAN_WEBHOOK_SECRET`).
Il peut répondre `{"offers":[{"source","company","title","location","contract_type","description","url","publishedAt"}]}`.

## Limites connues

- Le format des e-mails d'alerte change : l'analyseur (`lib/scan/alerts.ts`) est prudent, laisse « À compléter »
  quand il n'est pas sûr, et doit être ajusté sur de vrais e-mails.
- Les appels France Travail ont été écrits d'après la documentation publique et testés avec des réponses simulées ;
  le premier vrai scan confirmera les identifiants et les champs.
