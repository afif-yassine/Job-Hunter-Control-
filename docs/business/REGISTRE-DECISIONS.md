# Registre des décisions business — LeBonTaf

Mémoire commune des agents business (critique, valorisation, commercial, finance, juge). **Seul le propriétaire décide** : un agent propose, le propriétaire accepte, refuse ou reporte. Le statut reste valable d'une session à l'autre.

## Règles de lecture (obligatoires pour tous les agents)

1. Lire ce registre **avant** toute analyse.
2. Une proposition **refusée** ne peut pas être reproposée telle quelle. Elle ne revient que si un **fait nouveau** est cité (chiffre, test, décision externe) et si l'agent écrit explicitement « fait nouveau : … » à côté de l'ancien refus.
3. Une proposition **reportée** attend sa condition de réveil (date ou événement). Avant, on ne la relance pas.
4. Les priorités du propriétaire (colonne « Priorité ») l'emportent sur l'avis des agents. Le juge classe les nouveaux ordres **après** les priorités déjà acceptées.
5. Une proposition **acceptée** n'est jamais appliquée par un agent business : elle devient une tâche du backlog, ajoutée par le coordinateur selon le protocole (annonce préalable à la session backend, accusé de réception ; les noms de sessions changent, se fier au rôle).
6. Ne jamais effacer une ligne : changer son statut et ajouter la date et le motif.

## Faits de référence (ajoutés le 8 oct. 2026, à la demande de la coordination)

1. **État réel du produit** : la référence est `docs/PRODUCT-BACKLOG.md`, section « Travaux des 7 et 8 octobre » (commit `5e514370`). Seul MVP-02 est vérifié en production. Tout le reste est du code livré, non revu à l'écran. Ne jamais le présenter comme acquis.
2. **Modèle payant** : avant de chiffrer ou de proposer un tarif, lire `docs/audits/public-02-attributions-sources-2026-10-07.md` (licences France Travail et Adzuna, 18 questions ouvertes, dont la compatibilité avec une offre payante) et `docs/audits/securite-couts-2026-10-07.md`. Les coûts de l'admin n'ont pas été comparés aux factures réelles et les prix des modèles sont codés en dur, non vérifiés. **Tout chiffre de coût est une estimation** et doit être écrit comme telle.
3. **Du conseil à la tâche** : une proposition acceptée devient une tâche du backlog seulement par la coordination, après annonce à la session backend. Aucune tâche SUITE ou PLUS, aucune nouvelle fonctionnalité et aucun achat ne démarre sans décision explicite du propriétaire.

## Statuts

`proposée` → `acceptée` | `refusée` | `reportée` → `faite` (une fois livrée et vérifiée)

## Priorités du propriétaire (à respecter en premier)

| Rang | Priorité | Source / date |
| --- | --- | --- |
| 1 | Terminer les vérifications pilote MVP-01 à MVP-06 | Backlog, 7 oct. 2026 |
| 2 | Aucun envoi automatique de candidature (`PREPARE_ONLY`) | AGENTS.md |
| 3 | Plafond AI Gateway 2 USD, aucun achat ni hausse sans instruction | CONTEXTE-PROJET.md |
| 4 | Spécification v1.1 du parcours étudiant : **en pause** | Décision du 7 oct. 2026 |

## Décisions

| N° | Date | Agent | Proposition | Priorité | Statut | Motif / condition de réveil |
| --- | --- | --- | --- | --- | --- | --- |
| BIZ-01 | 2026-10-08 | Juge | Prouver que la collecte plateforme tourne et lister les clés posées (REVUE-02) | P1 | acceptée (8 oct., propriétaire via coordinateur) | Condition de BIZ-04. Prouvé le 8 oct. par lecture des tableaux de bord (tâche `job-hunter-harvest` toutes les 10 min, active ; détail dans REVUE-02 du backlog). Fait nouveau du propriétaire : pas de variable Gmail en production, donc la lecture de la boîte d'alertes ne tourne pas. Détail : jugement-2026-10-08-trois-defauts.md |
| BIZ-02 | 2026-10-08 | Juge | Pilote fermé : score = compétences en commun, jamais présenté comme une chance ; pas de score combiné | P1 | acceptée (8 oct., propriétaire via coordinateur) | Livré en code et en ligne (commits 43c9a620, 05f0827c, 7f641ad3), pas encore revu à l'écran par le propriétaire (MVP-03) : donc pas « faite » |
| BIZ-03 | 2026-10-08 | Juge | CV visible à l'accueil (fichier, date, compteurs) + lien « Voir ce qui a été lu » | P1 | acceptée (8 oct., propriétaire via coordinateur) | Livré en code et en ligne (mêmes commits), pas encore revu à l'écran : donc pas « faite » |
| BIZ-04 | 2026-10-08 | Juge | L'étudiant lit le catalogue seul ; seules collecte plateforme et admin appellent les sites | P2 | acceptée dans son principe (8 oct., propriétaire via coordinateur) | Reste ÉTEINT (interrupteur STUDENT_CATALOGUE_ONLY, commit 4ad7d13a) tant que BIZ-01 n'est pas prouvé. 8 oct. : BIZ-01 prouvé et le propriétaire demande de l'allumer ; la variable n'est pas encore posée dans Vercel (à faire par le propriétaire, puis redéploiement) |
| BIZ-05 | 2026-10-08 | Juge | Chiffrer appels Adzuna/JSearch/Jooble et vectorisation du profil à chaque scan | P2 | acceptée (8 oct., propriétaire via coordinateur) | Première estimation du backend : vectorisation du profil refaite seulement si le texte change (coût négligeable) ; appels par source en borne haute. Reste des estimations, à transformer en mesures |
| BIZ-06 | 2026-10-08 | Juge | File des métiers non couverts pour la collecte suivante | P3 | reportée (8 oct., propriétaire via coordinateur) | Réveil : après MVP-06. Nouvelle fonctionnalité |
| BIZ-07 | 2026-10-08 | Juge | Calibrer un score combiné sur 5 à 10 profils réels | P3 | reportée (8 oct., propriétaire via coordinateur) | Réveil : après le pilote, sur 5 à 10 profils réels. Recoupe SUITE-04 |
| BIZ-08 | 2026-10-08 | Juge | Ordre de travail jusqu'à la fin du pilote : gestes du propriétaire (interrupteur catalogue seul, clic du kit, captures de factures), MVP-01, correctif « Java 17/21 », MVP-03 sur trois profils, MVP-04, MVP-05, REVUE-03 sur copie, MVP-06a, MVP-06b | P1 | proposée | Sert la priorité de rang 1. Détail : jugement-2026-10-08-admin-et-limite-8.md |
| BIZ-09 | 2026-10-08 | Juge | Couper MVP-06 en MVP-06a (plusieurs comptes, concurrence, quotas) et MVP-06b (charge de 100) ; n'annoncer que « pilote fermé vérifié » après MVP-01 à 05 + 06a | P1 | proposée | MVP-06b reste ouvert et obligatoire avant tout pilote ouvert. Modification du backlog par le coordinateur seulement |
| BIZ-10 | 2026-10-08 | Juge | Rapprocher la page admin des factures réelles sur une même période (captures du propriétaire, comparaison par l'agent sécurité-coûts) | P1 | proposée | Sans code. Liste des captures : audit sécurité et coûts du 7 oct., section 6. Les 0,40 USD affichés restent une estimation d'ici là |
| BIZ-11 | 2026-10-08 | Juge | Page admin honnête : chaque montant marqué « estimé » ou « mesuré par le fournisseur », une seule méthode de calcul, hébergement « non relevé », textes périmés retirés (Gemini, « Pro à 7,99 € »), date du dernier rapprochement | P2 | proposée | Après les vérifications MVP-01 à 05. La colonne mesuré/estimé demande une migration : avec le lot REVUE-03, testée sur une copie |
| BIZ-12 | 2026-10-08 | Juge | Vectorisation du catalogue : vérifier ce que compte « 1 793 » (constat F8 de l'audit), estimer la dépense, puis planification de `/api/cron/embeddings` par le propriétaire | P2 | proposée | Morceau de MVP-04. Écriture en production : geste du propriétaire. Dépense estimée à quelques centimes, prix non vérifié |
| BIZ-13 | 2026-10-08 | Juge | Admin en lecture seule : bloc « Réglages actuels » sans secrets et tableau « Comptes » (offre, dossiers du mois, quotas, coût estimé) | P2 | proposée | Après MVP-06a. Nouvelle fonctionnalité, fondée sur la demande du propriétaire du 8 oct. Aucun bouton d'écriture |
| BIZ-14 | 2026-10-08 | Juge | Admin en écriture : modifier les paramètres de la plateforme et gérer offre, quotas et accès de chaque compte | P3 | proposée (en report) | Réveil : MVP-06a fait + PUBLIC-06 levé + spécification acceptée (liste fermée, confirmation, journal). Jamais depuis la page : secrets, plafond AI Gateway, rôle administrateur |
| BIZ-15 | 2026-10-08 | Juge | Limite de 8 offres par jour sans paiement, reste du catalogue consultable (spécification v1.1) | P3 | proposée (en report) | Touche la v1.1 en pause. Fait nouveau : demande du propriétaire du 8 oct. (REVUE-01). Réveil : MVP-03 validé sur trois profils + MVP-06a + levée de la pause par le propriétaire |
| BIZ-16 | 2026-10-08 | Juge | Réserver le reste des offres aux comptes Pro ; d'ici là, aucun mot « Pro » ni prix à l'écran | P3 | proposée (en report) | Réveil : PUBLIC-03 + réponse écrite d'Adzuna (Q1) + avis d'un juriste sur France Travail, article 5.1 (Q8) + tarif adopté + Stripe + BIZ-17 |
| BIZ-17 | 2026-10-08 | Juge | Lancer les agents finance, commercial et critique sur le modèle payant (coût réel par étudiant, contenu du Pro, risque de licence) avant tout réveil de BIZ-16 | P3 | proposée | Après BIZ-10, pour partir de chiffres rapprochés des factures. Aucun de ces rapports n'existe au 8 oct. |

## Journal des échanges entre agents

Une ligne par échange important : date, de → vers, objet, réponse.

| Date | De → Vers | Objet | Réponse |
| --- | --- | --- | --- |
| 2026-10-08 | Coordination → Juge | Avis sur trois défauts (score/proximité, recherche par compte, CV invisible), avec complément du backend | Jugement rendu dans jugement-2026-10-08-trois-defauts.md ; ordres BIZ-01 à BIZ-07 proposés ; les quatre autres agents business n'ont pas été lancés |
| 2026-10-08 | Coordination → Registre | Décision du propriétaire sur BIZ-01 à BIZ-07 | BIZ-01 à 05 acceptées, BIZ-06 et 07 reportées ; statuts inscrits ci-dessus sans effacer de ligne |
| 2026-10-08 | Coordination → Juge | Trois demandes du propriétaire (8 cartes et reste pour Pro, coûts réels dans l'admin, admin qui modifie paramètres et comptes) et ordre de travail jusqu'à la fin du MVP | Jugement rendu dans jugement-2026-10-08-admin-et-limite-8.md ; ordres BIZ-08 à BIZ-17 proposés. Ordres aux agents : sécurité-coûts doit faire le rapprochement avec les factures (BIZ-10) ; finance, commercial et critique, jamais lancés, sont à lancer sur le modèle payant (BIZ-17) |
