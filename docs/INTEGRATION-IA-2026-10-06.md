# Intégration IA et activation — 6 octobre 2026

## État vérifié au 7 octobre 2026 — référence actuelle

- Catalogue : **3 890/3 890 offres ouvertes vectorisées**, espace `perplexity/pplx-embed-v1-0.6b@retrieval-v1`, **1 024 dimensions** vérifiées en base. Rattrapage protégé livré dans la [PR #2](https://github.com/afif-yassine/Job-Hunter-Control-/pull/2), commit de fusion `1bdf142c`. **78 appels, 1 564 031 tokens, 0,006257 USD** comptabilisés. Relance terminée avec `embedded: 0`, aucun appel supplémentaire.
- `EMBEDDING_PROVIDER=gateway` activé après le rattrapage ; redéploiement de production **`dpl_9vxtwW7stxYSyLejKuZQPxUYZQ8J` READY**. Le cron utilise Perplexity et Qwen, les dernières réponses sont HTTP 200 sans erreur. **2 788 résumés sur 3 890** au dernier contrôle, progression automatique en cours.
- Kit réel créé depuis le compte connecté : **un appel GPT-6 Luna, 3 402 tokens d'entrée et 1 313 de sortie, coût 0,001082 USD**. CV et lettre sauvegardés avec 24 preuves et la même version ; non approuvés et à relire. Les deux PDF d'une page s'ouvrent dans Chrome. Réouverture du dossier : mêmes documents, sans nouvelle génération.
- Plafond de la clé durable maintenu à **2 USD**, sans renouvellement automatique. Aucun achat ni changement de ce plafond.
- Vérification de recherche avec le profil réel **en attente** : Chrome ne répond plus aux commandes de l'extension ; le profil n'a pas encore de vecteur Perplexity. Le propriétaire est invité à lancer une recherche. La calibration de la note sémantique et la validation complète des reformulations restent ouvertes.
- **Import CV PDF non validé** : ce parcours reste sur Gemini, dont le crédit est épuisé. Le succès du rendu PDF des documents générés ne valide pas l'import/OCR.

Le rattrapage se lance par POST `/api/cron/embeddings`, avec l'Authorization CRON_SECRET déjà configurée côté serveur. Maximum 300 offres par exécution, 40 secondes de travail, délai de requête ajusté au temps restant, réservations SQL et libération après erreur. Ne pas ajouter la clé ou le secret aux journaux. Le rattrapage ne lance ni lecture LLM d'offre ni génération de profil.

Validation : CI GitHub et build Vercel réussis ; tests ciblés du contrôle d'accès, du délai, des erreurs masquées et de l'absence de reprise automatique réussis. Supprimer temporairement le contrôle d'accès fait échouer le test attendu ; code restauré avant livraison.

**Historique de préparation et première activation** : les sections suivantes décrivent les étapes antérieures et ne remplacent pas l'état actuel ci-dessus.

## Activation texte vérifiée en production

Le propriétaire a créé une clé durable, configuré `AI_GATEWAY_API_KEY` comme secret de production et choisi un plafond de **2 USD**, sans renouvellement automatique (confirmé dans AI Gateway). Le routage `AI_PROVIDER=gateway`, Qwen3.7 Flash lecture/analyse et GPT-6 Luna rédaction a été configuré, puis redéployé : `dpl_F2Ge1j9a1KAQQq4EPBGjECEmvKhr`, READY, associé à `lebontaf.com`, commit `495a221d`.

Contrôle réel de collecte : première tentative avec erreur de lecture ; deuxième tentative HTTP 200, **52 offres lues**, 52 appels Qwen enregistrés dans `ai_usage`, environ **0,002591 USD** comptabilisés. La clé et la lecture fonctionnent en production. La rédaction GPT est configurée mais un kit complet sur cette clé n'a pas encore été vérifié. L'espace Perplexity reste désactivé et sans vecteurs ; l'embedding historique Gemini échoue encore pour crédit épuisé. Le rattrapage Perplexity et la vérification d'un kit/recherche avec profil réel restent à terminer. Les constats de préparation ci-dessous décrivent l'étape précédente.

Après préparation locale, le propriétaire a autorisé la suite. La migration a été appliquée explicitement sur `zisjcdjfvqcwqehwsdeo`, sous la version distante `20261006152810` (fichier local créé auparavant : `20261006145105`). Les contrôles de permissions sur la base cible passent ; les advisors ne signalent pas de nouveau problème. `AI_GENERATION_LEASES=1` est configuré dans Vercel. La clé durable `AI_GATEWAY_API_KEY` est encore absente : les nouveaux modèles et le rattrapage Perplexity ne sont pas activés. Aucun nouvel appel API payant ; le comparatif précédent reste à 0,063568 USD déclarés cumulés.

État du catalogue au contrôle : 3 890 offres ouvertes, 1 922 vecteurs Gemini, zéro vecteur Perplexity et zéro résumé sauvegardé. Base : environ 49 Mo. Les tests SQL réels de refus entre comptes ont été exécutés dans une transaction annulée, sans modifier les profils.

## Changements préparés

| Composant | Comportement |
|---|---|
| Routage texte | `AI_PROVIDER=gateway` utilise Qwen3.7 Flash en lecture/analyse et GPT-6 Luna en rédaction ; configurations par tâche possibles. Sans activation, Gemini reste le fournisseur. |
| Réponse de rédaction | JSON strict du kit, sortie bornée, refus d'une réponse tronquée, pas de reprise ou de modèle de secours automatique. Les autres tâches gardent leur propre forme JSON. |
| Contexte de rédaction | Sélection déterministe des faits du profil confirmé ; formations, langues et disponibilité renseignée préservées ; projets et expériences sélectionnés selon l'offre. Aucun appel IA pour cette sélection. |
| Contrôle et provenance | Compétences explicites du CV vérifiées contre les noms présents dans les preuves ; preuves et version conservées dans les documents. Les paragraphes restent à relire : ce contrôle ne garantit pas la vérité de toute reformulation. |
| Réouverture | Le même compte, profil, registre, offre et modèle réutilisent le kit sauvegardé sans nouvel appel ni quota de génération. Les révisions explicites restent des actions distinctes. |
| Concurrence des kits | Réservation SQL avec token et expiration de deux minutes, activée par `AI_GENERATION_LEASES=1` après migration ; une réservation indisponible refuse l'appel IA. |
| Profil | Suppression du recalcul forcé du vecteur à chaque sauvegarde ; cache de version vérifié avec présence du vecteur. |
| Perplexity | Adaptateur Gateway 1024 dimensions, validation des lots, stockage parallèle versionné, prise en compte des coûts retournés. Les anciens vecteurs Gemini sont conservés. |
| Sources modifiées | Triggers d'invalidation des vecteurs Perplexity ; refus d'enregistrer un résultat si la source a changé pendant le calcul. |
| Classement | RPC versionnées n'associant que des espaces compatibles ; ordre de proximité préservé pendant l'import. Aucun seuil Gemini appliqué à Perplexity. La note numérique reste fondée sur les compétences tant que le nouvel espace n'est pas calibré. |
| PDF | Import conservé sur Gemini avec `GEMINI_API_KEY` et éventuellement `AI_MODEL_PDF`. Les essais d'import texte ne valident pas le PDF ou l'OCR sur GPT. |
| Comptabilité | Coût retourné par Gateway prioritaire ; estimation à partir des tarifs du modèle si ce coût manque. Prix GPT-6 Luna aligné sur la route testée, Perplexity ajouté à l'estimation. |

Les tables existantes profiles/documents/offres ont RLS activée au contrôle en lecture seule du 6 octobre ; profiles et documents ont des politiques de propriétaire. La nouvelle migration a été testée dans PostgreSQL/pgvector local avec deux comptes synthétiques. Cela ne remplace pas le contrôle après son application sur la base cible.

## Migration et activation ultérieure

Fichier créé avec Supabase CLI 2.119.0 : `supabase/migrations/20261006145105_versioned_perplexity_vectors.sql`.

1. Vérifier la liste des migrations déjà appliquées : certaines migrations du dépôt portent une date du 7 octobre ; ne pas appliquer aveuglément tout le dossier. La nouvelle migration doit être appliquée explicitement et enregistrée correctement dans l'historique, après revue/advisors.
2. Vérifier les RPC et RLS de la base cible avec comptes de test avant toute activation. Les nouveaux champs conservent Gemini en parallèle ; aucun effacement des anciens vecteurs n'est nécessaire.
3. Configurer une clé Gateway durable de production, un plafond Gateway et des quotas applicatifs. Ne pas utiliser la clé temporaire du comparatif. Garder la clé Gemini pour le PDF et le chemin historique.
4. Activer les tâches texte et les réservations SQL, puis vérifier un kit en environnement de préproduction. Exemple de variables : `AI_PROVIDER=gateway`, `AI_MODEL_READING=alibaba/qwen3.7-flash`, `AI_MODEL_WRITING=openai/gpt-6-luna`, `AI_GENERATION_LEASES=1`.
5. Rattraper les offres Perplexity avec le service, par lots bornés ; ne pas envoyer les 3 000+ offres dans une génération de kit. `embedSemanticOffers` peut être appelé indépendamment du flag de production pour ce rattrapage. Chaque résultat est partagé entre les comptes.
6. Vérifier le nombre de vecteurs manquants avant d'activer `EMBEDDING_PROVIDER=gateway` pour profils/collecte. Un profil Perplexity ne peut chercher que parmi les offres de son espace. Effectuer une recherche réelle et contrôler le parcours mobile, le PDF et les questions.
7. Calibrer le score sémantique sur des profils/offres représentatifs avant d'ajouter sa note numérique ; jusque-là, proximité pour le classement et compétences pour la note.

Les réservations SQL couvrent les kits et les embeddings d'offres/profils ; elles expirent après deux minutes et sont libérées avec leur token. Un traitement déjà réservé ne lance pas d'appel. Les requêtes texte/PDF Gemini et Gateway sont bornées à 60 secondes, sans reprise automatique. Les révisions restent sans réservation dédiée. Le plafond applicatif global de dépenses, les alertes, la validation des reformulations et la suppression de l'analyse LLM préalable restent dans le backlog.

## Vérifications locales

- Suite applicative : 158 tests réussis, aucun échec, un test LaTeX ignoré faute de `pdflatex`.
- PostgreSQL/pgvector : 24 assertions sur migration, RLS, espaces incompatibles, source périmée, réservations des vecteurs et kits, refus du rôle anonyme. Une mutation supprimant le refus d'embedding sans réservation fait échouer le test prévu ; le code a été restauré.
- TypeScript, lint complet (aucune erreur ; trois avertissements dans les scripts de comparatif) et compilation Next.js réussis.

Commandes : `node --import tsx --test --test-concurrency=1 tests/*.test.ts`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/next/dist/bin/next build`. Pour le test SQL, installer les dépendances épinglées dans `tools/semantic-db-test` avec pnpm puis exécuter `node scripts/test-semantic-migration.mjs`. Aucun de ces tests n'appelle un LLM réel.

Sources : [Gateway Chat Completions](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions), [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [extensions PGlite](https://pglite.dev/extensions/). Les comportements spécifiques du projet sont vérifiés par ses tests, pas déduits des documentations des fournisseurs.
