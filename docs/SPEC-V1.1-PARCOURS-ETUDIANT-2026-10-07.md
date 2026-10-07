# LeBonTaf — Spécification v1.1 : nouveau parcours étudiant

**Statut : EN PAUSE.** Décision du propriétaire le 7 octobre 2026 : terminer d'abord les vérifications MVP-01 à MVP-06 puis le lancement public ; ce nouveau parcours devient la priorité v1.1 après ouverture. Le contrat d'API entre les deux sessions est **figé** et reste valable. Aucun code de cette spécification n'est écrit à ce jour.

Rédigée par la session Claude (frontend), en accord avec la session backend (job-hunter-ae). À relire avant tout démarrage : le code aura peut-être évolué entre-temps.

## 1. Décisions produit (validées par le propriétaire)

1. **Onboarding bloquant** : juste après l'inscription (mot de passe, Google ou lien magique), un écran dédié impose l'import du CV « global » existant avant d'entrer dans l'application. Pas de bouton « passer » ; encart discret « Pas ton CV sous la main ? Tu peux te déconnecter » pour ne pas emprisonner. Point de suivi : mesurer les abandons.
2. **Recommandations cumulatives, pas un top figé** : chaque jour, **8 nouvelles offres** sont déverrouillées (les meilleures non encore déverrouillées, classées selon le profil confirmé) ; **toutes les offres déjà déverrouillées restent visibles et utilisables** ; une offre déverrouillée ne se re-verrouille jamais, même « vue » sans action. Affichage regroupé par date de déblocage.
3. **Génération** : possible sur **toute offre déjà déverrouillée**, sous le seul quota existant de **2 kits CV + lettre par mois** (`lib/plan.ts`, inchangé). Modifications d'un kit existant : gratuites (comportement actuel conservé).
4. **Offres ajoutées manuellement** (« Ajouter une offre ») : déverrouillées d'office.
5. **Catalogue complet conservé** : la vue principale montre les recommandations (lot du jour + historique) puis le catalogue restant **flouté** en teaser (silhouettes non cliquables, message neutre **sans promesse de paiement** : « 8 nouvelles offres arrivent chaque jour ») ; un bouton « Explorer tout le catalogue » donne accès aux filtres et recherches sauvegardées déjà livrés. La consultation n'est jamais bloquée — seul le bouton de génération est verrouillé sur les offres non déverrouillées.
6. **Avant génération** : écran « Prépare ta candidature » dans le panneau de l'offre — ville (préremplie avec le lieu de l'offre, modifiable) + consigne libre facultative (≤ 600 caractères, puces de suggestion), puis lancement du kit.

## 2. Contrat d'API figé (frontend ↔ backend)

| Élément | Contrat |
| --- | --- |
| Offres déverrouillées | `GET /api/offers/unlocked` → `{ unlocked: Array<{ jobId: string; unlockedOn: string }> }` (camelCase). La route déclenche le lot du jour paresseusement. |
| Stockage côté serveur | Table `offer_unlocks` (user_id, job_id, unlocked_on) : +8 offres/jour à l'heure de Paris, calculées paresseusement à la première visite ; offres retirées de la source exclues des nouveaux lots mais jamais re-verrouillées côté historique. |
| Génération | `POST /api/jobs/[id]/generate` corps `{ city?: string ≤ 80, instruction?: string ≤ 600, auto?: boolean }` — `city`/`instruction` entrent dans la clé de cache `writingVersion` et dans le contexte de rédaction (truth rules conservées). Nouvelles erreurs : `400 INVALID_PREFERENCES`, `403 OFFER_LOCKED` (le garde vérifie la présence dans `offer_unlocks`, jamais la date). Codes existants inchangés. |
| Profil | `GET /api/profile` → `{ profile, confirmed: boolean }` ; `PUT /api/profile` → `{ profile, embeddingPending?: boolean }` (l'échec de vectorisation n'est plus avalé : log serveur + signal). `POST /api/profile/import` inchangé. |
| Offres manuelles | Trigger PostgreSQL `AFTER INSERT ON jobs WHEN source_platform='manual'` → insertion dans `offer_unlocks` (fonction security definer, `ON CONFLICT DO NOTHING`). Le front continue d'insérer via le client Supabase (`components/dashboard.tsx:348-384`), zéro changement. |
| Fallback frontend | Si `/api/offers/unlocked` est absent ou en erreur (déploiement, incident) → traiter **tout** comme déverrouillé, jamais de faux verrou. |

## 3. Architecture frontend (périmètre de la session Claude)

**À créer**
- `components/views/onboarding-view.tsx` — porte plein écran 3 étapes (bienvenue → dépôt PDF → revue du brouillon + enregistrement → révélation des recommandations). Logo `Mark`/`Wordmark`, progression, animations `lbtIn`, `MotionConfig reducedMotion="user"` existants.
- `components/profile-import-flow.tsx` — extraction partagée du flux d'import (hook `useProfileImport` + `<ProfileDraftReview>`) depuis `ProfileSection` (`components/views/settings-view.tsx:641-862`) : Réglages et onboarding consomment les mêmes pièces, comportement des Réglages inchangé.
- `components/views/recommended-view.tsx` — nouvelle vue « Offres » par défaut : lot du jour en cartes hero (badge `#N`), historique déverrouillé regroupé par date, teaser flouté, bouton « Explorer tout le catalogue ».
- `components/views/blurred-offers.tsx` — silhouettes du reste du catalogue (`filter: blur + grayscale`, `pointer-events: none`, `aria-hidden`, non focusables au clavier).
- `components/views/prepare-kit-step.tsx` — formulaire inline ville + consigne avant `act.prepareKit`.

**À modifier**
- `app/page.tsx` — vérification serveur du profil (`profileSummary`, déjà exporté par `lib/profile-store.ts`) → prop `needsOnboarding` ; fail-open en cas d'erreur.
- `components/dashboard.tsx` — gate d'onboarding (~15 lignes après tous les hooks) ; `ctx.unlockedJobs: Map<jobId, unlockedOn>` alimenté par `GET /api/offers/unlocked` ; `act.prepareKit(job, { city?, instruction? })` ; routage recommended/jobs.
- `components/views/types.ts` — type Ctx + signature `prepareKit`.
- `components/views/offer-card.tsx` — prop `rank?: number` (badge).
- `components/views/offer-panel.tsx` — intégration `PrepareKitStep` ; encart verrou sur offre non déverrouillée : « Cette offre n'a pas encore été recommandée. 8 nouvelles offres arrivent chaque jour. » ; toast sur `403 OFFER_LOCKED`.
- `components/views/home-view.tsx` — « Nouvelles offres pour toi » alignée sur les déverrouillées du jour.
- `app/globals.css` — `.onboarding-*`, `.rank-badge`, `.offer.is-top`, `.offers.is-blurred`, `.prepare-step` (tokens `:root` et `lbtIn` existants).
- `components/views/jobs-view.tsx` — reste l'explorateur catalogue (filtres, facettes, recherches sauvegardées) ; aucune suppression.

**Edge cases** : PDF scanné / > 5 Mo → erreur lisible dans l'écran + « Réessayer » ; comptes existants sans profil → même porte (vérif serveur) ; mode demo (`/demo`) sans porte ; email non confirmé ne voit jamais le dashboard (routes d'auth inchangées).

## 4. Résumé backend (périmètre de la session pair, à relire dans son plan final)

`offer_unlocks` + lot quotidien de 8 (Paris, paresseux) ; garde serveur sur `generate` (403 `OFFER_LOCKED`, uniquement la présence dans `offer_unlocks`) ; quota 2 kits/mois inchangé (`lib/plan.ts`) ; `claimUnlock` pour les offres manuelles câblé par le trigger ; `embeddingPending` sur `PUT /api/profile`.

## 5. Points de vigilance

- **Le parcours dépend du classement vectoriel** : si le vecteur du profil manque en production (échec silencieux historique de `app/api/profile/route.ts`, trigger d'invalidation `invalidate_semantic_embedding`), les recommandations seront vides. Diagnostic (console Supabase, lecture seule) : `select user_id, semantic_model, (semantic_embedding is not null) from candidate_profiles;` — correction sans déploiement : re-cliquer « Enregistrer ce profil » (déclenche `ensureSemanticProfile`).
- Plafond Gateway **2 USD** inchangé ; une vectorisation de profil est un coût minime mais à annoncer au propriétaire avant tout déclenchement manuel.
- Accessibilité du flou : zone `aria-hidden`, non focusable ; contrastes du thème clair uniquement.
- Aucune promesse de paiement dans le teaser (pas de tier Pro à ce jour).

## 6. Vérifications prévues au démarrage v1.1

1. `npm run typecheck` → `npm run lint` → `npm test` → `npm run build`.
2. Parcours manuel en dev : inscription → porte bloquante → import → recommandations du jour → catalogue flouté non cliquable → « Explorer tout le catalogue » → ville + consigne → génération réelle (clés de test de `.env.ai-test.local` copiées dans `.env.local`, valeurs jamais affichées) → génération sur offre non déverrouillée refusée → quota 2/mois affiché.
3. Production avec le propriétaire : compteur kits visible, recommandations classées, parcours complet, `403 OFFER_LOCKED` vérifié côté serveur.

## 7. Historique des décisions

- **7 octobre 2026** : plan frontend et plan backend conçus et coordonnés (contrat figé des deux côtés, aucun conflit de fichiers). Le propriétaire décide de **mettre en pause** le nouveau parcours : priorité aux vérifications MVP-01 à MVP-06 puis au lancement public (2-3 semaines). Cette spécification conserve toutes les décisions pour redémarrer sans repartir de zéro. Session coordinateur : job-hunter-4c ; frontend : Claude ; backend : job-hunter-ae.
