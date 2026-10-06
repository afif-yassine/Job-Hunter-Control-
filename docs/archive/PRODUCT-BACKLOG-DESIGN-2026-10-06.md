# LeBonTaf — Product backlog

Mise à jour : 5 octobre 2026. Cette page porte les nouvelles décisions de refonte ; le [backlog complet du 3 octobre](archive/PRODUCT-BACKLOG-2026-10-03.txt) conserve les autres travaux et leurs cases historiques sans modification. Une case historique cochée ne remplace pas une vérification actuelle ; voir le [rapport de vérification](VERIFICATION-2026-10-04.md).

## Décisions confirmées

### Première livraison demandée le 5 octobre

Le propriétaire demande désormais de construire **uniquement la page d’accueil**, puis de la publier sur GitHub et Vercel pour évaluer le logo animé, les polices, l’identité et les deux thèmes avant toute extension à l’application.

- [x] Première implémentation de l’accueil : symbole animé « Le Déclic », offre de démonstration stage/alternance, explication du parcours, CV, futur suivi et FAQ.
- [x] Révision après retour sur l’aperçu : palette de l’ancien site (ivoire, bordeaux, or), ouverture en deux volets évoquant un nouveau chapitre, logo plus expressif, révélations au défilement et bouton pour revoir l’introduction.
- [x] Thème clair par défaut et thème sombre mémorisé ; alias public `/accueil` pour consulter la vitrine même connecté.
- [x] Vérification finale à l’écran et publication GitHub/Vercel de cette version : code `a9827338`, CI verte, production prête et contrôles navigateur réussis sur lebontaf.com aux cinq largeurs de 320 à 1440 px.
- [x] Retour du propriétaire sur l’identité proposée (5 octobre) : il garde le logo animé, le slogan « Ton alternance. Ton stage. Ton bon départ. » et l’idée d’une porte qui s’ouvre, mais choisit le thème « tableau d’enquête » (liège, punaises, fils rouges) pour tout le site. L’accueil en volets bordeaux de `a9827338` est remplacé ; `DESIGN.md` décrit cette version précédente.

Cette première livraison est publiée et vérifiée. Voir le [brief de l’accueil](HOME-DESIGN-BRIEF.md), le [rapport de vérification](HOME-VERIFICATION-2026-10-05.md) et `DESIGN.md` pour la direction implémentée. Les lots globaux ci-dessous restent ouverts car cette livraison ne couvre pas tout le produit.

- Repenser l’ensemble du style autour de LeBonTaf, de la recherche de stages et d’alternances, de l’aide IA, des CV adaptés et du suivi des candidatures.
- Viser une identité premium et singulière, avec des animations utiles et mesurées.
- Conserver le caractère typographique apprécié ; sortir de la métaphore du vieux livre et de la bibliothèque.
- Proposer les thèmes clair et sombre, avec le clair par défaut.
- Préparer les choix et le plan avant de commencer l’implémentation visuelle.

## Direction proposée — décisions ouvertes

La direction révisée après retour utilisateur est un nouveau chapitre professionnel : titres expressifs, informations d’offres immédiatement lisibles, aperçu concret du produit et ouverture animée inspirée du site précédent. La métaphore de chapitre est explicitement appréciée ; l’accueil doit néanmoins rester immédiatement identifiable comme une plateforme de recherche de stage/alternance.

- Palette révisée à la demande du propriétaire : ivoire/parchemin, bordeaux et or ; brun encre pour le sombre. À évaluer sur l’accueil déployé avant généralisation.
- Logo de la première proposition : mot-symbole LeBonTaf et symbole animé « Le Déclic », évoquant la rencontre profil/offre. À évaluer sur l’accueil déployé avant généralisation.
- Conserver les familles actuelles comme point de départ : IM Fell English pour quelques titres, Instrument Sans pour l’interface ; réserver la monospace aux informations qui la justifient. Les tailles et usages seront revus pour éviter l’effet livre.
- L’accueil constitue maintenant le terrain d’essai concret de cette identité. Les autres écrans restent dans leur design actuel jusqu’au retour du propriétaire.

## Priorité design — Sprint 4 révisé

Cette nouvelle direction remplace uniquement l’ancienne tâche « Nouveau design JinnJob — vieux livre, lampe animée ». Les travaux fonctionnels du sprint 4 restent au backlog. Toutes les cases ci-dessous sont à faire.

### Lot 1 — identité et système commun

- [ ] **DES-01 — Identité LeBonTaf.** Finaliser palette et logo, puis produire mot-symbole, symbole compact, favicon et variantes clair/sombre. Vérifier la lisibilité en petit format. Une recherche juridique de disponibilité de marque reste un travail distinct.
- [ ] **DES-02 — Système visuel.** Définir couleurs, contrastes, typographie, espacements, bordures, boutons, champs, badges, cartes d’offre, dialogues et états de chargement. Le marketing peut être expressif ; l’espace de travail privilégie la lecture et l’action.
- [ ] **DES-03 — Thèmes.** Première visite en clair, bascule explicite clair/sombre et mémorisation du choix. Vérifier les deux thèmes sur toutes les surfaces, sans flash gênant au chargement ni perte de contraste.

### Lot 2 — accueil et entrée dans le produit

- [ ] **DES-04 — Accueil.** Remplacer l’ouverture du livre par une introduction directement utilisable. Proposition de titre : « Ton prochain stage ou ton alternance commence ici. » Expliquer immédiatement la recherche d’offres, l’adaptation du CV et de la lettre par IA, puis le suivi selon sa disponibilité réelle.
- [ ] **DES-05 — Preuve par le produit.** Composer un aperçu de carte d’offre, de compatibilité avec le profil et de document adapté. Tout exemple inventé est identifié comme démonstration. Aucun compteur, témoignage ni taux de réussite fictif.
- [ ] **DES-06 — Parcours d’entrée.** Rendre les actions principales explicites : trouver des offres et préparer son profil/CV. Relier les boutons aux parcours réellement disponibles, avec passage par la connexion si nécessaire. Revoir connexion, inscription, récupération de compte et accompagnement du premier usage sans changer les mécanismes d’authentification.

### Lot 3 — tout l’espace étudiant

- [ ] **DES-07 — Structure de l’application.** Harmoniser navigation, en-têtes et actions sur Accueil, Offres, Documents, Questions, Candidatures, Activité et Réglages. Adapter la navigation au mobile sans cacher l’action principale.
- [ ] **DES-08 — Offres.** Donner priorité au métier, à l’entreprise, au contrat, au lieu, à la date et à la source. Clarifier filtres existants, classement selon le CV, fiche détaillée, actions de préparation et états « expirée », « aucune offre » et « erreur ».
- [ ] **DES-09 — Profil et documents.** Simplifier visuellement l’import du CV, la vérification du profil, la préparation des CV/lettres et les retours de génération. Afficher clairement chargement, succès, erreur et limites. Ne pas faire passer l’historique de versions pour une fonction déjà livrée.
- [ ] **DES-10 — Candidatures.** Harmoniser le suivi existant et préparer la présentation du futur suivi complet. Les statuts et actions visibles doivent correspondre aux données réellement persistées. Toute capacité future reste indiquée « Bientôt » tant que son parcours n’est pas terminé.
- [ ] **DES-11 — Surfaces secondaires.** Appliquer la même identité à l’activité, aux réglages, à la feuille de route, à l’administration, aux pages légales et aux écrans d’erreur ou « Bientôt ». Une éventuelle présentation recruteur reste cohérente avec son état réel.

### Lot 4 — animation, accessibilité et vérification

- [ ] **DES-12 — Signature animée.** Prévoir une courte séquence d’accueil montrant profil → offre compatible → CV adapté, et une interaction discrète du logo. Le contenu et les boutons restent accessibles pendant l’animation. Éviter les boucles permanentes pendant la lecture.
- [ ] **DES-13 — Mouvements de l’interface.** Utiliser des transitions brèves pour filtres, panneaux, progression et confirmations. Privilégier opacité et déplacement, éviter les changements de mise en page coûteux. Respecter `prefers-reduced-motion`, le clavier et les écrans tactiles ; aucun fonctionnement ne dépend du survol.
- [ ] **DES-14 — Vérifications.** Contrôler les thèmes aux formats mobile, tablette et bureau ; absence de débordement dès 320 px, focus visible, contraste du texte courant d’au moins 4,5:1, libellés accessibles et zones tactiles confortables. Vérifier également les états vides, en cours, en erreur et les textes longs.
- [ ] **DES-15 — Parcours et livraison.** Vérifier accueil → connexion → profil/CV → offres → préparation de documents → suivi disponible. Exécuter les contrôles pertinents du dépôt, puis une revue visuelle et fonctionnelle. Après mise en ligne autorisée, vérifier en production avant de cocher les tâches livrées.

## Travaux fonctionnels conservés séparément

Le changement d’apparence n’implémente pas à lui seul ces fonctions déjà prévues :

- [ ] Suivi complet des candidatures, confirmation « As-tu postulé ? », rappels et relances.
- [ ] Dossier par offre, journal, notes, classement, annulation et corbeille.
- [ ] Historique et comparaison des versions de CV et de lettre.
- [ ] Filtres avancés et recherches enregistrées avec alertes.
- [ ] Extension Chrome, préparation d’entretien et intégration des réponses Gmail.

Les autres tâches du backlog historique restent inchangées. Cette mise à jour ne revalide pas leurs états, ne change pas le périmètre de collecte et ne décide pas d’un paiement ou d’un envoi automatique.

## Ordre de travail et définition de terminé

1. Construire et déployer la première proposition sur l’accueil uniquement, à la demande du propriétaire.
2. Recueillir son retour sur l’identité, le logo et les thèmes visibles sur cette page.
3. Après ce retour, étendre le système aux écrans d’entrée.
4. Étendre le système à l’espace étudiant, puis aux surfaces secondaires.
5. Ajuster les animations, vérifier les parcours et préparer la livraison.

Une tâche reste ouverte tant que son résultat n’est pas implémenté et vérifié. Les tests et la compilation ne remplacent pas la revue à l’écran ; une belle maquette ne remplace pas une fonction connectée aux données. Les critères de livraison du backlog historique restent applicables.

## Reprise de Claude — 6 octobre 2026

Sources conservées : [passation](PASSATION-CLAUDE-2026-10-06.md) et [backlog Claude](BACKLOG-CLAUDE-2026-10-06.md). Ce sont des documents transmis par le propriétaire : leurs cases et affirmations historiques doivent être confrontées au code et à la production.

- [x] Lire la passation et récupérer le dernier commit du bundle (`995f185e`) sans écraser les fichiers locaux. Un seul commit manquait ; les autres améliorations étaient déjà présentes.
- [x] Vérifier les tests de cette version : 145 réussis, 1 ignoré (pdflatex absent), aucune erreur.
- [x] Vérifier TypeScript et lint : aucune erreur.
- [x] Vérifier en production les trois onglets de connexion et Google ; demande de réinitialisation acceptée, réception de l'e-mail confirmée par le propriétaire. Le modèle reçu reste celui de Supabase, en anglais. Le code accepte les anciens liens PKCE, mais le nouveau mot de passe n'a pas été saisi/testé.
- [x] TypeScript, lint, tests et compilation de production réussis ; dernier commit de Claude et documents de reprise poussés sur `main`.
- [ ] Vérifier la fin du déploiement Vercel et la CI GitHub de cette reprise.
- [ ] Vérifier à l'écran la connexion sur ordinateur et mobile, puis inscription et réinitialisation avec une adresse de test autorisée.
- [ ] Vérifier le SMTP et les modèles d'e-mail avant de déclarer la connexion terminée.
- [ ] Terminer le rattrapage du catalogue : contrôle réel du 6 octobre, 3 851 offres ouvertes, 1 664 vectorisées et 0 résumé partagé. Aucun appel `reading` enregistré dans les dernières 24 heures ; cause à établir.
- [ ] Après la vérification de cette livraison : sélectionner les preuves pertinentes du profil pour les CV et lettres (RAG), puis vérifier les quotas et les alertes de coût.

Le document hébergé sur claude.ai n'est pas synchronisé automatiquement avec ces fichiers.

## Guides de conception et passage de relais

Référence demandée : [sélection design d’Atlas](https://atlas-room.com/t/design). Guides consultés : [Impeccable](https://github.com/pbakaus/impeccable), [Taste](https://github.com/leonxlnx/taste-skill) et [animations d’Emil Kowalski](https://github.com/emilkowalski/skills). Ils orientent le travail ; les décisions du propriétaire restent prioritaires.

Pour reprendre avec Cowork ou Codex : lire `PRODUCT.md`, cette page, le brief de l’accueil et les rapports de vérification, puis inspecter les changements Git. Les conversations ne se synchronisent pas automatiquement. La première implémentation concerne uniquement l’accueil ; ne pas étendre l’identité aux autres écrans avant le retour du propriétaire.
