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

## Journal des échanges entre agents

Une ligne par échange important : date, de → vers, objet, réponse.

| Date | De → Vers | Objet | Réponse |
| --- | --- | --- | --- |
| 2026-10-08 | Coordination → Juge | Avis sur trois défauts (score/proximité, recherche par compte, CV invisible), avec complément du backend | Jugement rendu dans jugement-2026-10-08-trois-defauts.md ; ordres BIZ-01 à BIZ-07 proposés ; les quatre autres agents business n'ont pas été lancés |
| 2026-10-08 | Coordination → Registre | Décision du propriétaire sur BIZ-01 à BIZ-07 | BIZ-01 à 05 acceptées, BIZ-06 et 07 reportées ; statuts inscrits ci-dessus sans effacer de ligne |
