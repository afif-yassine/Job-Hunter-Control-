# Scanner d'offres

Le bouton **Scanner les offres maintenant** lance `POST /api/scan`. Il interroge les sources
configurées, ne garde que les offres pertinentes (alternance / stage tech), **supprime les
doublons** (URL canonique + entreprise/titre/ville) puis enregistre les nouvelles offres en
`DISCOVERED`. Si elles ont une description, le tableau de bord les analyse aussitôt avec Gemini.

Il n'existe pas de « scan de 100 sites » fiable. Le scanner combine donc deux sources conformes :

| Source | Couvre | Description complète | Variables |
| --- | --- | --- | --- |
| API France Travail (officielle) | Offres France Travail et partenaires | Oui | `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` |
| Alertes e-mail lues dans Gmail | LinkedIn, Indeed, Hellowork, APEC, Welcome to the Jungle | Non (à coller) | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` |

LinkedIn et Indeed interdisent le scraping et bloquent les robots : leurs alertes e-mail sont le
moyen propre d'obtenir leurs offres. Une offre issue d'une alerte n'a pas de description :
le bouton **Coller la description** apparaît dans la liste, puis **Analyser**.

## 1. France Travail (5 min)

1. Créer un compte sur <https://francetravail.io> et une application.
2. Activer l'API **Offres d'emploi v2** pour cette application.
3. Copier l'identifiant et la clé secrète dans Vercel : `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET`.

## 2. Alertes e-mail via Gmail (15 min)

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

## 4. Scan automatique quotidien (optionnel)

`vercel.json` déclare un cron quotidien sur `/api/scan/cron` (06:00 UTC). Il ne fait rien tant que ces variables
**serveur** n'existent pas : `CRON_SECRET` (chaîne aléatoire), `SCAN_USER_ID` (ton `auth.users.id` Supabase),
`SUPABASE_SERVICE_ROLE_KEY`. Le cron ne fait qu'ajouter des offres `DISCOVERED` ; il ne postule jamais.
Ne mets jamais la clé service-role dans une variable `NEXT_PUBLIC_`.

## 5. Scanner externe (compatibilité)

Si `SCAN_WEBHOOK_URL` est défini, il est appelé en plus (`POST`, `Authorization: Bearer $SCAN_WEBHOOK_SECRET`).
Il peut répondre `{"offers":[{"source","company","title","location","contract_type","description","url","publishedAt"}]}`.

## Limites connues

- Le format des e-mails d'alerte change : l'analyseur (`lib/scan/alerts.ts`) est prudent, laisse « À compléter »
  quand il n'est pas sûr, et doit être ajusté sur de vrais e-mails.
- Les appels France Travail ont été écrits d'après la documentation publique et testés avec des réponses simulées ;
  le premier vrai scan confirmera les identifiants et les champs.
