# Jugement du 8 octobre 2026 (soir) — limite de 8 offres, page d'administration, fin du MVP

Auteur : Juge business. Mission demandée par la coordination, qui rapporte la consigne du propriétaire du 8 octobre au soir : « termine le MVP, ne t'arrête pas, si tu as besoin d'une confirmation, confirme avec le juge la meilleure stratégie ».

**Limites à lire d'abord.**

- Les agents critique, valorisation, commercial et finance n'ont toujours **pas** été lancés : aucun rapport `critique-*`, `valorisation-*`, `commercial-*`, `finance-*` n'existe. Il n'y a donc aucun désaccord entre agents à trancher, et ce jugement ne remplace pas leurs analyses (voir BIZ-17).
- Je classe l'ordre et le périmètre. Je ne décide ni achat, ni hausse de budget, ni écriture en production. Tous les ordres sont inscrits au registre au statut `proposée` : le propriétaire garde le dernier mot, et la coordination applique sous sa responsabilité la délégation qu'elle rapporte.
- Seul MVP-02 est vérifié en production. **Tout chiffre de coût ci-dessous est une estimation.**

## Vue d'ensemble en dix lignes

1. **Idée** : aider les étudiants à trouver stage ou alternance (CV lu, offres classées, CV + lettre adaptés, suivi). Inchangée.
2. **Produit** : beaucoup de code livré, peu de parcours prouvés. MVP-02 vérifié ; MVP-01 à moitié (import et profil faits, kit à créer) ; MVP-03 non validé (un seul profil vu) ; MVP-04, 05, 06 non commencés en production (backlog, section 3).
3. **Catalogue** : collecte prouvée le 8 octobre (4 129 offres ouvertes, 645 nouvelles par jour, d'après la page admin). Vectorisation annoncée à 1 793 : chiffre à confirmer avant d'agir (voir BIZ-12).
4. **Utilisateurs** : 4 inscrits, 0 Pro. Aucun tarif adopté, Stripe non prêt.
5. **Coûts** : 0,40 USD d'IA « depuis le 1er » selon la page admin. C'est une estimation, jamais comparée à une facture (audit sécurité et coûts, section 6).
6. **Plafond** : 2 USD sur la clé AI Gateway, hors du code. Inchangé.
7. **Licences** : 18 questions ouvertes ; la compatibilité d'une offre payante avec France Travail et Adzuna n'est pas confirmée (`docs/audits/public-02-attributions-sources-2026-10-07.md`).
8. **Marché, valeur, prix** : aucun rapport. Rien à dire de fondé.
9. **Défaut de classement trouvé** : « Java 17/21 » du CV ne reconnaît pas « java » d'une offre (0/100). Correctif simple proposé par le backend.
10. **Réglage en attente** : `STUDENT_CATALOGUE_ONLY=1` à poser par le propriétaire dans Vercel, puis redéploiement.

## 1. Les trois demandes

### A. « Seules 8 cartes s'affichent, le reste est pour un utilisateur Pro » — REPORTER, en deux morceaux

**Décision.** Ne rien faire maintenant. Séparer la demande en deux :

- **A1, la limite de 8 sans paiement** (c'est la spécification v1.1 : 8 nouvelles offres par jour, le reste consultable). Reportée après la fin du pilote fermé.
- **A2, « le reste est pour Pro »**. Reportée plus loin, derrière le juridique.

**Pourquoi pas maintenant.**

- Le classement n'est pas encore fiable : un seul profil vu, et une offre Java notée 0/100 pour un profil Java. Si on ne montre que 8 offres choisies par un classement faux, l'étudiant voit 8 mauvaises offres et rien d'autre. Il faut d'abord valider MVP-03 sur plusieurs profils.
- Chaque changement d'écran oblige à refaire les revues (REVUE-01 vient d'être cochée) et repousse MVP-03, 04 et 05, qui vérifient justement la liste d'offres.
- La v1.1 est en pause par décision du propriétaire du 7 octobre. Fait nouveau : sa demande du 8 octobre. Elle justifie de préparer le réveil, pas de passer devant MVP-01 à 06, qui restent sa priorité de rang 1.
- A2 est le point le plus risqué du dossier. La licence France Travail (article 5.1, cité dans l'audit) interdit de faire payer un chercheur d'emploi pour un service de placement et de « vendre des offres d'emploi ». Réserver l'accès aux offres à ceux qui paient y ressemble beaucoup. Adzuna demande un accord écrit pour un autre usage commercial. Ce sont les questions Q1 et Q8 de l'audit, sans réponse.

**Périmètre minimal le jour du réveil (A1).** Les 8 offres du jour mises en avant ; les offres déjà débloquées restent visibles ; le reste du catalogue reste **consultable gratuitement** (bouton « Explorer tout le catalogue ») ; aucun mot « Pro », aucun prix, aucune promesse de paiement. C'est exactement la spécification v1.1, à relire en entier avant de démarrer.

**Conditions de réveil.**

- A1 : MVP-03 validé sur au moins trois profils de domaines différents, MVP-01 à 05 prouvés, MVP-06a fait (voir BIZ-09), puis levée de la pause v1.1 par le propriétaire.
- A2 : PUBLIC-03 traité, réponse écrite d'Adzuna (Q1) et avis d'un juriste sur France Travail (Q8), tarif adopté par le propriétaire, Stripe prêt, rapports finance et commercial rendus (BIZ-17).

**Opinion (pas un fait).** Si un Pro existe un jour, il est plus sûr de vendre du service (plus de dossiers CV + lettre, préparation d'entretien) que l'accès aux offres. C'est au juriste de le confirmer.

### B. « Voir chaque centime réellement dépensé » — VERSION RÉDUITE, maintenant

**Vérité à dire au propriétaire.** La page admin ne peut pas afficher le « vrai centime ». Elle additionne ce que l'application a noté, avec des prix écrits dans le code. Elle ignore les appels en échec (qui peuvent être facturés), Railway, Resend, Vercel, Supabase et les sites d'offres. De plus, un compte peut aujourd'hui ajouter de fausses lignes de coût (constat M4 de l'audit). Le vrai chiffre, c'est la facture de chaque fournisseur.

**Périmètre minimal.**

- **B1, maintenant, sans code (BIZ-10).** Le propriétaire fournit des captures sur une même période (liste exacte : audit sécurité et coûts, fin de la section 6 : AI Gateway par modèle et réglage du plafond, Vercel, Supabase, Railway, Resend, sources d'offres). L'agent sécurité-coûts compare avec la page admin et rend l'écart, ligne par ligne. Quinze minutes pour le propriétaire. C'est aussi un morceau de MVP-06 et de PUBLIC-06.
- **B2, petit correctif, après les vérifications MVP-01 à 05 (BIZ-11).** Sur la page admin : écrire « estimation » ou « mesuré par le fournisseur » à côté de chaque montant ; une seule méthode de calcul pour les deux onglets ; hébergement affiché « non relevé » au lieu de 0 USD ; retirer les textes périmés (Gemini, script de déploiement, « Pro à 7,99 € ») ; afficher la date et le résultat du dernier rapprochement B1. La colonne qui distingue mesuré et estimé demande une migration : elle suit le lot REVUE-03, testée sur une copie d'abord.
- **B3, reporté.** Lecture automatique des factures par les interfaces des fournisseurs. Cela oblige à ranger dans l'application des clés qui lisent la facturation. Réveil : après MVP-06a, et seulement si B1 montre un écart important ou si le pilote dépasse une vingtaine de comptes.

### C. « Modifier tous les paramètres et gérer chaque utilisateur depuis la page » — REPORTER l'écriture, LECTURE SEULE en version réduite

**Pourquoi reporter l'écriture.**

- Les paramètres vivent dans Vercel. Les changer depuis la page voudrait dire donner à l'application une clé qui écrit dans Vercel, ou déplacer tous les réglages en base. Dans les deux cas, un compte admin volé ou un bug permet de couper les protections (réservations des dossiers, quotas, catalogue seul).
- Donner « Pro » à un compte retire aujourd'hui la limite de deux dossiers par mois (`lib/plan.ts`). Avec un plafond de 2 USD, un seul compte Pro de test peut bloquer tous les autres.
- Avec 4 inscrits, le propriétaire peut faire ces rares gestes dans Vercel et Supabase, avec la coordination à côté de lui.
- C'est une nouvelle fonctionnalité de taille moyenne à grande : elle passerait devant MVP-03 à 06.

**Périmètre minimal (BIZ-13, lecture seule, après MVP-06a).** Un bloc « Réglages actuels » (interrupteurs et limites, jamais les secrets : catalogue seul, réservations, dossiers gratuits par mois, quotas par jour, seuil d'alerte) et un tableau « Comptes » (date d'inscription, offre gratuite ou Pro, dossiers du mois, quotas du jour, coût estimé). Aucun bouton d'écriture. Cela évite de relire Vercel à la main et aide MVP-06.

**Condition de réveil de l'écriture (BIZ-14).** MVP-06a fait, PUBLIC-06 levé, et une courte spécification acceptée par le propriétaire : liste fermée des réglages modifiables, confirmation à chaque geste, journal de qui a changé quoi. **Jamais depuis la page**, même plus tard : les secrets et clés, le plafond AI Gateway, l'attribution du rôle administrateur.

## 2. Comparaison des options

| Option | Effet | Coût (estimation) | Risque | Délai |
| --- | --- | --- | --- | --- |
| A : 8 cartes + reste réservé à Pro, maintenant | Prépare un revenu | Élevé (v1.1 + paiement) | Licences France Travail et Adzuna ; classement non validé | Semaines, MVP repoussé |
| A1 : 8 par jour, reste consultable, sans paiement | Accueil plus clair | Moyen (v1.1 déjà spécifiée) | Faible si le classement est validé avant | Après MVP-06a |
| A : rien avant la fin du pilote (retenu) | MVP terminé plus tôt | Nul | Aucun | Immédiat |
| B1 : rapprochement avec les factures (retenu) | Premier vrai chiffre | 15 min du propriétaire | Aucun | Cette semaine |
| B2 : étiquettes « estimé / mesuré » (retenu) | Page honnête | Faible, une migration | Migration à tester sur une copie | Après MVP-05 |
| B3 : factures lues automatiquement | Confort | Moyen, nouvelles clés | Clés de facturation dans l'application | Reporté |
| C lecture seule (retenu) | Vue des réglages et des comptes | Faible à moyen | Faible | Après MVP-06a |
| C écriture complète | Autonomie | Moyen à élevé | Élevé (protections coupées, budget) | Reporté |

## 3. Ordre de travail jusqu'à « MVP terminé »

**Étape 0 — trois gestes du propriétaire (environ 20 minutes), qui débloquent tout le reste.**

1. Poser `STUDENT_CATALOGUE_ONLY=1` dans Vercel et redéployer (BIZ-04, déjà accepté).
2. Cliquer « créer le dossier » sur une offre, relire, ouvrir les deux PDF, rouvrir le dossier (fin de MVP-01).
3. Faire les captures de factures pour B1.

**Ensuite, dans cet ordre.**

1. **MVP-01** : la coordination constate que les faits viennent du profil, que les deux PDF sont lisibles et que la réouverture ne crée aucune nouvelle ligne de dépense.
2. **Correctif « Java 17/21 »** (backend, avec tests), puis **MVP-03** sur au moins trois profils de domaines différents, dont un hors informatique, sur des comptes de test séparés. Ne jamais remplacer le vrai profil du propriétaire.
3. **MVP-04** : contrôle d'une collecte complète par les requêtes de lecture de `docs/audits/preparation-mvp-04-2026-10-07.md`, catalogue seul allumé, retrait d'une offre vérifié dans chaque parcours. Inclut la vectorisation (BIZ-12).
4. **MVP-05** : parcours complet de suivi, écarter et restaurer, rappels, sur mobile aussi.
5. **REVUE-03** : les trois migrations testées sur une copie de la base, puis décision du propriétaire.
6. **MVP-06a** : plusieurs comptes, double clic, deux onglets, quotas atteints, message quand le budget est épuisé, aucune donnée d'un autre compte visible. Avec le rapprochement B1.
7. **MVP-06b** : charge représentative de 100 utilisateurs.

**Ce qui ne peut pas être déclaré terminé sans preuve en production.**

- **MVP-03** : un seul profil vu à ce jour. Pas terminé tant que trois profils n'ont pas été revus à l'écran, compétences communes et manquantes comprises.
- **MVP-04** : rien de vérifié. La tâche « Succeeded » dans Supabase prouve l'envoi de la requête, pas le traitement complet ni le retrait d'une offre.
- **MVP-05** : rien de vérifié.
- **MVP-06** : aucun test à plusieurs comptes, aucun test de charge. L'audit du 7 octobre est une lecture du code.

**Décision de périmètre (BIZ-09).** Couper MVP-06 en deux. Avec MVP-01 à 05 et MVP-06a prouvés, on peut dire **« pilote fermé vérifié, pour une dizaine de personnes de confiance »**. On ne peut pas dire « MVP terminé pour 100 utilisateurs » tant que MVP-06b n'est pas fait. MVP-06b reste ouvert et obligatoire avant tout pilote ouvert. C'est la seule façon honnête de « terminer » vite.

## 4. Risques à ne pas prendre

1. Réserver l'accès aux offres aux payants, ou écrire « Pro » ou un prix à l'écran, avant l'avis juridique et un tarif adopté. Le « Pro à 7,99 € » encore visible dans l'admin doit disparaître.
2. Présenter les montants de l'admin comme réels. Tant que B1 n'est pas fait, dire « estimation ».
3. Déclarer une vérification faite parce que les tests automatiques passent.
4. Lancer un test de charge en production sur des routes qui paient de l'IA ou appellent les sites d'offres : le plafond de 2 USD tomberait et plus aucun étudiant n'aurait de dossier.
5. Exécuter en production une migration jamais testée sur une copie.
6. Donner « Pro » à un compte de test : dossiers illimités sous un plafond de 2 USD.
7. Mettre dans l'application une clé qui écrit dans Vercel ou lit la facturation.
8. Contourner un refus d'outil pour écrire dans Vercel ou Supabase : ces gestes restent ceux du propriétaire.
9. Planifier la vectorisation avant d'avoir vérifié le compteur et estimé la dépense.
10. Ouvrir à des inconnus avant PUBLIC-06 et MVP-06b.

## 5. Ordres

Tous classés derrière les priorités du propriétaire. BIZ-08 à BIZ-10 servent directement la priorité de rang 1.

| N° | Ce qu'il faut changer | À qui | Effet attendu | Effort | Priorité |
| --- | --- | --- | --- | --- | --- |
| BIZ-08 | Suivre l'ordre de travail de la section 3 ; le correctif « Java 17/21 » passe avant la reprise de MVP-03 | Coordinateur, backend, propriétaire (étape 0) | Fin du pilote sans détour | Faible (organisation) + correctif court | P1 |
| BIZ-09 | Couper MVP-06 en MVP-06a (comptes, concurrence, quotas) et MVP-06b (charge de 100) ; n'annoncer que « pilote fermé vérifié » après 01 à 05 + 06a | Coordinateur (backlog, après annonce au backend), propriétaire | Une fin de MVP honnête et atteignable | Faible | P1 |
| BIZ-10 | Rapprocher la page admin des factures réelles sur une même période (B1) | Propriétaire (captures), agent sécurité-coûts (comparaison) | Premier chiffre réel ; lève une réserve de PUBLIC-06 | Faible | P1 |
| BIZ-11 | Page admin honnête (B2) : « estimé » ou « mesuré », une seule méthode, hébergement « non relevé », textes périmés retirés, date du dernier rapprochement | Backend et front ; migration avec le lot REVUE-03 | Plus aucun faux chiffre présenté comme vrai | Faible à moyen | P2 |
| BIZ-12 | Vectorisation : vérifier d'abord ce que compte « 1 793 » (l'audit, constat F8, dit que la barre compte peut-être l'ancienne colonne), estimer la dépense, puis faire planifier `/api/cron/embeddings` par le propriétaire | Backend (lecture et estimation), propriétaire (planification) | Classement sur tout le catalogue ; morceau de MVP-04 | Faible | P2 |
| BIZ-13 | Admin en lecture seule : bloc « Réglages actuels » sans secrets et tableau « Comptes » (C réduit) | Backend et front | Le propriétaire voit réglages et comptes sans ouvrir Vercel | Faible à moyen | P2, après MVP-06a |
| BIZ-14 | Admin en écriture (paramètres, offre et quotas par compte) : **à reporter** | Coordinateur (spécification), puis backend et front | Autonomie du propriétaire | Moyen à élevé | P3, réveil : MVP-06a + PUBLIC-06 + spécification acceptée |
| BIZ-15 | Limite de 8 offres par jour sans paiement (A1, v1.1) : **à reporter** | Front et backend, après levée de la pause | Accueil plus clair | Moyen | P3, réveil : MVP-03 sur trois profils + MVP-06a + levée de la pause v1.1 |
| BIZ-16 | « Le reste pour Pro » (A2) : **à reporter** ; aucun mot « Pro » ni prix à l'écran d'ici là | Propriétaire (juriste, Adzuna, tarif) | Éviter une faute de licence | Élevé | P3, réveil : PUBLIC-03 + réponses Q1 et Q8 + tarif adopté + Stripe + BIZ-17 |
| BIZ-17 | Lancer les agents finance, commercial et critique sur le modèle payant avant tout réveil de BIZ-16 : coût réel par étudiant d'après B1, ce que le Pro vendrait, risque de licence | Coordinateur (lancement), agents finance, commercial, critique | Une décision de prix fondée | Faible | P3, après BIZ-10 |

**Sur BIZ-12, estimation.** Vectoriser environ 2 300 offres coûterait quelques centimes au plus au prix écrit dans le code (0,004 USD par million de jetons), prix non vérifié. À confirmer par le backend avant toute planification.

## 6. Contrôle du registre

- Aucune proposition refusée n'existe au registre.
- BIZ-06 et BIZ-07 (reportées) ne sont pas reprises.
- BIZ-15 touche la v1.1 en pause (priorité de rang 4). Fait nouveau : demande du propriétaire du 8 octobre, notée dans REVUE-01. Elle ne suffit pas à passer devant le rang 1 : l'ordre est donc proposé en report, avec sa condition de réveil.
- BIZ-13 et BIZ-14 sont de nouvelles fonctionnalités : elles reposent sur la demande explicite du propriétaire (Fait de référence 3) et restent derrière MVP-01 à 06a.
- BIZ-12 n'ajoute pas de fonctionnalité (le chemin existe) mais demande une écriture en production : geste du propriétaire.
- Plafond de 2 USD inchangé, aucun achat, aucun envoi automatique de candidature.

## 7. Demande de décision au propriétaire

| Ordre | Décision (accepter / refuser / reporter) |
| --- | --- |
| BIZ-08 Ordre de travail et correctif Java avant MVP-03 | ? |
| BIZ-09 MVP-06 coupé en deux, « pilote fermé vérifié » | ? |
| BIZ-10 Rapprochement avec les factures | ? |
| BIZ-11 Page admin : estimé ou mesuré, textes périmés retirés | ? |
| BIZ-12 Vectorisation : vérifier, estimer, planifier | ? |
| BIZ-13 Admin en lecture seule (réglages, comptes) | ? |
| BIZ-14 Admin en écriture (proposé en report) | ? |
| BIZ-15 Limite de 8 sans paiement (proposé en report) | ? |
| BIZ-16 Reste réservé à Pro (proposé en report) | ? |
| BIZ-17 Lancer finance, commercial, critique sur le Pro | ? |

## Résumé en cinq lignes

1. Limite de 8 et Pro : rien maintenant. D'abord un classement validé sur trois profils ; le « reste pour Pro » attend le juriste, Adzuna et un tarif.
2. Coûts réels : la page admin ne peut pas donner le vrai centime. On compare d'abord aux factures (15 minutes du propriétaire), puis la page dit « estimé » ou « mesuré ».
3. Admin : lecture seule des réglages et des comptes après MVP-06a ; l'écriture est reportée, et jamais pour les secrets, le plafond ou le rôle admin.
4. Ordre : trois gestes du propriétaire, puis MVP-01, correctif Java, MVP-03, 04, 05, migrations sur copie, MVP-06a, MVP-06b.
5. On pourra dire « pilote fermé vérifié », pas « MVP terminé pour 100 utilisateurs », tant que la charge n'est pas testée.
