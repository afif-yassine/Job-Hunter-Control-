# Job Hunter — Product backlog

Oct 3, 2026 · @Someone

Coché = livré dans le code. Je coche moi-même chaque case quand l’étape est faite.

## Méthode : agile, pas cycle en V

On travaille en **agile** (un Scrum léger) : des sprints courts, une version mise en ligne et vérifiée à la fin de chacun, et un backlog qu’on réordonne selon ce qu’on apprend. C’est bien ce que tu as fait depuis le début.

|  | Cycle en V | Agile (notre méthode) |
| --- | --- | --- |
| Plan | Tout est spécifié au départ | Backlog priorisé, revu à chaque sprint |
| Livraison | Une seule, à la fin | Une version utilisable à chaque sprint |
| Changement en route | Coûteux : on remonte le V | Prévu : on déplace des cases du backlog |
| Tests | Après le développement (branche droite du V) | À chaque envoi (CI) et en production à chaque sprint |
| Quand on voit le produit | À la fin | Dès le premier sprint |
| Adapté à | Besoin figé et contrat fixe | Produit qui cherche encore ses utilisateurs |

« Parfait dès le début », en agile, veut dire : chaque composant du **socle essentiel** respecte la Définition de « terminé » avant l’ouverture au public. Tout rendre parfait d’un coup, avant de montrer quoi que ce soit, ce serait revenir au cycle en V. La règle des prochains sprints : finir le socle avant d’ajouter de nouvelles fonctions.

- **Sprint** : 1 à 2 semaines, un objectif en une phrase.
- **Planification** : on choisit les cases du sprint, le socle en premier.
- **Revue** : mise en ligne, vérification en production, cases cochées ici.
- **Rétrospective** : ce qui a coincé, et ce qu’on change au sprint suivant.

&#91;embedded content: cycle en V et boucle agile\]

En V, on ne voit le produit qu’à la livraison finale ; en agile, chaque tour de boucle se termine par une version en ligne qu’on vérifie.

## Définition de « terminé »

Une case n’est cochée que si tout ce qui suit est vrai. C’est notre définition de « parfait ».

- Les tests automatiques, le lint et la compilation passent, et la CI GitHub est verte.
- C’est vérifié à l’écran, sur ordinateur et sur mobile, sans rien qui déborde.
- Chaque erreur s’affiche en français clair ; rien ne plante en silence.
- Chaque compte ne voit que ses données, et ce qui coûte a une limite de requêtes.
- Le coût IA est mesuré, et rien n’est dépensé sur une offre retirée.
- C’est utilisable par tous : vrais boutons, texte lisible, animations coupées si l’appareil le demande.
- C’est mis en ligne et vérifié en production (Vercel, Supabase).

## Le socle essentiel (MVP)

Ces 12 composants doivent être « terminés » avant d’ouvrir l’appli à d’autres étudiants : 4 le sont et 8 sont à finir. Le reste du backlog attend.

| Composant | Pourquoi il est essentiel | État | Ce qui manque |
| --- | --- | --- | --- |
| Connexion et comptes | Sans compte, rien ne commence | À finir | E-mails de connexion envoyés depuis lebontaf.com (SMTP personnalisé) pour que tout le monde reçoive le lien, protection des mots de passe divulgués |
| Import du CV | Tout le reste part du profil | Fait | — |
| Catalogue d’offres (collecte 2 fois par jour) | C’est ce que l’étudiant vient chercher | À finir | Plus de stages, logo Adzuna, plan Supabase au-delà de 500 Mo |
| Recherche et filtres | Trouver vite la bonne offre | À finir | Filtres avancés, recherches enregistrées |
| Classement selon le CV | Les bonnes offres en premier | À finir | Embeddings jamais calculés en production (0 offre sur 3 940) : classement à refaire, voir Sprint 7 |
| CV et lettre adaptés | La promesse principale du produit | À finir | RAG sur le registre de vérité (rien d’inventé) |
| Suivi des candidatures | Savoir où on en est | À finir | Mise en ligne du Sprint 6 (parcours de chaque offre, Mon suivi) |
| Design LeBonTaf | La première impression, sur mobile aussi | Fait | — |
| Sécurité et limites | Protéger les données et le budget | À finir | Protection des mots de passe divulgués (réglage Supabase) |
| Coûts IA maîtrisés | Ne pas payer plus que prévu | À finir | Alertes de dépassement, offre gratuite limitée |
| Pages légales et RGPD | Obligatoire avant d’ouvrir au public | Fait | — (mentions de l’éditeur à mettre à jour avec la micro-entreprise avant de facturer) |
| Tests et mise en ligne | Chaque version est fiable | Fait | — |

## Périmètre décidé

On ne collecte que les **stages, alternances et CDD** des métiers de l’**informatique, du numérique et de la bureautique**, partout en France. L’étudiant choisit ses catégories au lieu de taper des mots-clés.

| Catégorie | Exemples de métiers |
| --- | --- |
| Développement web et logiciel | Développeur front, back, full stack, Java, Python |
| Développement mobile | Développeur iOS, Android, Flutter |
| DevOps et cloud | DevOps, SRE, ingénieur cloud |
| Systèmes, réseaux et support | Technicien support, admin systèmes et réseaux, helpdesk |
| Data et IA | Data analyst, data engineer, data scientist, ML |
| Cybersécurité | Analyste SOC, pentester, technicien sécurité |
| Test et qualité | Testeur, QA, automatisation des tests |
| Projet, produit et conseil SI | Chef de projet digital, Product Owner, consultant AMOA |
| Design numérique | UX/UI designer, webdesigner |
| Marketing digital | SEO, community manager, growth, webmarketing |
| Bureautique et assistanat | Assistant administratif, secrétariat, gestion administrative |

Un champ « Autre métier » reste possible pour ce qui n’entre dans aucune case. Contrats exclus de la collecte : CDI, intérim, freelance.

## Déjà fait (avant le Sprint 1)

- [x] Comptes, connexion et base Supabase avec accès limité à ses propres données
- [x] Recherche multi-sources : France Travail, JSearch, Adzuna, Jooble
- [x] Pages carrière des entreprises (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee)
- [x] Découverte automatique des entreprises à partir des liens des offres
- [x] Dédoublonnage (même lien, même empreinte, texte proche) et « Déjà postulé ailleurs »
- [x] Offres suspectes mises de côté avant toute dépense IA
- [x] Lecture du texte complet des annonces avant l’analyse
- [x] Score de compatibilité avec le profil (Gemini)
- [x] CV et lettre adaptés : PDF, LaTeX, modification par une phrase
- [x] Questions des formulaires gardées et réutilisées
- [x] Recherche automatique sur le serveur (cron Vercel) et worker Railway
- [x] Santé des sources, budgets gratuits et alertes dans la page Admin
- [x] France Travail : marché du travail et taux d’accès à l’emploi
- [x] Clés des sources saisies depuis l’appli (Réglages > Sources)

## Sprint 1 — Fondations solides (en cours)

Objectif : une recherche ne coûte plus par compte, aucune erreur cachée, aucune dépense sur une offre morte.

- [x] Sauvegarde de la base avant les changements de structure
- [x] La bonne alternance branchée, mais éteinte : leur licence interdit l’usage commercial sans accord écrit
- [x] Chaque erreur s’affiche, une partie qui plante ne bloque plus le reste
- [x] Cartes « Bientôt » et page Feuille de route dans l’appli
- [x] Catalogue d’offres commun : chaque offre stockée une seule fois
- [x] Cache partagé par requête, insensible aux majuscules, accents, ordre des mots et synonymes
- [x] Offres retirées de la page carrière fermées automatiquement
- [x] Offres plus vues depuis 21 jours expirées
- [x] Bouton « Offre plus disponible ? », fermeture pour tous après 10 signalements
- [x] Filtre « Plus disponibles », aucune analyse ni génération sur une offre morte
- [x] Nouveaux comptes et nouvelles recherches remplis depuis le catalogue, sans appel aux sites
- [x] Villes de banlieue reconnues sans numéro de département
- [x] Mise en ligne de ces changements (deploy-job-hunter.bat) et vérification sur Vercel
- [x] Fonctions du budget et du journal des sources réservées au serveur (faille relevée par Supabase)
- [x] En-têtes de sécurité du site (anti-iframe, HTTPS forcé, permissions bloquées)
- [x] Limite de requêtes par compte sur les pages qui coûtent (recherche, analyse, génération, compteurs)
- [x] Politique de sécurité du contenu (CSP) avec nonces
- [x] Coût IA suivi par compte dans la page Admin
- [x] Tests automatiques à chaque envoi sur GitHub (CI)

## Sprint 2 — Collecte plateforme et catégories

Objectif : la plateforme collecte 2 fois par jour pour tout le monde, l’étudiant coche ses catégories et voit tout de suite les offres.

- [x] Vérifier les conditions d’utilisation de chaque source pour un catalogue partagé (France Travail, Adzuna, Jooble, JSearch, La bonne alternance)
- [x] Liste des catégories avec leurs codes métier ROME et leurs mots de recherche
- [x] Collecte France Travail par région et par métier, alternance et CDD (toute la France, découpée par département au-delà de 3 150 offres)
- [x] Collecte des pages carrière connues, toutes entreprises confondues
- [x] Collecte Adzuna sur les grandes villes, dans le budget gratuit
- [x] Collecte lancée à 6 h et 14 h, par tranches de 45 s qui reprennent où elles s’arrêtent (limite de 60 s de Vercel)
- [x] Chaque offre rangée dans une catégorie et un type de contrat (stage, alternance, CDD)
- [x] Choix des catégories par l’étudiant, avec le nombre d’offres près de chez lui
- [x] Champ « Autre métier » avec recherche à la demande ; une catégorie déjà bien couverte par la collecte (20 offres et plus) n’est plus recherchée compte par compte
- [x] Vérification que l’offre est toujours en ligne juste avant de créer le CV et la lettre
- [ ] Plan Supabase adapté au volume (le plan gratuit s’arrête à 500 Mo)
- [x] Mentions obligatoires sur chaque offre : « Source : France Travail » avec lien vers la licence, « Jobs by Adzuna »
- [x] Offres France Travail retirées fermées et leur texte effacé dans le catalogue après chaque collecte complète
- [x] Suivi de la collecte dans Admin, avec le bouton « Avancer la collecte »
- [x] Première collecte réelle vérifiée : 134 tâches sans erreur, 4 623 offres France Travail lues, 101 départements, 3 588 offres ouvertes au catalogue
- [ ] Logo officiel Adzuna à côté de « Jobs by Adzuna » (exigé par leurs conditions)
- [x] Effacer aussi le texte des offres France Travail retirées dans les listes des comptes (licence, article 7)
- [x] Offres enregistrées avant les catégories reclassées automatiquement à chaque tranche de collecte
- [ ] Plus de stages : France Travail n’en publie pas, la première collecte n’en a trouvé que 17 (Adzuna du matin et pages carrière à renforcer)

## Sprint 3 — CV importé et classement intelligent

Objectif : l’étudiant dépose son CV une fois, et toutes les offres sont classées pour lui.

- [x] Import du CV en PDF une seule fois, données gardées pour tous les CV adaptés
- [x] Choix des catégories proposé d’après le CV
- [x] Activer pgvector dans Supabase
- [x] Embedding de chaque offre, calculé une seule fois et partagé
- [x] Classement de toutes les offres ouvertes selon le profil
- [ ] RAG sur le registre de vérité du profil pour le CV et la lettre (rien d’inventé)
- [x] Résumé court de chaque offre (« En bref »), écrit à la première analyse et partagé avec tous
- [ ] Catégorie des offres affinée par embeddings (« Ingénieur plateforme » → DevOps)

## Sprint 4 — Design et suivi des candidatures

Objectif : une appli attirante et simple, où l’étudiant suit chaque candidature jusqu’à la réponse.

- [x] Maquette du design validée : accueil, connexion, espace étudiant, pistes, registre, admin, recruteur, écran « Bientôt »
- [x] Nouveau design LeBonTaf dans le site (vieux livre et moderne, logo lampe animé, animations Framer Motion), thème clair et sombre, adapté au mobile (accueil et connexion faits)
- [x] Filtres et catégories dans la liste des offres
- [ ] Historique et comparaison des versions de CV et de lettre
- [x] Registre des candidatures en tiroirs : repérées, prêtes, envoyées, entretiens, réponses, classées
- [ ] Extension Chrome pour enregistrer une candidature faite sur un autre site
- [x] Relances proposées après quelques jours sans réponse
- [ ] Fiche de préparation d’entretien pour chaque offre
- [x] Question « As-tu envoyé ta candidature ? » au retour d’une annonce, et badge « déjà envoyée » dans les offres
- [x] Rappels du jour : candidature prête mais pas envoyée depuis 3 jours, relance après 7 jours sans réponse, entretien à venir
- [x] Dossier de chaque offre : résumé « En bref », journal daté, CV et lettre, notes libres
- [ ] Classer ou supprimer une offre, avec annulation immédiate et corbeille de 30 jours
- [ ] Filtres avancés : nombre d’offres par filtre, ressemblance avec le CV, date de publication, région, onglets (nouvelles, gardées, déjà postulé, masquées), sélection multiple
- [ ] Recherches enregistrées avec alerte de nouvelles offres
- [ ] Tableau d’enquête : le CV relié aux offres, avec les compétences en commun

## Sprint 5 — Connexion, légal et marque LeBonTaf

Objectif : un compte facile à créer, des pages légales en règle et un nom de marque propre avant l’ouverture au public.

- [x] Connexion par Google et par lien magique (e-mail), sans mot de passe
- [x] Pages légales : confidentialité, mentions légales, conditions d’utilisation
- [x] Export et suppression du compte dans Réglages (RGPD)
- [x] Application Google publiée en production
- [x] Nouveau nom LeBonTaf et domaine lebontaf.com branchés (Vercel, Supabase, Google Cloud)
- [ ] Liens de connexion envoyés depuis lebontaf.com (SMTP personnalisé, modèles d’e-mail au format token\_hash)
- [ ] Adresse contact@lebontaf.com redirigée vers Gmail
- [ ] Écran de connexion Google au nom LeBonTaf (validation de la marque : Search Console et logo)
- [x] Refonte « tableau d’enquête » : porte d’entrée animée, logo animé, accueil, connexion, pages légales et espace étudiant (code prêt et fusionné avec le travail de Codex, mise en ligne en attente)

## Sprint 6 — Suivre chaque offre jusqu’à l’entretien (en cours)

Objectif : pour chaque offre, l’étudiant voit d’un coup d’œil où il en est : vue ou pas, CV et lettre prêts ou pas, envoyée ou pas, entretien, réponse. Demande du 5 octobre.

| Étape | Quand l’offre y passe | Action proposée |
| --- | --- | --- |
| Nouvelle | Trouvée par la collecte, jamais ouverte | Ouvrir l’offre |
| Vue | Ouverte au moins une fois | Créer le CV et la lettre, ou l’écarter |
| Dossier prêt | CV et lettre créés | Relire, puis postuler sur le site de l’offre |
| Envoyée | L’étudiant confirme « J’ai postulé » | Relancer après 7 jours sans réponse |
| Entretien | Date d’entretien saisie | Préparer l’entretien |
| Réponse | Acceptée ou refusée | Fin du parcours |
| Écartée | À tout moment, « Pas pour moi » | Restaurer si besoin |

- [x] Parcours enregistré pour chaque offre : étape, date de vue, date d’envoi, date d’entretien, réponse
- [x] Carte d’offre complète avant le clic : ville, salaire, date de publication, plateforme, score avec le CV, contrat, étape, CV et lettre créés ou non, pastille « nouvelle »
- [x] Salaire récupéré auprès des sources qui le donnent (France Travail, Adzuna, JSearch, Jooble)
- [x] Nombre de candidats : aucune de nos sources ne le donne ; à la place, nombre d’étudiants LeBonTaf qui suivent la même offre (anonyme, affiché à partir de 3)
- [x] Clic sur une offre : panneau avec « En bref » (missions, outils, rythme), infos clés, frise du parcours et la bonne action
- [x] « Mon suivi » : une colonne par étape (onglets sur mobile), déplacement en un clic
- [x] Espace étudiant allégé : Accueil, Offres, Mon suivi, Réglages ; « Candidatures » fusionné dans Mon suivi ; Activité réservée à l’admin ; Documents et Questions rangés dans le panneau de l’offre et dans « Plus »
- [x] Accueil : « À faire aujourd’hui » tiré du parcours (dossiers à relire, candidatures à envoyer, relances, entretiens)
- [x] Offre gratuite : 2 dossiers (CV + lettre) par mois, compteur visible, compte admin illimité, refus clair quand la limite est atteinte ; la recherche automatique ne dépense jamais ces dossiers
- [ ] Tests (135) et vérification sur mobile et ordinateur faits ; base Supabase déjà mise à jour ; reste la mise en ligne du code (deploy-job-hunter.bat)

## Sprint 7 — IA moins chère et plus juste (embeddings, RAG, score pour toutes les offres)

Objectif : chaque offre est lue et vectorisée une seule fois pour tout le monde, chaque étudiant voit un score sur toutes ses offres, et l'IA chère ne sert qu'à écrire le CV et la lettre. Constat du 5 octobre : 0 offre vectorisée sur 3 940, 0 résumé partagé, 50 offres scorées sur 604.

- [ ] Clé Gemini payante avec plafond de dépenses (le niveau gratuit peut entraîner Google sur les CV : problème RGPD)
- [x] Lecteur partagé (Gemini 2.5 Flash-Lite, en lot) : résumé, compétences, mots-clés, salaire, niveau et télétravail de chaque offre, une seule fois
- [ ] Lecteur du CV : même fiche structurée pour le profil de l'étudiant, et ses expériences découpées en preuves
- [x] Embedding de chaque offre (gemini-embedding-001, 768 dimensions), calculé une seule fois et partagé. Cause trouvée le 6 octobre : gemini-embedding-2 renvoyait 1 seul vecteur pour 50 offres, d'où 0 offre vectorisée
- [x] Score rapide pour toutes les offres : proximité des vecteurs + compétences en commun + filtres (contrat, ville, niveau), calculé en base
- [x] « Pourquoi ce score » écrit sans IA (compétences en commun et manquantes) ; l'analyse approfondie par l'IA reste à la demande, dans le quota du jour
- [ ] RAG pour le CV et la lettre : le générateur ne reçoit que les preuves du CV les plus proches de l'offre
- [ ] Nouvelle offre gratuite : toutes les offres scorées, avec résumé et « pourquoi ce score » (comparaison sans IA, donc gratuite) ; 2 CV et 2 lettres par mois, remis à zéro le 1er
- [ ] Rattrapage : vectoriser et lire les 3 756 offres ouvertes déjà en base (automatique après la mise en ligne : 300 vecteurs et 60 lectures toutes les 10 minutes)
- [x] Suivi des coûts IA par jour dans l'admin
- [x] Espace admin séparé de l'espace étudiant (/admin) : inscrits, actifs, Pro, revenu, coût IA, état du catalogue
- [x] Niveaux de lancement façon jeu dans l'admin (100, 1 000, 8 000 inscrits) avec les étapes à franchir et des points
- [x] Prévision des coûts et seuil de rentabilité (nombre de Pro nécessaires) dans l'admin

## Sprint 8 — Réponses, paiement et lancement public

Objectif : ouvrir l’appli à d’autres étudiants avec un modèle payant légal.

- [ ] Réponses des recruteurs lues dans Gmail et rangées dans le suivi
- [ ] Taux de réponse par entreprise et par catégorie
- [ ] Modèle de paiement validé par un juriste (facturer écoles, CFA ou entreprises plutôt que l’étudiant : article L5321-3 du Code du travail)
- [x] Offre gratuite limitée (par exemple 2 CV et 2 lettres par IA)
- [ ] Offre Pro à 7,99 €/mois par Stripe : CV et lettres sans quota (dans une limite raisonnable) et score détaillé sur toutes les offres ; la recherche reste gratuite pour tous
- [ ] Passer Vercel en Pro (20 $/mois, obligatoire dès qu'on encaisse) et Supabase en Pro (25 $/mois, sauvegardes)
- [ ] Pages publiques : accueil, tarifs, mentions légales, confidentialité (RGPD) — légal fait, tarifs à venir
- [ ] Inscription ouverte et accompagnement du premier usage
- [ ] Suivi des coûts par compte et alertes de dépassement
- [ ] Espace recruteur : publier une offre et voir les profils proches, anonymes et avec l’accord des étudiants

## Plan de lancement : coûts par niveau

Estimation du 6 octobre, coûts mensuels en dollars. Un étudiant gratuit très actif coûte au plus 0,15 $ d'IA par mois (moyenne prévue 0,06 $), un Pro environ 1,50 $, à condition de scorer avec Gemini Flash-Lite (avec Gemini 3.6 Flash, c'est 1,25 $ par étudiant gratuit). Un Pro rapporte environ 7,50 € après les frais Stripe. Héberger nos propres modèles (carte graphique louée 24 h/24 : 175 à 240 $/mois) ne devient intéressant qu'au niveau 3, et seulement pour lire les offres et scorer.

| Niveau | Objectif | Hébergement | IA | Total | Pro pour être rentable |
| --- | --- | --- | --- | --- | --- |
| 1 — Les 100 premiers | 100 inscrits, bêta gratuite | 0 $ (Vercel Hobby et Supabase Free tant qu'on n'encaisse pas) | environ 8 $ | environ 10 $ | aucun (bêta), 2 à 4 dès que Stripe est actif |
| 2 — Les 1 000 | 1 000 inscrits, 40 Pro | 45 $ (Vercel Pro + Supabase Pro) | environ 125 $ | environ 170 $ | 16 |
| 3 — Les 8 000 | 8 000 inscrits, 240 Pro | environ 135 $ | environ 860 $ | environ 1 000 $ | 89 |

## Actions de ton côté

Ces étapes demandent ton compte, tes clés ou ta signature : je ne peux pas les faire à ta place.

- [x] Lancer deploy-job-hunter.bat pour mettre en ligne le dernier bundle
- [x] Régénérer CRON\_SECRET dans Vercel (l’ancien a été collé dans la conversation)
- [ ] Recoller la clé Jooble reçue par e-mail dans Réglages > Sources
- [ ] Activer la protection contre les mots de passe divulgués (Supabase > Authentication)
- [ ] Créer le compte développeur La bonne alternance et demander l’accord d’usage commercial
- [ ] Ajouter LBA\_API\_KEY dans Vercel une fois l’accord obtenu
- [ ] Consulter un juriste sur le modèle de paiement
- [x] Lancer la première collecte : Admin > Collecte plateforme > « Avancer la collecte » (après la mise en ligne)
- [x] Programmer la collecte toutes les 10 min dans Supabase (SQL fourni dans Admin, avec ton nouveau CRON\_SECRET)
- [ ] Demander à Jooble ses conditions d’utilisation écrites (introuvables en ligne)
- [x] Vérifier que le nom LeBonTaf est libre à l’INPI (le domaine lebontaf.com est déjà acheté)
- [ ] Décider : envoi automatique des candidatures, ou validation par l’étudiant avant chaque envoi
- [x] Créer le client OAuth Google (type Web, retour vers Supabase) et coller son Client ID et son secret dans Supabase > Providers > Google
- [x] Acheter le domaine lebontaf.com et le brancher (Vercel, Supabase, Google Cloud)
- [ ] E-mail pro : rediriger contact@lebontaf.com vers Gmail et créer le SMTP (Resend) pour les liens de connexion, DNS chez Spaceship
- [ ] Passer la clé Gemini en offre payante avant l’ouverture au public
- [ ] Désactiver l’ancien secret client Google dans Google Cloud
- [ ] Prouver la propriété de lebontaf.com (Search Console, DNS) et ajouter un logo pour la validation de marque Google
- [ ] Option : acheter lebontaf.fr (OVH ou Gandi, environ 7 € par an)
- [ ] Créer la micro-entreprise avant de faire payer, puis mettre à jour les mentions légales
- [ ] Lancer deploy-job-hunter.bat avec le dernier bundle (nom LeBonTaf, légal, connexion)
