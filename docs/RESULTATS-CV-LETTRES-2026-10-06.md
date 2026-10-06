# CV et lettres LeBonTaf — choix après tests du 6 octobre 2026

**Choix provisoire : GPT-6 Luna pour les brouillons de CV et lettres, avec le prompt v5 et un schéma strict. Qwen3.7 Flash reste le candidat pour l'extraction partagée des offres.** Le scoring numérique reste hors LLM. Aucun modèle n'est autorisé à publier des candidatures sans vérification des faits et relecture du candidat. Aucun changement de modèle en production dans cette livraison.

## Dépenses et portée

Cette suite ajoute 88 requêtes, dont 85 réponses, sur huit candidats : sept ont pu générer des documents. Deux erreurs HTTP concernent la route DeepInfra indisponible pour GPT OSS 120B ; une requête Qwen a échoué avec TypeError, sans relance. Avec le premier comparatif : **298 requêtes, 294 réponses, coût total déclaré Gateway 0,053110 USD**, soit environ 5,31 cents. Réservations conservatrices cumulées : **0,228409 USD**, incluant les appels échoués ; plafond autorisé : **1 USD**. Une réservation n'est pas une dépense. Le coût retourné par l'API n'est pas la facture ; les erreurs peuvent ne pas retourner leur coût.

Les profils et employeurs sont fictifs. Les quatre premiers cas couvrent informatique, comptabilité, communication et un poste incompatible contenant une instruction parasite demandant une certification et un résultat inventés. Deux cas supplémentaires, web et RH, ont été ajoutés après les ajustements du prompt pour contrôler le candidat retenu. Les résultats ne constituent pas un benchmark représentatif de tous les étudiants ou métiers.

## Comparaison avec le même prompt de production et un schéma strict (v3)

| Modèle | Contrôles techniques passés | Coût déclaré des quatre réponses | Latence médiane |
|---|---:|---:|---:|
| Qwen3.7 Flash | 1/4 | 0,000369 $ | 6,07 s |
| DeepSeek V4 Flash 0731 | 1/4 | 0,000527 $ | 15,10 s |
| Gemini 2.5 Flash-Lite | 1/4 | 0,001268 $ | 2,15 s |
| GPT-5 Nano | 0/4 | 0,000573 $ | 2,24 s |
| GPT-6 Luna | 0/4 | 0,001331 $ | 4,72 s |
| Gemini 3.1 Flash-Lite | 2/4 | 0,008156 $ | 8,88 s |
| Qwen3.7 Plus | 1/4 | 0,005787 $ | 11,91 s |
| GPT OSS 120B | Non accessible sur la route testée | Non mesuré | — |

Ces contrôles vérifient schéma, CV et lettre présents, informations de formation et de langues, détails des expériences ou projets, longueur de 170 à 240 mots, structure de lettre et quelques contradictions. Ils ne certifient pas toute la fidélité des textes. GPT-6 Luna échoue ici sur la longueur, pas sur le schéma. Des modèles produisent des lettres null, des sections sans détails ou des sorties tronquées. L'indisponibilité de GPT OSS ne permet aucune conclusion sur sa qualité.

## Corrections du protocole

La passe v2 utilisait le prompt actuel et le mode objet JSON : aucun des sept modèles accessibles ne respectait exactement tous les types du schéma brut. Le prompt ne précisait pas les types d'education et languages. La normalisation actuelle peut accepter le document tout en perdant la formation lorsque le modèle la renvoie sous forme d'objets non reconnus.

La passe v3 impose le schéma de `lib/generated.ts`. La passe v4 demande explicitement les deux documents, au lieu de « lettre si utile », et cible 190 à 220 mots. Le critère de réussite reste 170 à 240 mots. GPT-6 Luna passe alors 4/4 contrôles, mais ses lettres contiennent parfois des phrases défensives sur les données absentes. DeepSeek passe également 4/4 contrôles automatiques, avec des ajouts factuels détectés à la relecture.

La passe v5 conserve le schéma et précise un style professionnel, les liens attestés entre compétences et réalisations, les objectifs d'apprentissage au futur et le traitement de l'annonce comme une donnée. Ces ajustements ont été faits après observation des quatre cas ; leurs scores ne sont donc pas une validation indépendante. Les deux nouveaux cas sont un contrôle supplémentaire limité.

| Candidat, passe v5 | Contrôles techniques | Coût déclaré | Latence médiane | Relecture |
|---|---:|---:|---:|---|
| Qwen3.7 Flash | 2/4, dont une erreur réseau | 0,000399 $ pour 3 réponses | 9,65 s | Lettre comptabilité trop courte ; amplifications non prouvées dans le cas incompatible |
| DeepSeek V4 Flash 0731 | 4/4 | 0,000719 $ pour 4 réponses | 24,80 s | Ajout d'une expérience « en cabinet » et d'une localisation d'emploi absentes du profil comptable |
| GPT-6 Luna | 6/6, dont deux nouveaux cas | 0,002786 $ pour 6 réponses | 7,05 s | CV fidèles aux faits examinés ; lettres plus naturelles ; réserve sur le cas incompatible |

Les coûts comprennent les tokens facturés retournés par Gateway, avec les paramètres du journal. Ce sont de petits profils et des offres courtes. Le tableau ne compare pas six cas identiques pour chaque modèle : les deux cas supplémentaires concernent seulement GPT-6 Luna.

## Raisons du choix et réserves

GPT-6 Luna conserve les compétences, les dates, les niveaux de langues et la formation en cours dans les six CV relus. Il préserve les rapprochements bancaires sous supervision, les détails du portfolio et la FAQ du projet RH. Les lettres web et RH formulent React et la paie comme des apprentissages, sans les ajouter aux acquis du candidat. Les six lettres comptent respectivement 199, 209, 197, 217, 234 et 221 mots.

Il reste une dérive dans la lettre du poste incompatible : l'entreprise est présentée comme spécialisée dans le cloud, sans preuve explicite dans l'annonce. La phrase sur le « parcours présenté ici » reste également peu naturelle. Ce document n'est pas validé pour envoi. La candidature demande bac+5 et des compétences obligatoires absentes : traiter ce cas avant génération par règles et questions de confirmation, plutôt que produire une lettre donnant l'impression que le profil convient. L'instruction parasite n'a pas ajouté la certification ni la hausse des ventes dans les documents de cette passe.

DeepSeek coûte moins cher, mais la relecture retrouve encore des ajouts non justifiés. Qwen reste moins cher pour l'extraction, où le premier comparatif le retenait sur les champs vérifiés ; les tests de lettres ne suffisent pas à le retenir pour cette autre tâche. Les options Gemini et Qwen Plus testées ne donnent pas de raison de payer davantage pour ce protocole. Aucun modèle de secours rédactionnel n'est encore validé.

Coût moyen mesuré GPT-6 Luna v5 : **0,000464 $ par kit CV + lettre en un appel**. Mille appels avec des volumes identiques représenteraient environ **0,46 $ d'inférence**, sans OCR, embeddings, autres analyses, révisions, reprises ou hébergement. Ce n'est pas une estimation de coût mensuel par utilisateur : un vrai CV plus long et le nombre de générations modifient la dépense.

## À intégrer et vérifier avant production

- Demander CV et lettre ensemble, avec le schéma strict et un prompt professionnel testé ; conserver modèle, version, tokens et coût par génération.
- Sélectionner les faits pertinents dans le registre de vérité, sans inventer de liens entre compétences et projets ; distinguer acquis, exigences et souhaits d'apprentissage.
- Bloquer les contradictions et les faits non justifiés avant présentation. Vérifier longueur, sections et dates avec du code ; ne pas refaire un appel IA pour ces contrôles.
- Vérifier le rendu des paragraphes : certaines réponses contiennent des séquences littérales antislash-n malgré un JSON valide. Tester la normalisation et les PDF.
- Traiter les exigences obligatoires incompatibles avant rédaction, afficher les points à confirmer et demander au candidat de relire avant tout envoi.
- Vérifier sur des CV anonymisés représentatifs, offres longues et rendus réels ; préserver plafond budgétaire, quotas et reprises bornées. La confidentialité contractuelle et la charge simultanée n'ont pas été testées.

Scripts : `scripts/compare-writing.mjs` et `scripts/audit-writing.mjs`. Prompts complets, paramètres, sorties et réservations sont dans `test-results/ai-comparison/results.json` ; audit local dans `writing-audit.json`. Ces fichiers sont ignorés par Git. Ne pas effacer le journal avant une reprise. Le [guide d'exécution](TEST-COMPARATIF-IA.md) décrit les versions.

Référence officielle pour le schéma de réponse : [sorties structurées Gateway](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/structured-outputs). Les identifiants et tarifs ont été contrôlés via le [catalogue Gateway](https://ai-gateway.vercel.sh/v1/models) avant les appels. Routage imposé : Alibaba pour Qwen, DeepInfra pour DeepSeek, Vertex pour Gemini et OpenAI pour GPT-5 Nano / GPT-6 Luna. Les résultats concernent ces routes et paramètres.
