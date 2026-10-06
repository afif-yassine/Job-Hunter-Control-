# Comparatif IA — 6 octobre 2026

Premier essai préparé : Mistral Nemo, Qwen3.7 Flash, DeepSeek V4 Flash 0731, GPT OSS 20B et Nemotron 3.5 Lightning, 10 offres synthétiques et 6 kits CV/lettre par modèle (80 appels). Aucun accès à la base, aucun profil réel, aucune modification de production.

Plafond applicatif : 1 USD, autorisé par le propriétaire le 6 octobre. Appels séquentiels, sorties bornées, aucune relance automatique. Première série : réservation conservatrice de 0,018964 USD. Le script enregistre la réservation avant chaque appel, reprend sans répéter les requêtes déjà enregistrées et vérifie les prix du catalogue avant toute génération. Si le tarif courant dépasse le tarif prévu ou manque, il s'arrête pour revue. Ce contrôle ne remplace pas la vérification de la facturation et des éventuels suppléments du fournisseur. Ne pas supprimer le journal pour relancer : il assure le suivi du budget cumulé.

Le premier test court compare des capacités, pas encore exactement les prompts complets de production : il ne suffira pas à valider un remplacement. Après résultats, contrôler les inventions, omissions et lettres ; préparer une revue à l'aveugle avant décision. Les tests PDF et embeddings feront partie d'une validation distincte.

## Exécution

Prévisualisation sans réseau ni dépense : `node scripts/compare-ai.mjs`.

Configurer la clé Gateway dans le fichier local ignoré `.env.ai-test.local`, sous `AI_GATEWAY_API_KEY`, sans partager sa valeur dans le chat. Puis exécuter : `node --env-file=.env.ai-test.local scripts/compare-ai.mjs --run`.

Les résultats progressifs sont enregistrés dans `test-results/ai-comparison/results.json` (ignoré par Git). Le nom du modèle est conservé pour l'audit ; ne pas montrer ce champ pendant la revue à l'aveugle.

État : premier comparatif exécuté. 210 requêtes, 209 réponses, un échec réseau sans relance. Coût déclaré par Gateway : 0,006141 USD ; réservations conservatrices cumulées : 0,049153 USD. Clé remplacée après accord du propriétaire et enregistrée localement, expiration sept jours. Voir [RESULTATS-COMPARATIF-IA-2026-10-06.md](RESULTATS-COMPARATIF-IA-2026-10-06.md) pour les résultats, la correction du protocole et les limites. Qwen est le candidat provisoire pour l'extraction ; aucun modèle n'est validé pour la rédaction automatique en production.

## Suite : CV et lettres avec le contrat de l'application

Suite exécutée : [résultats et choix provisoire GPT-6 Luna](RESULTATS-CV-LETTRES-2026-10-06.md). Total cumulé déclaré Gateway 0,053110 USD, sous le plafond de 1 USD ; aucune migration en production. La validation sur vrais documents et les contrôles avant affichage restent à terminer.

Le script `scripts/compare-writing.mjs` lit le prompt historique figé dans `docs/benchmarks/writing-prompt-v1.txt` et le schéma de `lib/generated.ts`, sans exécuter le pipeline de production. Node 24 est requis pour importer directement le TypeScript. Tous les profils et entreprises restent fictifs. Les modèles et fournisseurs sont fixés pour rendre les coûts comparables ; une route indisponible est une erreur d'accès, pas une mauvaise note rédactionnelle.

Protocoles distincts, conservés dans le même journal budgétaire :

- `node --env-file=.env.ai-test.local scripts/compare-writing.mjs --run` : v2, prompt de production et mode objet JSON.
- Ajouter `--schema` : v3, même prompt avec le schéma JSON de l'application imposé.
- Ajouter `--mandatory` : v4, demande explicite des deux documents et cible de longueur ; le critère de réussite reste 170 à 240 mots.
- Ajouter `--polished` : v5, style professionnel, reformulation fidèle et liens entre faits et réalisations explicitement protégés. Deux nouveaux cas web et RH servent de contrôle après les ajustements du prompt.

Pour sélectionner les modèles, définir `TEST_MODELS` avec leurs identifiants séparés par des virgules. Sans `--run`, le script ne dépense rien. Les requêtes déjà présentes pour le même modèle et protocole sont ignorées, y compris celles ayant échoué ; aucune relance cachée. Le journal conserve prompts, paramètres, sorties, coûts déclarés et réservations avant appel. Les erreurs réseau sont comptées dans les réservations, même sans coût retourné.

Audit local : `node scripts/audit-writing.mjs`. Il vérifie format, documents présents, sections renseignées, longueur et quelques contradictions connues. Une relecture des faits et du style reste obligatoire : ces contrôles ne constituent pas un détecteur exhaustif d'inventions. L'audit détaillé est enregistré dans `test-results/ai-comparison/writing-audit.json`, ignoré par Git.

## Suite : embeddings, preuves et import CV

Suite exécutée : [rapport embeddings et RAG](RESULTATS-EMBEDDINGS-RAG-2026-10-06.md). Dernier cumul : 471 requêtes, 464 réponses, coût déclaré 0,063568 USD ; réservations 0,335539 USD, plafond total 1 USD. Les chiffres précédents décrivent les étapes antérieures. Ces essais ne constituent pas une migration ni une validation complète en production.

Avec Node 24 et la même clé locale, exécuter les scripts payants **séquentiellement**, car ils partagent le journal budgétaire :

- `node --env-file=.env.ai-test.local scripts/compare-embeddings.mjs --run` : première série, 28 modèles.
- Même commande avec `--hard` : deuxième série, métiers proches et requêtes multilingues.
- `node --env-file=.env.ai-test.local scripts/compare-rerank.mjs --run` : 4 modèles avec tarif exploitable ; les modèles sans prix ne sont pas appelés.
- `node --env-file=.env.ai-test.local scripts/test-grounded-rag.mjs --run` : réponses sourcées et cas sans preuve sur profils fictifs.
- `node --env-file=.env.ai-test.local scripts/test-cv-extraction.mjs --run --object` : import du texte de CV fictifs, sans PDF/OCR.

Ne pas supprimer le journal : les scripts ignorent les requêtes déjà enregistrées, même échouées. Contrôles locaux sans appel API : `node scripts/test-rag-safety.mjs`, puis `node scripts/audit-rag.mjs`, `node scripts/audit-embeddings.mjs` et `node scripts/report-rag.mjs`. Les audits et vecteurs restent dans le dossier ignoré ; le rapport partageable contient uniquement des résultats synthétiques.
