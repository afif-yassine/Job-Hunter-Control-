# Scripts de comparaison IA (archivés le 9 octobre 2026)

Ces scripts ont servi aux comparatifs du 6 octobre 2026 (modèles d'écriture, vecteurs, reclassement, RAG).
Ils ne font plus partie du produit : aucun écran, aucune route, ni la CI ne les appelle. Les documents
`docs/TEST-COMPARATIF-IA.md`, `docs/RESULTATS-*.md` décrivent comment les relancer.

- Se lancent depuis la RACINE du dépôt, avec le chemin d'archive : `node --env-file=.env.ai-test.local docs/archive/scripts-comparatifs/compare-ai.mjs --run`
  (les chemins `test-results/…` et `docs/…` sont relatifs à la racine ; les imports de `lib/` ont été ajustés).
- Les scripts payants dépensent sur le Gateway **sans écrire dans `ai_usage`** : utiliser une clé dédiée au plafond bas.
- `test-semantic-migration.mjs` dépendait de `tools/semantic-db-test` (supprimé) : il ne tourne plus tel quel.
- `rag-evidence.ts` (module de preuves du RAG) est archivé ici, plus dans `lib/` : il n'était plus utilisé par l'application.
- Ce dossier est exclu de TypeScript et d'ESLint ; le lanceur de tests ne lit que `tests/*.test.ts`.
