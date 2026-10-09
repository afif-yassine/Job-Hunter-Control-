# Note de conception — sélection du jour en une requête en base (10 octobre 2026)

Demande du propriétaire : « que la plateforme voie toutes les offres de la base et donne les meilleurs résultats, même avec 100 millions d’offres ». Cette note est **de la conception, sans code ni migration appliquée**. Elle distingue ce qui est **établi** (lu dans le dépôt ou dans la documentation de pgvector, citée), ce qui est **calculé** (hypothèses écrites) et ce qui est **à vérifier** avant de s’y fier.

## 0. Situation actuelle (établi, lu dans le code)

- L’index existe : `offers_semantic_embedding_idx`, HNSW, `vector_cosine_ops`, **partiel** `where status = 'open'` (`20261006145105_versioned_perplexity_vectors.sql`, ligne 6). La fonction `match_offers_for_me_v2` classe tout le catalogue ouvert par proximité, **sans aucun filtre** (ni contrat, ni zone, ni ancienneté, ni « déjà débloquée »).
- Mais la sélection du jour ne repose pas sur elle : `importFromCatalogue` (`lib/scan/catalogue.ts`) lit 3 000 lignes au plus **en mémoire du serveur**, garde 300 offres « par mots ou catégories » **avant** tout classement, et 40 « voisines » prises parmi les 200 plus proches. Ce n’est donc pas « la base choisit les meilleures », c’est « le serveur lit un morceau du catalogue et le trie ».
- La zone (`inArea`, `lib/scan/area.ts`) est un contrôle de texte en mémoire sur le champ `location`.

## 1. Faisable en une fonction SQL ? Oui, avec une migration additive

Une fonction `select_daily_candidates(p_user uuid, p_limit int, p_days int, p_contracts text[], p_categories text[], p_departments text[])`, `security definer`, appelée par le serveur avec la clé de service (comme `claim_daily_unlock`). Elle lit le vecteur du CV de `p_user` (ne dépend pas de `auth.uid()`), puis renvoie des lignes `(offer_id, similarity, skills, contract_kind, departments, published_at)` :

```
offres ouvertes
 ET vues récemment (last_seen_at)
 ET publiées dans la fenêtre du compte (published_at >= now() - p_days)
 ET contrat voulu (contract_kind = any(p_contracts))
 ET zone voulue (departments && p_departments)           -- voir §4
 ET catégories voulues (categories && p_categories)
 ET PAS déjà débloquées par ce compte (not exists offer_unlocks)
ORDRE par distance cosinus au vecteur du CV, LIMIT p_limit
```

Puis le serveur (TypeScript, déjà écrit) calcule la **note affichée** (couverture des compétences, qualités exclues), applique le plancher et garde les 8 meilleures. Le calcul de la note reste côté serveur : il dépend de la liste des « qualités personnelles » et de la formule, qui évoluent ; les mettre en SQL dupliquerait la règle.

Migration à prévoir (non appliquée), dans l’ordre : (a) colonne `offers.departments text[]` + index GIN (§4) ; (b) la fonction ; (c) optionnellement `offers.skills text[]` + index GIN (§3). Tout est additif, rien n’est supprimé.

**Réserve importante sur « les meilleures notes »** : la base classe par *proximité du vecteur*, pas par *note affichée*. Les deux sont corrélées, pas identiques. Si l’on ne ramène que 200 candidates, la meilleure note peut se trouver au rang 300 en proximité. Il faut donc ramener **plus** que 8 : je propose `p_limit = 500` (le maximum de `hnsw.ef_search` de pgvector est à vérifier, §2), puis reclasser par note côté serveur. Cette hypothèse se mesure : comparer, sur 3 profils réels, le lot obtenu avec 200, 500 et 1 000 candidates.

## 2. pgvector + HNSW + filtres : le piège et les vraies options

**Établi (documentation officielle de pgvector, lue le 10 octobre 2026)** :

- « Le filtre est appliqué *après* le parcours de l’index. Si une condition correspond à 10 % des lignes, avec HNSW et `hnsw.ef_search` à 40 par défaut, seulement 4 lignes correspondront en moyenne. » C’est le piège : un filtre sélectif (petite zone, un contrat rare) renvoie **peu ou pas de résultats**, sans erreur.
- Options citées par la documentation : (1) un index ordinaire sur la colonne filtrée, « efficace pour les conditions qui retiennent un faible pourcentage de lignes » ; (2) un index **partiel** si le filtre n’a que quelques valeurs ; (3) le **partitionnement** si le filtre a beaucoup de valeurs ; (4) les **parcours itératifs** : « à partir de la version 0.8.0, vous pouvez activer les parcours itératifs de l’index » ; (5) augmenter `hnsw.ef_search` (« meilleur rappel, plus lent »).
- Réglages des parcours itératifs : `hnsw.iterative_scan` = `strict_order` ou `relaxed_order` (la page de Supabase indique que la valeur par défaut est `off`) ; `hnsw.max_scan_tuples` (20 000 par défaut) ; `hnsw.scan_mem_multiplier` (1 par défaut). `hnsw.ef_search` : 40 par défaut.
- Taille d’un vecteur : `4 × dimensions + 8` octets, soit **4 104 octets** pour 1 024 dimensions ; `halfvec` : `2 × dimensions + 8` = 2 056 octets.
- Supabase indique que les index HNSW acceptent `vector` jusqu’à 2 000 dimensions et `halfvec` jusqu’à 4 000 à partir de pgvector 0.7.0, et que les parcours itératifs viennent avec 0.8.0.

**À vérifier sur NOTRE projet (je ne le suppose pas)** :

1. Version installée : `select extversion from pg_extension where extname = 'vector';` Si elle est **inférieure à 0.8.0**, pas de parcours itératif : il faut une mise à niveau (réglage du projet) ou l’une des options ci-dessous.
2. Le plan d’exécution réel (`explain (analyze, buffers)` de la fonction avec un vrai compte) : le planificateur peut choisir **de ne pas utiliser l’index** quand les filtres sont sélectifs, ce qui est précisément ce qu’on veut à notre taille (voir plus bas).
3. Le rappel : comparer, pour 3 comptes, le résultat exact (sans index) et le résultat indexé ; mesurer combien des 8 meilleures sont perdues.

**Ce que je recommande, dans l’ordre :**

- **A. À notre volume (quelques milliers à 100 000 offres ouvertes), le plus sûr est de ne PAS dépendre de l’index :** filtrer d’abord avec des index ordinaires (statut, contrat, publication, zone), puis trier *exactement* par distance sur les quelques milliers de lignes restantes. Un tri exact de 20 000 vecteurs de 1 024 dimensions représente de l’ordre de 20 millions de multiplications : de l’ordre de **quelques dizaines de millisecondes** (hypothèse de calcul, à mesurer). Aucun risque de « résultats manquants ». C’est le « pré-filtrage ».
- **B. Quand le volume filtré dépasse ce qui se trie vite** (quelques dizaines de milliers de lignes par requête) : garder l’index HNSW et activer `set local hnsw.iterative_scan = 'relaxed_order'` dans la fonction (le reclassement par note côté serveur absorbe le léger désordre), avec `hnsw.max_scan_tuples` borné. **Seulement si l’extension est ≥ 0.8.0.**
- **C. Si l’extension est < 0.8.0 :** surélever `hnsw.ef_search` dans la fonction (`set local`) et ramener plus de lignes avant filtrage — moins fiable ; la voie A reste la bonne tant que le volume est faible.
- **D. Index partiels par contrat** (alternance / stage / CDD) : possibles (3 valeurs), utiles seulement en voie B. Je ne les recommande pas d’emblée : ils triplent la taille de l’index.
- **E. Pré-filtrage par département** par partitionnement : disproportionné avant plusieurs millions d’offres.

## 3. Repli quand le CV n’a pas de vecteur

Aujourd’hui `candidate_profiles.semantic_hash` vide = pas de vecteur. Dans ce cas la fonction exécute la **voie « compétences »** : même filtres, ordre par nombre de compétences en commun entre `candidate_profiles.skills` et les compétences lues de l’offre. Deux réalisations :

- sans nouvelle colonne : `cardinality(array(select s from jsonb_array_elements_text(o.summary->'skills') s where s = any(p.skills)))` sur les lignes déjà filtrées (OK à notre volume, pas d’index utile) ;
- avec une colonne `offers.skills text[]` (maintenue par l’écriture du résumé, `finish_offer_reading`) et un index **GIN**, l’opérateur `&&` retrouve les offres qui partagent une compétence **par l’index**, utile au-delà de ~100 000 offres.

Le serveur reçoit `similarity = null` et classe par note, comme aujourd’hui.

## 4. La zone : faut-il une colonne département normalisée ?

**Oui.** Le texte libre `location` ne se filtre pas par un index. Les formats sont hétérogènes : France Travail écrit « 75 - PARIS 11 », d’autres sources « Paris, Île-de-France » ou « Lyon (69) ». Le code TypeScript sait déjà extraire les départements (`departmentsOf`, `lib/scan/area.ts`). Proposition : `offers.departments text[]` (une offre peut couvrir plusieurs départements ; vide = inconnu), écrit à l’insertion par la collecte et complété pour l’existant par la tâche de rattrapage qui complète déjà `contract_kind` (`recategorize`), index GIN, filtre `departments && p_departments`. **Règle à garder :** un compte sans zone choisie (liste vide) = toute la France ; une offre sans département connu = *incluse* si le compte n’a choisi aucune zone, *exclue* sinon (comme `inArea` aujourd’hui — à confirmer en relisant ses cas limites avant d’écrire la fonction).

## 5. Ordres de grandeur (calculés, hypothèses écrites)

**Hypothèses.** Vecteur 1 024 dimensions en `vector` = 4 104 octets ; index HNSW de pgvector ≈ une copie du vecteur plus les listes de voisins, **estimé à 4,5 Ko par offre** (à mesurer : `select pg_size_pretty(pg_relation_size('offers_semantic_embedding_idx')), count(*) filter (where semantic_embedding is not null) from public.offers;`) ; texte et résumé d’une offre ≈ 5 Ko ; autres colonnes négligées. Mesure actuelle de la base : environ 140 Mo pour ~5 000 offres (donnée du propriétaire), soit ~28 Ko par offre tous éléments confondus (comprend l’ancien vecteur Gemini de 768 dimensions, les copies dans `jobs`, etc.).

| Offres ouvertes | Vecteurs | Index HNSW | Texte | Total vecteur + index + texte |
| --- | --- | --- | --- | --- |
| 5 000 (aujourd’hui) | 21 Mo | 23 Mo | 25 Mo | ~70 Mo (le reste des 140 Mo = copies, ancien vecteur, autres tables) |
| 100 000 | 0,41 Go | 0,45 Go | 0,5 Go | **~1,4 Go** |
| 1 000 000 | 4,1 Go | 4,5 Go | 5 Go | **~14 Go** |
| 100 000 000 | 410 Go | 450 Go | 500 Go | **~1,4 To** |

**Ce que cela implique (déduit des chiffres, à confirmer sur la grille tarifaire de Supabase, que je n’ai pas lue pour cette note)** :

- **Jusqu’à ~100 000 offres** : la conception A/B tient. La base de 500 Mo du forfait gratuit est dépassée dès ~30 000 offres avec cette taille de vecteur (500 Mo ÷ ~17 Ko d’offre utile ≈ 30 000). Il faudra le forfait payant avant, mais **aucune autre infrastructure**. Passer en `halfvec` (2 056 octets) réduit vecteurs et index de moitié, avec une perte de précision à mesurer.
- **Autour de 1 million** : ~14 Go, l’index (~4,5 Go) et les vecteurs doivent tenir en mémoire vive pour rester rapides : il faut une instance à plusieurs dizaines de Go de RAM, `maintenance_work_mem` élevé pour construire l’index, parcours itératifs obligatoires (voie B). C’est la limite raisonnable d’une base PostgreSQL unique sur la plateforme actuelle.
- **100 millions** : ~1,4 To et un index de ~450 Go : **hors de portée d’une base unique** de ce type. Il faudrait un moteur vectoriel dédié, de la quantification (vecteurs en bits ou en demi-précision), du partitionnement par zone ou par contrat, et un re-classement en deux temps. Je ne promets rien sur ce palier : c’est un autre projet.
- **Seuil de changement d’infrastructure** : *quand l’index HNSW ne tient plus dans la mémoire de l’instance* (de l’ordre de quelques millions d’offres avec ces vecteurs), ou *quand une requête filtrée dépasse un temps acceptable* sur des mesures réelles. Pas avant.

**Une remarque d’honnêteté sur « 100 millions » :** le catalogue ne contient que des offres **ouvertes** de notre périmètre (stage, alternance, CDD dans l’informatique, le numérique et la bureautique), fermées ou expirées après 21 jours (`EXPIRE_DAYS`). Aujourd’hui 4 129 offres ouvertes. Le marché français de ce périmètre est de l’ordre de quelques dizaines de milliers d’offres ouvertes ; 100 millions d’offres *actives* n’est pas un volume que cette plateforme rencontrera. C’est donc la conception A (et B au-delà de 100 000) qui compte.

## 6. Ce que cela remplace dans le code

- Pour la **sélection du jour** (`ensureDailyBatch`, `lib/unlock.ts`) : l’appel à `importFromCatalogue`, donc la lecture de 3 000 lignes en mémoire, **la coupe à 300 avant classement** (`IMPORT_MAX`), la limite de 40 voisines (`SIMILAR_MAX`) et les 200 lignes de `match_offers_for_me_v2`. Remplacé par un appel à `select_daily_candidates` puis le tri par note côté serveur.
- **Ne change pas** : `importFromCatalogue` reste pour la recherche de l’administrateur et les usages hors sélection ; `categoryCounts` (compteurs des Réglages) peut aussi devenir une agrégation SQL (`count(*) group by`) plutôt qu’une lecture de 9 000 lignes ; `claim_daily_unlock`, `offer_unlocks`, les gardes, la note affichée.
- À écrire : la migration (colonnes, index, fonction), le rattrapage de `departments`, les tests (jeux de 5 000 et 50 000 offres factices : résultats identiques entre la voie exacte et la voie indexée, temps mesurés), et la mesure de rappel sur 3 profils réels.

## 7. Étapes proposées

1. Vérifier la version de pgvector et mesurer la taille réelle de l’index (deux requêtes de lecture données ci-dessus).
2. Ajouter `departments` (colonne + remplissage à la collecte + rattrapage) — utile même sans le reste.
3. Écrire `select_daily_candidates` en voie A (pré-filtrage, tri exact), mesurer avec `explain analyze` sur 3 comptes.
4. Brancher `ensureDailyBatch` dessus derrière le repli actuel (si la fonction n’existe pas, l’ancien chemin continue).
5. Ajouter la voie B (`relaxed_order`) seulement si les mesures du point 3 l’exigent et si pgvector ≥ 0.8.0.

Rien de ce qui précède n’est appliqué ni codé.
