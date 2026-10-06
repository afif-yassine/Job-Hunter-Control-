# Comparatif IA LeBonTaf — 6 octobre 2026

Test réel via Vercel AI Gateway, sur données fictives exclusivement. Plafond autorisé : 1 USD. Aucune modification de production.

Suite exécutée avec le prompt et le schéma de l'application : voir [tests CV et lettres](RESULTATS-CV-LETTRES-2026-10-06.md). GPT-6 Luna est désormais le candidat provisoire pour les brouillons ; les constats ci-dessous décrivent la première série, conservée comme historique.

## Mesures

210 requêtes enregistrées ; 209 réponses reçues. Coût total déclaré dans usage.cost par Gateway : **$0.006141**. Réservation conservatrice cumulée, y compris les requêtes échouées : **$0.049153**. Le coût déclaré par l'API n'est pas une facture ; une requête interrompue peut avoir été facturée sans mesure disponible.

| Modèle | Extractions conformes aux faits vérifiés | Schéma extraction | Latence médiane extraction | Coût déclaré des 10 extractions | Schéma CV/lettre | Lettre 170–240 mots |
|---|---:|---:|---:|---:|---:|---:|
| mistral/mistral-nemo | 7/10 | 9/10 | 4.06 s | $0.000047 | 6/6 | 0/6 |
| alibaba/qwen3.7-flash | 10/10 | 10/10 | 1.34 s | $0.000145 | 3/6 | 6/6 |
| deepseek/deepseek-v4-flash-0731 | 10/10 | 10/10 | 1.14 s | $0.000195 | 5/6 | 0/6 |
| openai/gpt-oss-20b | 10/10 | 10/10 | 1.91 s | $0.000280 | 6/6 | 3/6 |
| nvidia/nemotron-3.5-lightning | 6/10 | 9/10 | 0.58 s | $0.000173 | 5/6 | 0/6 |

L'extraction vérifie compétences explicitement demandées, niveau et télétravail, ainsi que les types des champs. Elle ne mesure pas toute la fidélité du résumé, les omissions de toutes les conditions ou la résistance aux injections. Le contrôle CV/lettre est structurel et ne certifie pas l'absence d'invention. Les lettres ont été relues pour identifier des exemples de dérives ; aucune note universelle de qualité n'est déduite de six exemples.

## Protocole et correction

Première série : 10 extractions et 6 kits CV/lettre par modèle, prompt simple sans mode JSON. Deuxième série : même jeu, mode JSON et consignes supplémentaires. Une règle CV a été appliquée par erreur aux extractions de la deuxième série : ces extractions sont exclues de la recommandation. Troisième série : 10 extractions par modèle, consignes corrigées et mode JSON. Les lettres de la deuxième série sont conservées, mais la consigne générale de null pour les faits absents a parfois provoqué des titres null et reste à améliorer.

JSON strict et conformité au schéma sont mesurés séparément. L'audit peut enlever une balise Markdown entourant le JSON pour examiner le fond, sans effectuer un autre appel IA. Aucun nouvel appel ne répare automatiquement une réponse. GPT OSS utilise reasoning.effort=low ; les autres modèles raisonnants reçoivent reasoning.enabled=false. Routage limité à DeepInfra, sauf Qwen limité à Alibaba. Les coûts concernent ces routes, paramètres et petits exemples.

## Recommandation provisoire et exemples relus

- Extraction des offres : Qwen3.7 Flash est le premier candidat, avec 10/10 sur les champs vérifiés et le coût le plus bas des trois modèles à 10/10. DeepSeek V4 Flash 0731 est un candidat de secours, légèrement plus rapide sur ce petit jeu. GPT OSS 20B réussit aussi, mais coûte davantage sur ces appels, qui incluent du raisonnement.
- CV/lettres : aucun modèle validé pour publication automatique. Qwen mérite une validation supplémentaire avec un profil au statut de formation explicite et un schéma imposé ; ses six lettres de seconde passe respectent la longueur, mais trois titres sont null et certaines lettres affirment encore un diplôme obtenu. Ce résultat ne certifie pas sa supériorité rédactionnelle.
- Nemo : ne pas retenir pour la rédaction française sur la route testée. Il produit des mots corrompus et, par exemple, affirme que le profil marketing maîtrise Python, SQL et Power BI dans redaction-3-1 de la première passe.
- GPT OSS : invente Pandas, Matplotlib et Git dans redaction-1-1 initial, ainsi que des cours d'anglais dans redaction-2-2. La seconde passe ajoute encore une disponibilité immédiate dans redaction-2-2.
- Nemotron : très rapide, mais ajoute Excel au profil marketing dans redaction-3-2, y compris après renforcement du prompt ; une autre réponse structurée contient un CV et une lettre vides.
- DeepSeek : une réponse en mode JSON contient seulement {"/**/":"unknown"} ; plusieurs lettres structurées sont trop courtes et une disponibilité à Paris est affirmée sans preuve dans redaction-1-2.

Ces constats sont des exemples vérifiables dans l'audit, pas des taux exhaustifs d'hallucination. Garder le scoring numérique hors LLM. Pour les documents, ne reprendre que des faits rattachés au registre de vérité et bloquer les ajouts non justifiés avant affichage.

### Portée

Ce test court ne couvre pas PDF/OCR, embeddings, prompts complets de production, offres longues, charge simultanée, confidentialité contractuelle ou qualité sur tous les métiers. Il ne suffit pas à valider la migration de l'application. Un JSON valide doit passer une validation de schéma et des vérifications liées au registre de vérité avant d'être proposé à l'étudiant.

Commandes des trois passes : scripts/compare-ai.mjs --run, puis --run --structured, puis --run --clean-extraction. Le script a depuis corrigé la consigne de la passe structurée ; les résultats historiques de cette passe utilisent l'ancienne consigne décrite ci-dessus. Le journal test-results/ai-comparison/results.json est ignoré par Git et ne doit pas être supprimé avant une reprise : les réservations y sont cumulées. L'audit détaillé est dans test-results/ai-comparison/audit.json. La clé reste dans le fichier local ignoré .env.ai-test.local, avec expiration de sept jours.
