# Passation LeBonTaf → Codex (6 octobre 2026)

À lire en entier avant de toucher au code. Le propriétaire du projet est francophone et non développeur : réponds-lui en français simple, sans jargon.

## 1. Le produit

**LeBonTaf** (lebontaf.com) est l'espace candidat des étudiants qui cherchent une alternance ou un stage en France. L'étudiant importe son CV, voit les offres classées selon son profil, suit chaque candidature et génère un CV et une lettre adaptés à chaque offre. Il n'y a **jamais d'envoi automatique** aux recruteurs (`APPLICATION_MODE=PREPARE_ONLY`). Objectif : 100, puis 1 000, puis 8 000 étudiants, avec des coûts d'IA soutenables.

**Offre :** gratuite = toutes les offres scorées + 2 CV et 2 lettres par mois. Pro = 7,99 €/mois, illimité (Stripe pas encore branché). Contrainte légale (art. L5321-3 du Code du travail) : on ne fait pas payer la recherche d'emploi. Le Pro vend l'écriture des CV et des lettres.

## 2. Stack et accès

- Next.js (App Router, sortie standalone), TypeScript, React, `motion`, `lucide-react`.
- **Supabase** (projet `zisjcdjfvqcwqehwsdeo`) : Auth, Postgres + pgvector, RLS partout, `pg_cron` pour la collecte des offres toutes les 10 minutes.
- **Vercel** : projet `prj_CfvIMTnDi4as05yiCoj2gOXRYuDT`, équipe `yassines-projects-e751d4dc`. Domaine `lebontaf.com` (DNS chez **Spaceship**), `www` redirigé vers l'apex.
- **Railway** : worker Playwright pour les PDF (`WORKER_BASE_URL`).
- **IA : Gemini** (`GEMINI_API_KEY`). Modèles par défaut (`lib/ai.ts`, `lib/economics.ts`) :
  - lecture des offres, une seule fois pour tout le monde : `gemini-2.5-flash-lite` (`AI_MODEL_READING`)
  - analyse détaillée à la demande : `gemini-2.5-flash-lite` (`AI_MODEL_ANALYSIS`)
  - écriture du CV et de la lettre : `gemini-3.6-flash` (`AI_MODEL_WRITING`)
  - vecteurs : `gemini-embedding-001`, 768 dimensions (`AI_EMBEDDING_MODEL`)
- Sources d'offres : France Travail, Adzuna, JSearch, ATS.

**Commandes :** `npm run typecheck`, `npm run lint`, `npm test` (146 tests, `node --test`), `npm run build`. Démo sans compte : `/demo` (`DEMO_MODE=1`).

## 3. État Git (important)

- Dépôt : `https://github.com/afif-yassine/Job-Hunter-Control-.git`
- Le travail est sur la branche **`fix/documents-design-worker`**, avec **47 commits d'avance sur `main` et non poussés**. Le dernier commit est `995f185`.
- Tout est dans `C:\Users\yassi\Documents\job-hunter-update.bundle`. Le script `deploy-job-hunter.bat`, placé à côté du bundle, l'applique dans `C:\Users\yassi\Documents\job-hunter` puis pousse sur `main`, ce qui déclenche le déploiement Vercel.
- **Première chose à faire :** vérifier que `main` contient `995f185`. Sinon, lancer le .bat ou faire `git fetch <bundle> fix/documents-design-worker`.
- Toutes les migrations jusqu'à `20261007120000_free_score.sql` sont **déjà appliquées** en production.

## 4. Ce qui a été fait récemment (Sprints 6 et 7)

1. **Mon suivi (Sprint 6)** : parcours de chaque offre (vue → CV et lettre → envoyée → entretien → réponse), relances, notes, nombre de candidats LeBonTaf par offre, raison quand une offre disparaît.
2. **Espace admin `/admin`** (`components/admin/*`, `lib/admin/*`, `lib/economics.ts`), réservé aux admins (`app_admins`, `is_admin()`) :
   - onglet Croissance : indicateurs, 3 niveaux de lancement façon jeu avec quêtes automatiques ou cochées à la main (`admin_quests`), simulateur de coûts, seuil de rentabilité ;
   - onglet Plateforme : sources des offres et alertes ;
   - RPC `admin_growth_stats()` ;
   - le coût de chaque appel d'IA est enregistré dans `ai_usage.cost_usd`.
3. **Score gratuit, sans IA par étudiant** : règle demandée par le propriétaire, **une offre n'est analysée qu'une fois**. Ensuite, le score de chaque étudiant n'est qu'une comparaison.
   - Bug corrigé : `gemini-embedding-2` renvoyait 1 vecteur pour 50 offres, donc 0 offre vectorisée en production. On utilise maintenant `gemini-embedding-001` avec le type de tâche document ou requête, et un repli un par un (`lib/embeddings.ts`).
   - `lib/offer-reader.ts` : chaque offre ouverte est lue une fois par Flash-Lite pendant la collecte. On stocke dans `offers.summary` les missions, les outils, les conditions, les compétences normalisées, le niveau et le télétravail. Le coût est noté comme usage de la plateforme (`user_id` null).
   - `lib/skills.ts` normalise les compétences (React.js = react, etc.). `candidate_profiles.skills` est rempli à partir du CV.
   - `lib/fit.ts` calcule le score : 55 % proximité des vecteurs (cosinus ramené de 0,5–0,8 à 0–1) et 45 % compétences en commun (plafond à 6). Le RPC `my_job_fit()` fait la comparaison dans la base.
   - Affichage : la carte et le panneau de l'offre montrent ce score. « Pourquoi ce score ? » liste les compétences acquises et manquantes. L'« Analyse approfondie par l'IA » reste un bouton à la demande. `displayScore()` donne la priorité au score de l'IA quand il existe.
   - Le rattrapage est automatique après le déploiement : 300 vecteurs et 60 lectures toutes les 10 minutes pour environ 3 900 offres.
4. **Connexion et création de compte** (`app/login/actions.ts`, `components/jinnjob/sign-in.tsx`) :
   - Google (`NEXT_PUBLIC_GOOGLE_SIGNIN=1`, déjà dans Vercel) ;
   - onglets « Créer un compte » (e-mail et mot de passe de 8 caractères minimum, confirmation par e-mail, même réponse si l'adresse existe déjà), « Se connecter » (avec « Mot de passe oublié ? ») et « Lien par e-mail » ;
   - page `/auth/nouveau-mot-de-passe`. `/auth/confirm` vérifie `token_hash` pour tous les types.
   - `docs/auth-emails/` contient le pas-à-pas Resend et Supabase et 3 modèles HTML d'e-mail (confirmation, lien magique, réinitialisation).
5. **Adresse de contact publique** : `support@lebontaf.com` (`lib/brand.ts`), au lieu du Gmail personnel.

## 5. Ce qui bloque encore (côté propriétaire, dans les tableaux de bord)

- **Les e-mails de connexion partent encore de `noreply@mail.app.supabase.io`.** Il faut :
  - vérifier le domaine lebontaf.com dans Resend : enregistrements DNS à ajouter chez Spaceship ;
  - créer une clé API Resend ;
  - régler Supabase > Authentication > Emails > SMTP : `smtp.resend.com`, port 465, utilisateur `resend`, mot de passe = la clé `re_…`, expéditeur `no-reply@lebontaf.com` ;
  - coller les 3 modèles de `docs/auth-emails/` ;
  - augmenter la limite d'envoi d'e-mails.
- **Supabase > Providers > Email** : « Confirm email » activé, longueur minimale 8, « Prevent use of leaked passwords » activé (demande le plan Pro de Supabase).
- **Supabase > URL Configuration** : Site URL = `https://lebontaf.com`, Redirect URLs = `/auth/confirm` et `/auth/callback`.
- La boîte `support@lebontaf.com` vient d'être créée par le propriétaire (Spacemail ou redirection) : vérifier qu'elle reçoit bien.
- La clé Gemini doit être sur l'offre **payante** avec un plafond (≈ 20 $/mois), pour ne pas exposer les CV au niveau gratuit (RGPD).

L'environnement Claude ne pouvait ni pousser sur GitHub ni changer ces réglages. Ne promets pas qu'un réglage est fait sans l'avoir vérifié.

## 6. Prochaines étapes du MVP, dans l'ordre

1. Déployer, puis vérifier en production :
   - la page `/login` (les 3 onglets et Google) ;
   - la création d'un compte de test ;
   - la réinitialisation du mot de passe ;
   - l'admin (`offers_embedded` et `offers_summarized` qui montent) ;
   - le score affiché sur les offres.
2. Après le réglage SMTP : vérifier qu'un e-mail arrive bien depuis `no-reply@lebontaf.com`, puis passer « Connexion et comptes » à Fait dans le backlog.
3. **CV et lettre plus justes et moins chers (RAG)** : ne donner à l'IA d'écriture que les expériences, projets et compétences du CV les plus proches de l'offre (vecteurs déjà disponibles), et ne rien inventer en dehors du registre de vérité du profil.
4. Quota gratuit : 2 CV et 2 lettres par mois, remis à zéro le 1er, avec un message clair quand il est atteint.
5. Alertes de coût d'IA (seuil mensuel, à partir de `ai_usage.cost_usd`).
6. Sprint 8 : Stripe (Pro à 7,99 €). Avant cela : micro-entreprise, Vercel Pro (le plan Hobby interdit l'usage commercial) et mentions légales mises à jour.
7. Ensuite : filtres avancés et recherches enregistrées, plus de stages dans le catalogue, plan Supabase au-delà de 500 Mo.

## 7. Règles de travail

- Après chaque changement : typecheck, lint et tests doivent rester verts. Ajouter un test pour chaque nouvelle logique (voir `tests/fake-supabase.ts`).
- Toute nouvelle table ou colonne passe par une migration dans `supabase/migrations/`, avec RLS. Les fonctions RPC qui lisent les données d'un étudiant doivent être `security invoker` et filtrer sur `auth.uid()`.
- Aucun appel d'IA par étudiant et par offre pour le score : seule l'analyse approfondie, déclenchée par l'étudiant, en fait un.
- Textes de l'interface en français, au tutoiement, phrases courtes, pensés pour le mobile en premier.
- Ne jamais afficher ni mettre dans le code une clé, un mot de passe ou un secret.
- Backlog produit : `docs/PRODUCT-BACKLOG.md` dans le dépôt, plus un document Claude Docs tenu par le propriétaire.
