# Destinataires des données personnelles — état lu dans le code (7 octobre 2026)

Document d'analyse, pas un avis juridique. Il sert de base à la réécriture de la page de confidentialité et à la décision du propriétaire. Il ne modifie ni le code ni le backlog.

**Méthode.** Inventaire par recherche dans le dépôt, puis contrôle ligne à ligne des points qui comptent le plus.
- **[vérifié]** : relu dans le code ou le document cité, avec le fichier et la ligne.
- **[inventaire]** : relevé par la recherche automatique, non relu ligne à ligne ici. À contrôler avant de l'écrire dans une page publique.
- **[non vérifiable]** : le dépôt ne dit rien. Voir la dernière section.

Aucun fichier `.env` n'a été lu : seuls des noms de variables sont cités.

## 1. Ce qui décide qui reçoit les données

- Le texte de l'IA est envoyé à Google Gemini **par défaut** si `AI_PROVIDER` n'est pas défini (`lib/ai.ts:83`). Avec `AI_PROVIDER=gateway`, il part vers Vercel AI Gateway (`lib/ai.ts:35,40,112`). **[vérifié]**
- Les vecteurs (embeddings) passent par le Gateway seulement si `EMBEDDING_PROVIDER=gateway` (`lib/semantic-embeddings.ts:12`). Sinon c'est le chemin Gemini (`lib/embeddings.ts:29,37`, modèle `gemini-embedding-001`). **[vérifié]**
- Le chemin Gemini reste donc **entièrement présent dans le code**, y compris l'envoi du PDF du CV en base64 (`lib/ai.ts:168-176`, `inlineData`). **[vérifié]**
- Ce qui tourne **réellement en production** n'est pas lisible dans le dépôt. Les documents disent que le Gateway est actif (`docs/INTEGRATION-IA-2026-10-06.md:8,22`, `docs/CONTEXTE-PROJET.md:48`), mais ce sont des déclarations, pas une preuve de configuration.

## 2. Vercel AI Gateway et les fournisseurs de modèles

Endpoints : `https://ai-gateway.vercel.sh/v1/chat/completions` (`lib/ai.ts:112`) et `/v1/embeddings` (`lib/semantic-embeddings.ts:18`). **[vérifié]** Variable de clé : `AI_GATEWAY_API_KEY`.

Modèles par défaut avec le Gateway (`lib/ai.ts:41`, `lib/semantic-embeddings.ts:8`) **[vérifié]** :
- lecture et analyse : `alibaba/qwen3.7-flash` ;
- rédaction, import du CV : `openai/gpt-6-luna` ;
- vecteurs : `perplexity/pplx-embed-v1-0.6b`, 1 024 dimensions.

Le préfixe de l'identifiant (alibaba, openai, perplexity) est la seule indication du fournisseur dans le code. Où ces modèles sont réellement hébergés, et ce que le Gateway conserve, n'est écrit nulle part dans le dépôt.

| Fonction | Données envoyées | Preuve |
| --- | --- | --- |
| Import du CV (Gateway) | Texte complet extrait du PDF en local : il contient nom, e-mail, téléphone, ville, liens. Le fichier PDF lui-même n'est pas envoyé et n'est jamais stocké. | `app/api/profile/import/route.ts:13-16,28-33,40-42` **[vérifié]** |
| Import du CV (chemin Gemini) | Le **PDF original** en base64, envoyé à Google. | `lib/ai.ts:168-176` **[vérifié]** |
| Analyse d'une offre | Le JSON du profil (expériences, formations, projets, compétences, langues, cible de recherche), le registre de vérité et l'offre. Les colonnes nom, e-mail, téléphone sont stockées à part, hors de ce JSON. | `lib/pipeline/analyze.ts:143,192` et `lib/profile-store.ts:63-67` **[vérifié]** |
| Création du CV et de la lettre | Les « preuves » sélectionnées dans le profil et l'offre. | `lib/pipeline/generate.ts`, `lib/writing-context.ts` **[inventaire]** |
| Modification d'un document | La consigne libre de l'étudiant (jusqu'à 2 000 caractères), le contenu actuel du document, les preuves et l'offre. | `app/api/documents/[id]/revise/route.ts:18,64-88` **[vérifié]** |
| Vecteur du profil | Un texte construit à partir des expériences, projets, formations, compétences et de la cible de recherche, limité à 6 000 caractères. Ni nom ni e-mail. | `lib/embeddings.ts:93-107` **[vérifié]** |
| Lecture des offres et vecteurs des offres | Texte public des offres seulement ; aucun identifiant d'étudiant (les coûts sont enregistrés sans compte). | `lib/offer-reader.ts` **[vérifié]**, `lib/semantic-embeddings.ts:46-47` **[inventaire]** |

L'identifiant de compte et l'adresse IP ne figurent pas dans le corps des requêtes au Gateway (`lib/ai.ts:116-122`) **[inventaire]**. Ce que Vercel transmet comme métadonnées au fournisseur n'est pas visible.

L'application garde une trace locale des appels : compte, tâche, modèle, nombre de jetons, coût (`ai_usage`). Elle ne garde pas le contenu des requêtes (`lib/ai-usage.ts`) **[inventaire]**.

## 3. Google

- **Gemini (chemin historique)** : mêmes contenus que ci-dessus, plus le PDF du CV. Actif seulement si `AI_PROVIDER` ou `EMBEDDING_PROVIDER` ne valent pas `gateway`, avec `GEMINI_API_KEY`. **[vérifié]**
- L'interface affiche encore « IA Gemini » (`components/views/settings-view.tsx`) et « Clé Gemini manquante » (`components/views/home-view.tsx`). **[inventaire]**
- **Connexion avec Google** : `app/auth/google/route.ts`, via Supabase, activée par `NEXT_PUBLIC_GOOGLE_SIGNIN`. Google fournit nom, e-mail et photo à Supabase. **[inventaire]**
- **Google Drive** : le dépôt d'un PDF sur le Drive de la plateforme est réservé à l'administrateur depuis le commit `f94cf85d`. Les documents des étudiants n'y vont pas. **[vérifié]** (`app/api/documents/[id]/drive/route.ts`, `lib/admin.ts`).
- **Gmail** : une seule boîte d'alertes de l'opérateur, en lecture ; rien n'est envoyé par étudiant. **[inventaire]**
- **Polices** : fichiers locaux, pas de Google Fonts. **[inventaire]**

## 4. Supabase

Base de données et comptes. Pas de Storage utilisé : aucun appel `storage.from` n'a été trouvé. **[inventaire]**
- Stocké : nom, e-mail, téléphone, ville, liens, profil, registre de vérité, nom du fichier CV importé (pas le fichier), documents générés, suivi des candidatures, réglages, historique d'usage de l'IA. Liste des tables exportées : `lib/account.ts`. **[vérifié]** pour `candidate_profiles` (`lib/profile-store.ts:63-68`) et pour la présence de `documents`, `ai_usage`, `source_runs` dans l'export.
- Clés d'API saisies par l'étudiant : chiffrées avec `INTEGRATIONS_SECRET`. **[inventaire]**
- La page affirme « serveurs dans l'Union européenne (Irlande) » (`app/confidentialite/page.tsx:103`, `lib/brand.ts:25`). **[vérifié]** que c'est écrit ; **[non vérifiable]** que c'est la région réelle.

### Ajout du 8 octobre : liste des comptes pour l’administrateur

Depuis le commit `229f1ca8`, la route `GET /api/admin/users` renvoie à l’administrateur seul, pour chaque compte : adresse e-mail, dates d’inscription et de dernière connexion, CV importé ou non, nombre de dossiers du mois, appels et coût IA sur 30 jours. Aucun contenu de profil, de CV ou de document. À mentionner dans la page de confidentialité (PUBLIC-05).

## 5. Envoi des e-mails (Resend)

- Resend sert de SMTP personnalisé à Supabase : `smtp.resend.com`, expéditeur `no-reply@lebontaf.com`, domaine en région Europe (`docs/auth-emails/README.md:6,16,18`). **[vérifié]**
- Aucun code d'application n'appelle Resend : il est configuré dans les tableaux de bord Supabase et Resend. Reçoivent l'adresse de l'étudiant et le contenu des messages de confirmation, de lien de connexion et de réinitialisation. **[inventaire]**
- Resend n'est pas cité dans la page de confidentialité.

## 6. Vercel (hébergement) et Railway

- **Vercel** héberge le site et traverse toutes les requêtes ; il exploite aussi le Gateway. Aucun outil d'audience ou de suivi dans les dépendances directes de `package.json` ; le fichier `package-lock.json` contient un mot-clé de suivi à identifier (dépendance indirecte, non examinée). **[inventaire]**
- **Railway** (navigateur automatique) : reçoit seulement l'adresse de l'offre et un identifiant de candidature, jamais de CV ni d'e-mail (`app/api/worker/dispatch/route.ts:50,75-81`). **[vérifié]** La page de confidentialité dit qu'il « lit les formulaires » : cohérent. On ne sait pas si ce service est utilisé en production.

## 7. Sites d'emploi et autres services appelés

Envoyés par les recherches d'un compte : mots-clés et ville, pas d'identifiant d'étudiant.
- JSearch (RapidAPI) : `query` et `location` (`lib/scan/sources/jsearch.ts:138-139`). **[vérifié]**
- Adzuna : `what` et `where` (`lib/scan/sources/adzuna.ts:48-49`). **[vérifié]**
- Jooble, France Travail (mots-clés, départements, codes ROME), La bonne alternance (coordonnées de la ville via `api-adresse.data.gouv.fr`), pages carrières Greenhouse, Lever, Ashby, SmartRecruiters, Workable (seulement le nom de l'entreprise). **[inventaire]**
- Depuis le commit `b4a57ca5`, sans ville ni département choisis, ces sources ne sont plus appelées : seul le catalogue commun est lu (`lib/scan/index.ts`). **[vérifié]**
- La collecte commune de la plateforme n'envoie aucune donnée d'étudiant. **[inventaire]**
- **Webhook optionnel** `SCAN_WEBHOOK_URL` : s'il est configuré, il reçoit l'identifiant de compte (`lib/scan/index.ts:47-53`, corps `{ user_id, mode }`). **[vérifié]** Non vérifiable : s'il est défini en production.

## 8. Overleaf (non cité dans la page)

Le bouton « Éditer dans Overleaf » fait envoyer par le navigateur le source LaTeX du CV ou de la lettre à `https://www.overleaf.com/docs` (`components/views/documents-view.tsx:14-24`, autorisé par `lib/csp.ts:30`). **[vérifié]** Ce source contient les coordonnées (ville, téléphone, e-mail). L'envoi n'a lieu que si l'étudiant clique.

## 9. Export et suppression du compte

- L'export donne un fichier JSON des tables listées dans `lib/account.ts`. **[inventaire]**
- La suppression appelle `admin.auth.admin.deleteUser` (`app/api/account/route.ts:31`) et s'appuie sur des clés étrangères en cascade. **[vérifié]** pour l'appel. Un historique de recherche (`source_runs`) garde ses lignes avec l'identifiant mis à vide (`supabase/migrations/20260928090000_source_health_admin.sql:44`, `on delete set null`) : elles ne sont ni supprimées ni rattachées au compte. **[vérifié]**
- Aucune demande de suppression n'est envoyée aux tiers (Gateway, Google, Resend, Railway). **[inventaire]**
- Aucune purge automatique de l'historique d'usage de l'IA ni du journal d'audit n'a été trouvée. **[inventaire]**

## 10. La page de confidentialité actuelle face au code

Page : `app/confidentialite/page.tsx`. Constats, relus dans le fichier **[vérifié]** :
1. **Ligne 90 et 106** : « le texte de ton profil et de l'offre est envoyé à l'API Gemini de Google ». Si la production utilise le Gateway, c'est inexact : les destinataires sont Vercel (Gateway) et les fournisseurs de modèles (Alibaba pour la lecture, OpenAI pour la rédaction, Perplexity pour les vecteurs). Le chemin Gemini existe encore dans le code.
2. **Lignes 94-97** : la note sur l'offre gratuite de Gemini ne s'applique que si la clé Gemini gratuite est utilisée. Elle ne dit rien du Gateway.
3. **Lignes 100-107** : la liste des destinataires omet Resend (e-mails), le Gateway et les fournisseurs de modèles, et Overleaf (action de l'étudiant).
4. **Lignes 110-111** : « nous ne leur envoyons aucune donnée te concernant » pour les sites d'emploi. Les mots-clés et la ville choisis par l'étudiant leur sont envoyés (section 7). JSearch et Jooble ne sont pas cités dans la liste des sources.
5. **Ligne 116** : « effacés dès que tu supprimes ton compte » : un historique de recherche reste, sans identifiant (section 9).
6. **Lignes 109-110** : les clauses contractuelles types sont annoncées pour tous les prestataires ; le dépôt ne contient aucune trace de ces accords.
7. **Ligne 117** : « jusqu'à 30 jours » pour les journaux techniques : aucun réglage de conservation dans le dépôt.
8. Rien de contraire au code trouvé sur : pas de cookie publicitaire ni de mesure d'audience (ligne 138), le PDF du CV n'est pas conservé, export et suppression disponibles.

## 11. À vérifier par le propriétaire (non vérifiable depuis le dépôt)

- Quel chemin d'IA tourne en production aujourd'hui : variables `AI_PROVIDER` et `EMBEDDING_PROVIDER` dans Vercel ; et si la clé Gemini existe encore, si elle est gratuite ou payante.
- Les conditions du Vercel AI Gateway : conservation des requêtes, usage pour l'entraînement, « zéro conservation des données ».
- Où sont hébergés et ce que conservent Alibaba, OpenAI et Perplexity quand ils sont appelés par le Gateway ; si le Gateway ajoute des fournisseurs de secours.
- Conservation, région et accord de traitement de Resend, de Railway et de Vercel (journaux).
- La région réelle du projet Supabase (la page dit Irlande).
- Si `SCAN_WEBHOOK_URL` est défini, et si le service Railway est déployé et utilisé.
- Si toutes les tables d'étudiants sont bien supprimées en cascade (le schéma initial de `candidate_profiles`, `jobs`, `documents` n'est pas dans `supabase/migrations`).
- Si les clauses contractuelles types sont réellement signées avec chaque prestataire.
- Le contenu de l'entrée de suivi trouvée dans `package-lock.json`.
