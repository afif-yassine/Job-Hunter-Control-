# Jugement du 8 octobre 2026 — trois défauts relevés sur lebontaf.com

Auteur : Juge business. Mission ciblée demandée par le propriétaire via la coordination.

**Limite à lire d'abord.** Les agents critique, valorisation, commercial et finance n'ont PAS été lancés : il n'existe aucun rapport `critique-*`, `valorisation-*`, `commercial-*`, `finance-*`. Ce jugement ne les remplace pas et ne tranche aucun désaccord entre agents (il n'y en a pas). Il s'appuie sur le code relu aujourd'hui, les trois audits du 7 octobre, le backlog et le complément du backend. Seul MVP-02 est vérifié en production ; tout chiffre de coût ci-dessous est une **estimation**. Les ordres sont classés derrière MVP-01 à MVP-06, v1.1 en pause, plafond 2 USD, aucun achat.

## Faits relus dans le code (et écarts)

| Fait annoncé | Constat | Statut |
| --- | --- | --- |
| Chiffre = part des compétences de l'offre prouvées par le CV | `lib/fit.ts` : pour le modèle actuel (non calibré), `meaning = null`, donc score = compétences prouvées ÷ compétences demandées (sans plafond). Le mélange 0,55 sens + 0,45 compétences n'existe que pour l'ancien modèle Gemini. Exemple : 1 compétence sur 6 demandées donne 17. | Confirmé |
| Tag = classement par proximité de sens | `compareFits` trie par similarité d'abord. Le front (`components/views/closest.ts`) trie désormais par le chiffre affiché, 25 meilleures offres notées, proximité seulement en départage. | Confirmé : la contradiction est corrigée dans le code, pas revue à l'écran |
| Le bouton appelle `/api/scan` | `pipeline-client.ts:169` appelle `/api/scan` ; `/api/catalogue/refresh` est appelé à l'ouverture (`use-catalogue-refresh.ts`). | Confirmé |
| Le clic appelle des sites d'emploi | Oui, mais **seulement si l'étudiant a choisi une ville ou un département** (`lib/scan/index.ts:253` : sans zone, les sources à zone sont « ignorées »). Le complément du backend (point 1) ne le dit pas. Les pages carrière, Gmail et le webhook ne dépendent pas de la zone. | Écart de précision |
| Budgets dans le code | JSearch 180/mois, Adzuna 240/jour, Jooble 450 au total (`lib/scan/health.ts:51-71`). Plafond mensuel Adzuna 2 500 non compté. Ces budgets ne s'appliquent que si la clé est celle de la plateforme. | Confirmé |
| Règle « déjà couvert » | Saute une requête seulement si catégorie ET contrat sont choisis et si le catalogue en donne au moins 20 (`index.ts:147,264`). Ne protège pas mots-clés, « autre » ni petite zone. | Confirmé |
| Collecte plateforme | `harvest.ts` n'importe qu'Adzuna et les pages carrière (France Travail par ailleurs, d'après l'audit). JSearch et Jooble n'y sont pas. | Confirmé |
| Quota manuel | `scan` : 3 recherches par jour et par compte (`lib/quota.ts`). | Confirmé |
| Coût IA du clic | `runScan` ne rend aucune IA payante, sauf la vectorisation du profil (`ensureSemanticProfile`) à chaque scan. Le complément dit « 15 analysées sans coût » : plausible, non vérifié. | Écart mineur à faire chiffrer |
| Collecte planifiée | `vercel.json` ne planifie que `/api/cron/tick` ; la collecte dépend d'un pg_cron Supabase non versionné. | **Inconnu** (REVUE-02) |
| Clés réellement posées (JSearch, Jooble, Gmail, webhook) | | **Inconnu** |

## Sujet 1 — Score et proximité contradictoires

**Position.** Pas de score unique avant le pilote fermé. Afficher une seule grandeur par écran, triée et étiquetée par la même valeur, formulée comme « compétences en commun » (par exemple « 1 compétence sur 6 demandées »), et non comme un nombre sur 100 présenté comme un verdict.

**Raison.**
- Le défaut vient d'un affichage de deux mesures différentes côte à côte ; le correctif front (tri par le chiffre affiché, tag retiré) le supprime. Il reste à le voir à l'écran (MVP-03).
- Le mélange 0,55/0,45 est une formule héritée de l'ancien modèle, pas calibrée pour Perplexity. Aucune donnée réelle ne la valide ; la valider demande, selon le backend, 5 à 10 profils de domaines différents et un jugement humain sur environ 30 offres par profil. C'est un chantier qui ressemble à SUITE-04, hors priorité tant que MVP-01 à 06 ne sont pas finis.
- Un nombre sur 100 se lit comme une probabilité. Risque concret : un étudiant se fie à 85/100 et dépense l'un de ses deux dossiers du mois sur une offre mal choisie. À l'inverse, un 17/100 pour une offre pertinente lui fait écarter une bonne offre. Dans les deux cas la confiance baisse.
- Cause du chiffre bas pour des offres pertinentes : le score compte les compétences que le CV « prouve » ; une offre qui en liste 6 dont 1 est écrite dans le CV donne 17 même si le profil convient. C'est une limite de lecture du CV et de vocabulaire (alias, niveaux), pas un bug du tri.

**Condition (pour un pilote fermé, personnes de confiance).**
1. L'écran dit ce que le chiffre mesure, en une phrase, et ne contient jamais « chances » ni « probabilité » ; il affiche les compétences communes et manquantes (c'est déjà l'esprit de MVP-03).
2. Le tri et le libellé de l'onglet « Proches de mon CV » utilisent la même valeur (corrigé en code). Renommer l'onglet si le nom promet de la « proximité de sens » alors que le tri est par compétences.
3. Le propriétaire revoit la même offre qu'au précédent essai et vérifie que son profil contient ses compétences IA (reste de MVP-03).
4. Un score combiné n'est étudié qu'après calibration, en pilote, avec les retours d'étudiants.

## Sujet 2 — Recherche individuelle sur API limitées

**Position.** Bonne orientation pour les coûts et les licences ; mauvaise si elle est livrée seule. À adopter par étapes : d'abord retirer la recherche par compte, mais seulement après avoir (a) confirmé que la collecte plateforme tourne et (b) mis en place une réponse honnête pour les métiers non couverts.

**Raison.**
- Coût et quotas : en cas défavorable (estimation du backend, non vérifiée), 10 comptes à 3 recherches par jour avec des requêtes toutes différentes épuisent JSearch et Jooble en deux jours et dépassent le plafond journalier Adzuna. Le budget partagé stoppe les appels, mais l'étudiant recevrait alors des résultats incomplets sans comprendre pourquoi. Dans le cas favorable (catégories cochées, mêmes villes, catalogue couvert) le coût est proche de zéro. Donc le risque est réel dès que les comptes se multiplient, faible tant qu'ils restent peu nombreux.
- Licences (public-02) : le catalogue partagé est ce que France Travail demande (catalogue lisible par tout compte connecté, retrait des offres retirées). La recherche par compte alimente aussi le catalogue partagé (audit sécurité F13), ce qui mêle des sources non vérifiées (JSearch : droits sur le texte venant de LinkedIn, Indeed, non confirmés ; Jooble : rien trouvé). Limiter les appels aux sites à la collecte plateforme réduit le nombre de sources à régulariser et à citer. Cela ne règle pas les 18 questions ouvertes, ni les 3 300 appels Adzuna estimés pour 2 500 par mois : la collecte plateforme elle-même doit être réduite ou la limite relevée (question Q2 d'Adzuna).
- Promesse : le compromis est une fraîcheur limitée à la dernière collecte (deux fois par jour si la tâche tourne, non confirmé) et l'absence des mots-clés rares tant que la collecte ne les prend pas en charge. Pour un pilote en informatique/numérique avec métiers cochés, c'est acceptable ; pour « autre métier » ou mots-clés, c'est un trou. JSearch et Jooble ne sont alimentés que par les recherches des comptes : les retirer revient à les éteindre. Ce n'est pas un problème si la source était à licence douteuse, mais il faut l'assumer.
- Aujourd'hui sans zone choisie aucun site n'est déjà appelé (`index.ts:253`) : l'effet immédiat du retrait ne concerne que les étudiants qui ont donné une ville ou un département. Le gain est donc réel mais moins grand que sous-entendu.

**Condition (à garantir avant de retirer la recherche individuelle).**
1. Preuve que la collecte plateforme tourne au moins une fois par 24 h (lecture de `cron.job`, REVUE-02, et dernière exécution). Sans cela le catalogue vieillit et la promesse de fraîcheur est fausse.
2. Texte honnête à l'écran : date de la dernière mise à jour du catalogue (déjà prévu par `freshnessText`) ; message pour un métier non couvert (« pas encore dans le catalogue, il sera pris en compte à la prochaine collecte »).
3. La file des métiers non couverts est une **demande de choix**, pas un envoi de recherche : elle exige une règle (quels mots-clés, quelle limite par jour, qui valide). Ne pas la lancer comme fonctionnalité avant MVP-06. En attendant, la collecte plateforme couvre les catégories du périmètre (backlog section 8) et l'administrateur voit les demandes.
4. L'administrateur garde la recherche manuelle (bloc admin existant) ; l'étudiant garde le bouton, qui lit le catalogue.
5. Ce retrait ne remplace pas les décisions sur les licences (PUBLIC-02) : il les simplifie seulement.

## Sujet 3 — CV importé invisible

**Position.** Corriger, sans débat. Rien à arbitrer pour la livraison engagée par le front.

**Raison.** Le texte fixe « Importé une fois en PDF » et le bouton « Importer ou mettre à jour » s'affichent que le CV existe ou non (`home-view.tsx:214-223`). Le propriétaire a pu croire que l'import avait échoué : un étudiant le croira aussi et redéposera son CV, ce qui coûte une lecture IA et un quota d'import (estimation : petit mais non nul) et peut écraser un profil confirmé.

**Condition.** L'accueil montre le nom du fichier, la date, les compteurs et « Ton CV est enregistré ». Question de confiance plus large : oui, l'étudiant doit pouvoir relire depuis l'accueil, en un clic, ce qui a été lu de son CV (expériences, formations, compétences) puisque tous ses documents en partent ; mais cela peut se faire par un lien « Voir ce qui a été lu » vers Réglages, pas par une copie du profil sur l'accueil. Cela relève de la v1.1 (en pause) si cela dépasse un lien ; ne pas le développer maintenant.

## Comparaison des options

| Option | Effet | Coût (estimation) | Risque | Délai |
| --- | --- | --- | --- | --- |
| Sujet 1 : chiffre « compétences » seul | Cohérent avec le tri ; lisible | Nul | Chiffres bas sur des offres pertinentes | Déjà en code |
| Sujet 1 : score unique 0,55/0,45 | Chiffre plus généreux | Calibration : 5 à 10 profils, ~30 offres chacun, travail humain | Lu comme probabilité ; non validé | Après le pilote |
| Sujet 2 : recherche par compte conservée | Fraîcheur et mots-clés rares | Variable ; JSearch/Jooble épuisés en 2 jours en cas défavorable | Quotas, licences JSearch/Jooble | Existant |
| Sujet 2 : catalogue seul pour l'étudiant | Coût quasi nul, licences simplifiées | Nul pour l'étudiant | Fraîcheur limitée, métiers rares sans réponse | Code local du backend, non livré |
| Sujet 2 : catalogue seul + file de demandes | Promesse tenable | Un peu de travail backend ; règle à décider | Abus à limiter | Après MVP-06 |

## Ordres

Tous classés derrière MVP-01 à MVP-06 et REVUE-02. Le BIZ-01 est la seule condition préalable, car il est une lecture, pas une fonctionnalité.

**BIZ-01 (P1) — Prouver que la collecte plateforme tourne et que l'on sait quelles clés sont posées.** À : propriétaire (lecture de `cron.job` dans Supabase et des variables Vercel sans copier les valeurs) avec le backend. Effet : conditionne le retrait de la recherche par compte et répond aux questions Q11 et Q18 de public-02. Effort : faible (une lecture). Ce n'est pas une nouvelle fonctionnalité : c'est REVUE-02 déjà au backlog.

**BIZ-02 (P1) — Pilote fermé : le score reste un nombre de compétences en commun, jamais présenté comme une chance.** À : front (libellé et phrase explicative ; renommer l'onglet si besoin), coordinateur (garder SUITE-04 après le pilote, sans score combiné). Effet : supprime la contradiction et le risque de lecture en probabilité. Effort : faible. Revue à l'écran dans MVP-03.

**BIZ-03 (P1) — CV visible à l'accueil.** À : front. Effet : plus de redépôt inutile ; confiance. Effort : faible, déjà engagé. Ajouter un lien « Voir ce qui a été lu » vers Réglages (pas de copie du profil).

**BIZ-04 (P2) — Retirer la recherche par compte pour l'étudiant (il lit le catalogue ; seuls la collecte et l'admin appellent les sites), après BIZ-01.** À : backend (le coordinateur annonce à la session backend avant toute modification du backlog). Effet : coût d'API quasi nul pour l'étudiant, moins de sources à régulariser. Effort : faible (le code local existe). Conditions : textes de fraîcheur, message pour un métier non couvert, administrateur conservé. À livrer seulement après décision du propriétaire.

**BIZ-05 (P2) — Chiffrer la vectorisation du profil à chaque scan et le coût réel des appels de la collecte plateforme.** À : backend, avec la finance si elle est lancée. Effet : transformer les estimations en mesures (Adzuna 3 300 contre 2 500 par mois ; appels JSearch/Jooble effectifs). Effort : faible à moyen. Lecture seule, aucun achat.

**BIZ-06 (P3) — Métier non couvert : file de demandes pour la collecte suivante.** À : coordinateur (décision de règle) puis backend. Effet : promesse honnête pour les métiers rares. Effort : moyen. **Reporter** après MVP-06 : c'est une nouvelle fonctionnalité.

**BIZ-07 (P3) — Calibration d'un score combiné.** À : backend avec le propriétaire (jugement humain). Effet : score plus juste. Effort : élevé. **Reporter** après le pilote ; c'est SUITE-04 existant, pas une nouvelle tâche.

## Contrôle du registre

Le registre ne contient aucune décision enregistrée : aucune proposition refusée ou reportée n'est reprise. BIZ-01 et BIZ-05 recoupent REVUE-02 et SUITE-14 du backlog (pas des refus). BIZ-06 et BIZ-07 sont proposés « reportés » d'office dans leur priorité, car ils touchent à SUITE-04 et à une nouvelle fonctionnalité (Fait de référence 3). Priorités du propriétaire respectées : v1.1 en pause, plafond 2 USD, aucun achat, aucun envoi automatique. Aucune des conclusions ne s'appuie sur des rapports des quatre autres agents.

## Demande de décision au propriétaire

Pour chaque ordre : accepter / refuser / reporter.

| Ordre | Décision |
| --- | --- |
| BIZ-01 Vérifier collecte planifiée et clés posées | ? |
| BIZ-02 Score = compétences en commun, jamais une chance | ? |
| BIZ-03 CV visible à l'accueil avec lien vers la lecture | ? |
| BIZ-04 Étudiant lit le catalogue seul (après BIZ-01) | ? |
| BIZ-05 Chiffrer les appels et la vectorisation | ? |
| BIZ-06 File des métiers non couverts | ? |
| BIZ-07 Calibration du score combiné | ? |

## Résumé en cinq lignes

1. Score : pas de score unique avant le pilote ; une grandeur par écran, formulée en compétences en commun, jamais une probabilité ; revue à l'écran dans MVP-03.
2. Recherche : oui au catalogue seul pour l'étudiant, mais après preuve que la collecte tourne et avec un message honnête pour les métiers non couverts.
3. CV : corriger l'affichage, sans débat ; lien vers ce qui a été lu, rien de plus avant la v1.1.
4. Sans les quatre autres rapports, ce jugement ne couvre que ces trois défauts ; tous les coûts sont des estimations.
5. Rien n'est livré en production ; le propriétaire décide.
