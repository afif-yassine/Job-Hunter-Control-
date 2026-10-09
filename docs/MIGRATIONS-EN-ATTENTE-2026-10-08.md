# Migrations en attente — 8 octobre 2026

Quatre migrations sont dans `supabase/migrations/`, **aucune n’est appliquée à la base de production**. Les appliquer est une décision du propriétaire.

## Ce qu’il faut savoir avant

- Le code déjà en ligne fonctionne **avant et après** chaque migration. Il n’y a donc pas d’ordre de mise en ligne à respecter entre le site et la base.
- Le SQL a été relu ligne à ligne contre les fonctions actuelles (`20261007111753_mvp_generation_and_reader_leases.sql`). Il n’a **jamais été exécuté** : la base complète ne se reconstruit pas depuis le dépôt (les tables de base ne sont dans aucune migration).
- Conséquence : les tester d’abord sur une copie de la base (une branche Supabase) si elle existe. Sinon, les appliquer une à la fois dans l’éditeur SQL de Supabase, en lisant le résultat avant de passer à la suivante.
- Les quatre sont indépendantes (sauf la 4, qui a un prérequis ci-dessous). Ordre conseillé : 1, puis 2, puis 3, puis 4.
- Rien dans le dépôt n’applique les migrations automatiquement (le CI ne les mentionne pas). Si une intégration Supabase–GitHub est active sur le compte, le vérifier avant de considérer cette phrase comme vraie.

## 1. `20261008090000_revision_quota_kind.sql`

**But.** Autoriser le compteur « revision » (plafond de 15 modifications IA par jour et par compte). Sans elle, les modifications sont décomptées sur le plafond journalier de rédaction : jamais illimité, mais le compteur des dossiers du jour baisse aussi.

**Avant.**

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.usage_events'::regclass and contype = 'c';
```

Le résultat doit montrer `scan`, `analysis`, `generation`. Si la contrainte porte un autre nom que `usage_events_kind_check`, s’arrêter : la migration ne la remplacerait pas.

**Après.** La même requête doit montrer aussi `revision`. Puis faire une modification de CV dans l’application et lancer :

```sql
select kind, count(*) from public.usage_events
where created_at > now() - interval '1 hour' group by kind;
```

Une ligne `revision` doit apparaître.

**Ajout du 9 octobre (même fichier, non appliqué).** Compteur de dossiers tenu par le serveur : la contrainte accepte aussi `kit`, et `usage_events` reçoit une colonne `job_id` (sans clé étrangère, pour que supprimer une offre n’efface pas la trace) et un index. Un compte ne peut pas supprimer ses lignes `usage_events` : supprimer un document ne « rend » donc plus un dossier gratuit. Avant cette migration, le code compte les documents comme aujourd’hui.

Après, en plus : `select column_name from information_schema.columns where table_name = 'usage_events' and column_name = 'job_id';` doit renvoyer une ligne.

**Retour arrière.** Supprimer les lignes `revision` et `kit`, puis recréer la contrainte avec les trois valeurs d’origine (`alter table public.usage_events drop column job_id;` est facultatif). Le code retombe seul sur le plafond de rédaction et sur le compte des documents.

## 2. `20261008100000_offer_reader_attempts.sql`

**But.** Une offre dont la lecture renvoie une réponse inutilisable est aujourd’hui relue à chaque tranche, avec un appel payant à chaque fois. La migration compte ces échecs et cesse de réserver l’offre après trois essais. Le compteur repart de zéro si le texte de l’annonce change.

**Avant.**

```sql
select column_name from information_schema.columns
where table_name = 'offers' and column_name = 'reader_attempts';
```

Le résultat doit être vide.

**Après.**

```sql
select column_name from information_schema.columns
where table_name = 'offers' and column_name = 'reader_attempts';          -- une ligne
select proname from pg_proc where proname = 'record_offer_reading_failure'; -- une ligne
select has_function_privilege('authenticated', 'public.record_offer_reading_failure(uuid,uuid)', 'execute'); -- false
select has_function_privilege('service_role',  'public.record_offer_reading_failure(uuid,uuid)', 'execute'); -- true
select count(*) from public.offers
where status = 'open' and summary is null and reader_attempts >= 3;         -- 0 juste après
```

Cette dernière requête sert ensuite à surveiller les offres devenues illisibles. Aucun écran de l’administration ne les montre encore.

**Retour arrière.** Recréer `claim_offer_readings` et `invalidate_offer_reading` avec leurs définitions de `20261007111753` (sans `reader_attempts`), puis `drop function public.record_offer_reading_failure(uuid,uuid);`. La colonne peut rester.

## 3. `20261008110000_ai_usage_nonnegative.sql`

**But.** Un compte peut aujourd’hui écrire ses propres lignes de suivi des coûts IA avec un coût négatif, ce qui fausserait les chiffres de l’administration. La migration interdit les coûts et les jetons négatifs. Le code n’en écrit jamais.

**Avant (obligatoire).**

```sql
select count(*) as lignes_negatives from public.ai_usage
where coalesce(cost_usd, 0) < 0 or input_tokens < 0 or output_tokens < 0;
```

Si le résultat n’est pas 0, regarder ces lignes avant d’aller plus loin : elles signalent une écriture anormale.

**Après.**

```sql
select conname, convalidated from pg_constraint where conname = 'ai_usage_nonnegative';
```

`convalidated = false` est normal : la contrainte est créée `NOT VALID`, elle s’applique aux nouvelles lignes sans relire l’historique. L’étape `VALIDATE` écrite en commentaire dans le fichier reste optionnelle, seulement si le contrôle « avant » donnait 0.

**Retour arrière.** `alter table public.ai_usage drop constraint ai_usage_nonnegative;`

## 4. `20261009090000_daily_offer_unlocks.sql` — sélection quotidienne (8 offres par jour)

**But.** Chaque compte non administrateur débloque au plus 8 offres du catalogue par jour (heure de Paris) ; une offre débloquée ne se reverrouille jamais. Le serveur refuse de créer un dossier ou une analyse sur une offre non débloquée (`403 OFFER_LOCKED`). Les comptes existants gardent TOUTES les offres déjà présentes dans leur liste (la migration les inscrit d’office, origine `backfill`, à la date de la bascule). Le serveur ne copie plus dans la liste d’un étudiant que les offres débloquées.

**Prérequis, dans cet ordre exact.**
1. Dans Vercel → Settings → Environment Variables : ajouter `STUDENT_CATALOGUE_ONLY` = `1` (Production), puis redéployer. Sans cela, la recherche des sites d’emploi remplirait encore la liste de l’étudiant hors de la sélection du jour. Le code ne copie plus ces offres une fois la table présente, mais ce réglage évite aussi des appels payants inutiles.
2. Vérifier que la collecte tourne (`select id, counters->'ai' from public.harvest_runs order by id desc limit 3;`).
3. Prendre une copie de la base si possible, puis exécuter le fichier dans l’éditeur SQL de Supabase.

**Avant.**

```sql
select to_regclass('public.offer_unlocks');                       -- null
select count(*) as comptes_avec_offres from (select distinct user_id from public.jobs where offer_id is not null) t;
select count(*) as lignes_a_inscrire from (select distinct user_id, offer_id from public.jobs j join public.offers o on o.id = j.offer_id where j.offer_id is not null) t;
```

**Après.**

```sql
select to_regclass('public.offer_unlocks');                       -- public.offer_unlocks
select origin, count(*) from public.offer_unlocks group by origin; -- backfill = le nombre « lignes_a_inscrire » d’avant
select has_function_privilege('authenticated', 'public.claim_daily_unlock(uuid,uuid[],integer)', 'execute'); -- false
select has_function_privilege('service_role',  'public.claim_daily_unlock(uuid,uuid[],integer)', 'execute'); -- true
select count(*) from public.offer_unlocks where origin = 'daily';  -- 0 avant la première visite, puis au plus 8 par compte et par jour
```

**Ce que le propriétaire doit voir à l’écran.** Le compte administrateur voit tout comme avant. Un compte étudiant ouvre l’application : ses offres existantes sont rangées « Avant le <date de la bascule> » ; le lot du jour (au plus 8, parfois moins : seules passent les offres au contrat voulu et avec au moins 2 compétences en commun avec le CV) apparaît à la première visite ; une deuxième visite le même jour n’en ajoute pas ; le lendemain, de nouvelles offres s’ajoutent. Créer un dossier sur une offre non débloquée est refusé avec « Cette offre n’a pas encore été recommandée ».

**Retour arrière.** `drop function public.claim_daily_unlock(uuid, uuid[], integer); drop table public.offer_unlocks;` Le code constate l’absence de la table et revient seul au comportement d’avant (rien n’est verrouillé). Les copies déjà créées dans les listes restent.

## Après les quatre

Faire un parcours réel sur le site (import d’un CV, création d’un dossier, une modification, ouverture de la liste le lendemain) et lire les journaux Vercel : aucune erreur ne doit apparaître. Noter ensuite dans `docs/PRODUCT-BACKLOG.md` (REVUE-03) lesquelles ont été appliquées, à quelle date, et le résultat des contrôles.

## Autre script en attente, d’une autre nature

`tools/sql/renormalize-skills.sql` réécrit les compétences déjà stockées (alias) dans les offres et les profils. Ce n’est pas une migration de structure : il modifie des données de production, se termine par `ROLLBACK` par défaut et n’a pas été exécuté. Décision séparée du propriétaire (voir MVP-03).
