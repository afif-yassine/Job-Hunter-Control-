# Revue du parcours étudiant — 7 octobre 2026

Agent « parcours-client ». Aucune modification de code, du backlog ou du contexte : ce fichier est le seul écrit.

## 0. Ce qui a été réellement vérifié

| Vérification | État | Détail |
| --- | --- | --- |
| Lecture du code de toutes les vues étudiant | **Faite** | `components/dashboard.tsx`, `components/views/*`, `components/use-pipeline.ts`, `components/questions-panel.tsx`, `components/document-tools.tsx`, `components/jinnjob/*` (accueil public, connexion), `app/globals.css` (points de rupture mobile), routes et bibliothèques citées plus bas. |
| Pages publiques en production | **Partielle, sans écran** | Simple requête HTTP : `/`, `/login`, `/conditions`, `/confidentialite`, `/mentions-legales`, `/accueil` répondent 200 ; `/demo` répond 404. Deux phrases du code retrouvées dans le HTML servi (accueil public et aide du mot de passe). Aucune capture d'écran. |
| Vue à l'écran (ordinateur et mobile) | **Non faite** | L'extension Chrome a répondu deux fois « Browser extension is not connected ». Abandon comme prévu. |
| Parcours connecté (import CV, offres, kit, suivi) | **Non fait** | Aucun compte de test dédié ; interdiction d'utiliser le vrai profil du propriétaire. |
| Import d'un PDF (MVP-01) | **Non fait** | Permission de fichiers de l'extension Chrome toujours bloquante. |
| Clavier, contrastes, lecteur d'écran en conditions réelles | **Non fait** | Seulement relu dans le code et le CSS. |
| Réglages externes (pg_cron Supabase, variables Vercel) | **Non vérifiable depuis le dépôt** | Voir la question au backend, section 2. |

**Tout ce qui suit est donc un constat « lu dans le code », pas « vu à l'écran ».** Les libellés cités sont ceux du code ; leur rendu réel (taille, position exacte, contraste) reste à confirmer avec un compte de test.

Pour finir les vérifications, il faut : (1) l'extension Chrome connectée, (2) un compte étudiant de test sans droit administrateur, (3) un PDF de CV fictif et la permission de fichiers de l'extension, (4) la réponse du backend sur les tâches planifiées réellement actives en production.

## 1. Enchaînement réel des écrans (lu dans le code)

1. **Accueil public** (`/`, `components/jinnjob/landing.tsx`) : animation de porte, promesse, bouton « Ouvrir mon dossier » → `/login`.
2. **Connexion** (`/login`, `components/jinnjob/sign-in.tsx`) : « Continuer avec Google », puis trois onglets « Créer un compte » (ouvert par défaut), « Se connecter », « Lien par e-mail ». Après inscription par mot de passe : écran « Confirme ton adresse. » ; le lien de l'e-mail ramène sur `/`.
3. **Première arrivée dans l'application** (`app/page.tsx:11` → `components/dashboard.tsx:118`) : l'étudiant tombe directement sur l'onglet **Accueil**, sans étape d'accueil ni demande de CV. Il voit dans l'ordre : cinq compteurs à zéro, la carte « Offre gratuite », « À faire aujourd'hui — Rien d'urgent. Ouvre une nouvelle offre pour avancer. », puis « Ta recherche » avec la carte « Ton CV » et le grand bloc « Prêt à chercher / Lancer la recherche ». **Le bouton « Lancer la recherche » est mis plus en avant que l'import du CV.**
4. **Import du CV** : bouton « Importer ou mettre à jour » → **Réglages**, section « 1 · Ton CV ». Dépôt du PDF → « Lecture du CV… » → bloc « Vérifie ce qui a été lu » (expériences, formation, projets, compétences, métiers proposés) → « Enregistrer ce profil ». L'enregistrement coche les métiers proposés et ajoute tout de suite les offres déjà connues. **Après cela, rien ne conduit l'étudiant vers ses offres** : il reste dans Réglages avec un message qui disparaît en 7 secondes.
5. **Offres** (`components/views/jobs-view.tsx`) : onglets Nouvelles / Toutes / Proches de mon CV / À vérifier / Plus disponibles, recherche, filtres, recherches enregistrées, cartes d'offres. Un clic sur une carte ouvre le panneau et fait passer l'offre en « À préparer » dans « Mon suivi ».
6. **Panneau de l'offre** (`components/views/offer-panel.tsx`) : score, « En bref » (résumé demandé automatiquement à l'ouverture), frise « Ton parcours ». Bouton principal « Créer mon CV et ma lettre » → toast « Rédaction… (environ 20 secondes) » → « Ton dossier est prêt ». L'offre passe en « Dossier prêt » ; les deux documents apparaissent avec « Voir le PDF » et « Modifier ».
7. **Candidature** : « Postuler sur le site » (nouvel onglet) ; au retour, question « Alors, tu as postulé ? » → « Oui, c'est envoyé ». Ou bouton « J'ai postulé ».
8. **Suite** : « J'ai un entretien » (date et heure) → « Acceptée » / « Refusée ». « Revenir à l'étape d'avant » disponible. « Pas pour moi » écarte ; « Remettre dans mes offres » restaure.
9. **Mon suivi** (`components/views/track-view.tsx`) : cinq colonnes sur ordinateur, cinq onglets sur mobile ; offres écartées en bas.
10. **Retour à l'Accueil** : « À faire aujourd'hui » liste les dossiers prêts à envoyer, les relances après 7 jours et les entretiens à venir.

**Mobile** (lu dans `app/globals.css`) : sous 900 px, barre du bas à quatre onglets — Accueil, Offres, Mon suivi, Plus ; « Réglages » (donc l'import du CV) est rangé dans « Plus ». Le panneau d'offre devient une feuille montant du bas (92 % de la hauteur) sous 640 px. Les préférences « animations réduites » sont prises en compte (`MotionConfig reducedMotion="user"`, règles CSS dédiées).

## 2. Question précise à poser au backend (avant de supprimer « Lancer la recherche »)

Ce que montre le code :

- **Deux mécanismes distincts existent.** La *collecte commune* (`app/api/cron/harvest/route.ts`) remplit le catalogue partagé. La *recherche par compte* (`app/api/cron/tick/route.ts` → `lib/pipeline/server.ts`) copie les offres du catalogue dans la liste de chaque étudiant et calcule ses scores.
- **`vercel.json` ne planifie que `/api/cron/tick`, une fois par jour à 06:00 UTC** (`vercel.json:5-10`). Rien dans le dépôt ne planifie `/api/cron/harvest` ni `/api/cron/embeddings` : ils dépendent d'un réglage pg_cron fait à la main dans Supabase (`docs/SCANNER.md:104-119` et `157-166`), invisible depuis le dépôt.
- **Chaque appel de `tick` ne traite que 2 comptes** (`lib/pipeline/server.ts:86-88`) et seulement les comptes ayant une ligne `user_settings` avec `auto_scan = true` (`lib/pipeline/server.ts:80-85`). Aucune création de cette ligne à l'inscription n'a été trouvée dans les migrations : elle semble créée au premier enregistrement des réglages ou à la première recherche réussie (`lib/settings.ts:30-40`, `lib/scan/index.ts:418-421`).
- **Le champ `scheduledScan` ne prouve pas qu'une tâche tourne** : il vaut « vrai » dès que deux variables d'environnement existent (`app/api/status/route.ts:47`). Quand il est vrai, la recherche automatique à l'ouverture de l'application est coupée (`components/use-pipeline.ts:70`).
- En dehors du bouton, la liste d'un étudiant se remplit seulement : à l'enregistrement de ses métiers (`app/api/settings/route.ts:55-56`), à l'enregistrement de son profil avec des métiers cochés, ou par `tick`.

**Questions :**

1. En production, quelles tâches planifiées appellent réellement `/api/cron/tick`, `/api/cron/harvest` et `/api/cron/embeddings`, et à quelle fréquence ?
2. Avec 2 comptes par appel, combien de temps un étudiant attend-il ses nouvelles offres si 100 comptes sont inscrits ? (Une fois par jour = 2 comptes par jour ; toutes les 30 minutes = 96 comptes par jour.)
3. Un étudiant qui vient de s'inscrire et n'a jamais ouvert Réglages est-il vu par `tick` ?
4. Si le bouton disparaît, que faut-il à la place pour que la liste se mette à jour seule : augmenter le nombre de comptes par appel, ou rafraîchir depuis le catalogue à l'ouverture de l'application (la fonction `seedFromCatalogue` existe déjà et n'appelle aucun site d'emploi) ?

**Conclusion provisoire : ne pas supprimer le bouton avant la réponse.** Dans l'état lu, c'est peut-être le seul moyen sûr pour un étudiant de rafraîchir sa liste. En attendant, il peut être retiré de la place d'honneur (R1).

## 3. Recommandations

### Bloquant pour le pilote

**R1 — Bloc « Lancer la recherche » de l'accueil**
- **Type** : supprimer (pour l'étudiant) / déplacer (pour l'administrateur)
- **Destinataire** : front, après réponse du backend à la section 2
- **Où** : Accueil, `components/views/home-view.tsx:199-300` (titres et boutons `239-268`, compteurs `270-292`, texte explicatif `293-297`, étapes `25-30` et `212-233`) ; barre de progression `components/dashboard.tsx:504-515`
- **Constat** : l'étudiant voit « Prêt à chercher », « Dernière recherche : … · automatique sur le serveur », un grand bouton « Lancer la recherche », un second bouton « Traiter les offres en attente », la ligne « Aujourd'hui : 0/3 recherches, 0/20 analyses, 0/10 CV + lettres » et un paragraphe expliquant ce que fait le bouton. Pendant le traitement : quatre étapes dont « Écrire CV et lettre » et « Lire les formulaires », qui ne se produisent jamais pour un compte gratuit (`lib/plan.ts:86-91`). Le compteur « 0/10 CV + lettres » contredit la carte « 2 dossiers par mois » affichée plus haut.
- **Proposition** : pour l'étudiant, remplacer tout le bloc par une ligne discrète du type « Tes offres sont mises à jour automatiquement, matin et début d'après-midi. Dernière mise à jour : … ». Garder les boutons, compteurs et étapes uniquement pour l'administrateur (`status.isAdmin`), ou les déplacer dans l'espace admin.
- **Preuve** : lecture du code ; à reproduire en ouvrant l'Accueil avec un compte étudiant.

**R2 — La mise à jour automatique de la liste de chaque étudiant n'est pas garantie**
- **Type** : corriger
- **Destinataire** : backend
- **Où** : `vercel.json:5-10`, `lib/pipeline/server.ts:80-88`, `app/api/status/route.ts:47`, `components/use-pipeline.ts:70`
- **Constat** : voir section 2. L'application affiche « automatique sur le serveur » sans que le dépôt prouve que chaque étudiant est servi régulièrement.
- **Proposition** : répondre aux quatre questions, puis garantir qu'un étudiant voit ses nouvelles offres sans rien presser. C'est la condition de R1.
- **Preuve** : fichiers cités.

**R3 — Un nouvel étudiant n'est pas conduit vers l'import de son CV**
- **Type** : déplacer
- **Destinataire** : front
- **Où** : Accueil, `components/views/home-view.tsx:166-170` et `188-197`
- **Constat** : à la première visite, « Rien d'urgent. Ouvre une nouvelle offre pour avancer. » alors qu'il n'y a ni CV ni offre. La carte « Ton CV » est en bas, sous le titre « Ta recherche », avec un bouton secondaire « Importer ou mettre à jour ».
- **Proposition** : tant qu'aucun profil n'est enregistré (`GET /api/profile` renvoie déjà l'information), afficher la carte CV en premier, en bouton principal « Importer mon CV », et masquer « Rien d'urgent ». Petit correctif compatible avec la v1.1, qui prévoit une porte bloquante.
- **Preuve** : lecture du code.

**R4 — Créer un dossier sans CV donne un message incompréhensible**
- **Type** : corriger
- **Destinataire** : front (garde et bouton) et backend (message)
- **Où** : panneau de l'offre, `components/views/offer-panel.tsx:373-376` ; `lib/pipeline/generate.ts:61` ; `lib/pipeline/compare.ts:19`
- **Constat** : sans profil, « Créer mon CV et ma lettre » aboutit à « Offre ou profil vérifié introuvable », ou à « Confirme ton profil avant de comparer les offres. », sans lien vers l'import.
- **Proposition** : sans profil, remplacer le bouton par « Importer mon CV d'abord » qui mène à Réglages ; côté serveur, un message clair du type « Importe ton CV dans Réglages avant de créer un dossier ».
- **Preuve** : lecture du code ; à reproduire avec un compte sans CV.

**R5 — « Envoyer sur Drive » envoie le document de l'étudiant dans le Drive de la plateforme**
- **Type** : supprimer (pour l'étudiant)
- **Destinataire** : front, puis backend pour fermer la route
- **Où** : Mes documents, `components/views/documents-view.tsx:165-179` et sous-titre `82` ; `app/api/documents/[id]/drive/route.ts:21-69`
- **Constat** : l'étudiant voit « Approuver » puis « Envoyer sur Drive ». La route n'est pas réservée à l'administrateur et dépose le PDF dans le dossier Google Drive configuré pour la plateforme, pas dans celui de l'étudiant. Si Drive est configuré en production, un CV d'étudiant part chez le propriétaire sans que l'étudiant le comprenne.
- **Proposition** : masquer « Approuver », « Envoyer sur Drive » et « Ouvrir sur Drive » pour les étudiants, et refuser la route aux comptes non administrateurs. Le coordinateur doit vérifier si Drive est configuré en production.
- **Preuve** : lecture du code. Non testé.

**R6 — Messages d'erreur techniques montrés à l'étudiant**
- **Type** : corriger
- **Destinataire** : front
- **Où** : `lib/errors.ts:12-77`, utilisé par `components/dashboard.tsx:84-88` ; `components/dashboard.tsx:518-524`
- **Constat** : une erreur contenant « 502 » ou « 503 » devient « Le worker Playwright ne répond pas — Vérifie que le service Railway est démarré ». D'autres règles parlent de « clé Gemini » ou de « Vercel ». Le bandeau d'état dit « Le serveur n'a pas répondu à /api/status… regarde les journaux Vercel ». Les erreurs s'affichent en toast rouge qui ne se ferme pas seul.
- **Proposition** : pour un étudiant, une seule phrase neutre (« Ça n'a pas marché de notre côté. Réessaie dans quelques minutes. ») ; garder le détail technique pour l'administrateur.
- **Preuve** : lecture du code ; à vérifier pendant MVP-06 (limites atteintes, budget épuisé).

### Gênant

**R7 — Après l'enregistrement du profil, aucune suite proposée**
- **Type** : ajouter
- **Destinataire** : front
- **Où** : Réglages, `components/views/settings-view.tsx:710-715`
- **Constat** : message « Profil enregistré. N métier(s) coché(s), N offre(s) ajoutée(s) » qui disparaît ; l'étudiant reste dans Réglages.
- **Proposition** : ajouter un bouton « Voir mes offres » dans la section CV après l'enregistrement, ou y conduire directement.
- **Preuve** : lecture du code.

**R8 — Réglages « Ce que tu cherches » : éléments techniques visibles par l'étudiant**
- **Type** : déplacer / renommer
- **Destinataire** : front
- **Où** : `components/views/settings-view.tsx:465-468` (« Départements (France Travail) »), `479-498` (« Entreprises à surveiller directement »), `499-544` (« Entreprises trouvées automatiquement », avec adresses `jobs.lever.co/…`), `545-550` (interrupteur « Recherche automatique sur le serveur, même appli fermée (au plus toutes les 12 h) »), `372` (« Elle sera utilisée au prochain lancement. »)
- **Constat** : l'étudiant voit le fonctionnement interne de la collecte et un interrupteur qui lui permet de couper sa propre mise à jour.
- **Proposition** : garder contrat, métiers, ville, ancienneté ; ranger les pages carrière et les entreprises découvertes dans un bloc replié « Options avancées » ou réservé à l'administrateur ; renommer « Départements » sans « France Travail » ; retirer l'interrupteur pour l'étudiant ; message d'enregistrement : « C'est noté. Tes offres sont mises à jour. »
- **Preuve** : lecture du code.

**R9 — Modifier un dossier par une consigne : introuvable depuis l'offre**
- **Type** : ajouter
- **Destinataire** : front
- **Où** : panneau de l'offre, `components/views/offer-panel.tsx:387-404` ; l'action existe seulement dans `components/views/documents-view.tsx:146-148` (Plus > Mes documents)
- **Constat** : dans le panneau, seulement « Voir le PDF » et « Modifier » (édition à la main). « Demander à l'IA » n'est accessible que par Plus > Mes documents.
- **Proposition** : ajouter « Demander une modification » sur chaque ligne de document du panneau (la fenêtre existe déjà).
- **Preuve** : lecture du code.

**R10 — Quota mensuel épuisé : le bouton reste actif**
- **Type** : corriger
- **Destinataire** : front
- **Où** : `components/views/offer-panel.tsx:374-383`
- **Constat** : avec « 0 dossier restant ce mois-ci », le bouton « Créer mon CV et ma lettre » reste cliquable ; le refus arrive en toast rouge.
- **Proposition** : désactiver le bouton et afficher à sa place « Tes 2 dossiers du mois sont utilisés. Les prochains arrivent le … » (le texte existe déjà à l'accueil, `home-view.tsx:122`).
- **Preuve** : lecture du code ; à confirmer pendant MVP-06.

**R11 — Mes documents : état vide et vocabulaire faux pour un compte gratuit**
- **Type** : renommer / supprimer
- **Destinataire** : front
- **Où** : `components/views/documents-view.tsx:67-76`, `118-122`, `152-164`
- **Constat** : « Ils sont créés automatiquement pour les offres notées 80 ou plus » est faux en offre gratuite ; bouton « Voir les offres à traiter » ; menu « LaTeX » avec « Éditer dans Overleaf » et « Télécharger le .tex » ; astuce qui explique LaTeX.
- **Proposition** : état vide « Ouvre une offre et clique "Créer mon CV et ma lettre". » avec le bouton « Voir les offres » ; replier LaTeX sous « Options avancées » ou le réserver à l'administrateur.
- **Preuve** : lecture du code.

**R12 — Phrase inexacte sur la page d'inscription**
- **Type** : renommer
- **Destinataire** : coordinateur (décision), puis front
- **Où** : `components/jinnjob/sign-in.tsx:186` ; présente dans le HTML de production
- **Constat** : « Les mots de passe déjà apparus dans une fuite de données sont refusés. » Le backlog (PUBLIC-01) indique que cette protection est désactivée.
- **Proposition** : retirer la phrase tant que la protection n'est pas active ; garder « 8 caractères au moins. »
- **Preuve** : phrase retrouvée dans la réponse HTTP de `https://lebontaf.com/login` le 7 octobre.

**R13 — Promesses de l'accueil public à aligner sur l'offre gratuite**
- **Type** : renommer
- **Destinataire** : coordinateur (décision), puis front
- **Où** : `components/jinnjob/landing.tsx:201` ; `components/jinnjob/landing-sections.tsx:64`, `287`, `326`
- **Constat** : « écrit ton CV et ta lettre pour celles qui te ressemblent », « Un CV et une lettre écrits pour chaque offre », « les questions du formulaire déjà remplies ». En offre gratuite : deux dossiers par mois, à la demande de l'étudiant.
- **Proposition** : dire « quand une offre te plaît, on écrit ton CV et ta lettre » et mentionner les deux dossiers gratuits par mois ; vérifier que la reprise des questions de formulaire fonctionne réellement pour un étudiant avant de la promettre.
- **Preuve** : première phrase retrouvée dans la réponse HTTP de `https://lebontaf.com/`.

**R14 — Ouvrir une offre déclenche des toasts « Analyse… »**
- **Type** : supprimer
- **Destinataire** : front
- **Où** : `components/views/offer-panel.tsx:147-154` ; `components/dashboard.tsx:197-203`
- **Constat** : à l'ouverture d'une offre sans résumé, toast « Analyse de « X » en cours… » puis « X : compatibilité 72/100. », alors que le panneau affiche déjà « Résumé de l'offre en cours… ». Pendant ce temps tous les boutons du panneau sont désactivés. En cas d'échec, toast rouge permanent pour une action que l'étudiant n'a pas demandée.
- **Proposition** : traitement silencieux à l'ouverture (pas de toast, pas de blocage des boutons « Pas pour moi » et « Voir l'annonce ») ; garder les toasts seulement pour le bouton « Analyse approfondie par l'IA ».
- **Preuve** : lecture du code.

### Amélioration

**R15 — Titres de page différents du menu**
- **Type** : renommer — **Destinataire** : front
- **Où** : `components/dashboard.tsx:57-58` contre `549` (« Mes réponses » → page « Questions ») ; `components/views/documents-view.tsx:67`, `82` (« Mes documents » → page « Documents »)
- **Proposition** : même nom dans le menu et en titre.

**R16 — Page « Mes réponses » : vocabulaire interne**
- **Type** : renommer — **Destinataire** : front
- **Où** : `components/questions-panel.tsx:79` (« SENSIBLE »), `233` (« l'agent »), `406-408` (« MÉMOIRE » / « MANUELLE »), `382`
- **Proposition** : « Donnée personnelle », « on ne te repose pas ces questions », « Reprise automatiquement » / « Saisie par toi » ; état vide expliquant quand une question apparaît.

**R17 — Feuille de route et encarts « Bientôt » : sprints et termes techniques**
- **Type** : renommer — **Destinataire** : front ; coordinateur pour l'état des lignes
- **Où** : `components/views/roadmap-view.tsx:24` ; `components/ui.tsx:101-104` ; `lib/roadmap.ts:22-35`
- **Constat** : pastilles « Sprint 4 », mentions « embeddings », « CSP », « coût IA par compte dans Admin ». Trois lignes sont « En cours » (collecte, catégories, design) alors que le backlog les dit livrées.
- **Proposition** : retirer les numéros de sprint, réécrire les lignes en langage étudiant, mettre les états à jour.

**R18 — Fenêtre « Ajouter une offre »**
- **Type** : corriger — **Destinataire** : front
- **Où** : `components/dashboard.tsx:381`, `655-666`
- **Constat** : « Offre ajoutée. Lance l'analyse depuis sa carte. » alors que la carte n'a pas de bouton d'analyse ; choix « CDI » proposé (hors périmètre) ; lieu prérempli « Paris ».
- **Proposition** : « Offre ajoutée. Ouvre-la pour préparer ta candidature. » ; retirer CDI ; lieu vide ou ville des réglages.

**R19 — Compteurs de l'accueil**
- **Type** : corriger — **Destinataire** : front
- **Où** : `components/views/home-view.tsx:107-114`
- **Constat** : les cinq compteurs mènent tous à « Mon suivi » sans ouvrir l'étape cliquée (visible surtout sur mobile, où une seule étape est affichée).
- **Proposition** : ouvrir directement l'onglet correspondant.

**R20 — Alertes d'administration de l'accueil périmées**
- **Type** : renommer — **Destinataire** : front
- **Où** : `components/views/home-view.tsx:53-58`
- **Constat** : « Clé Gemini manquante… Ajoute GEMINI_API_KEY » alors que l'IA passe par Gateway. Visible par l'administrateur seulement.
- **Proposition** : s'appuyer sur `status.aiConfigured`, comme le fait déjà `settings-view.tsx:583-588`.

**R21 — Réglages par défaut d'un nouveau compte**
- **Type** : corriger — **Destinataire** : backend
- **Où** : `lib/scan/config.ts:42-50`
- **Constat** : sans réglage, un étudiant cherche « développeur, intelligence artificielle, data » à Paris. Un étudiant en marketing à Lyon recevrait ces offres s'il lance une recherche avant d'importer son CV.
- **Proposition** : aucun mot-clé ni ville par défaut ; ne rien proposer tant que les métiers ne sont pas choisis (l'état vide de « Offres » y invite déjà, `jobs-view.tsx:210-218`).

**R22 — Accessibilité (lu dans le code, non testé)**
- **Type** : corriger — **Destinataire** : front
- **Où** : `components/views/jobs-view.tsx:131-142` et `track-view.tsx:47-53` (rôle « onglet » sans panneau associé ni flèches du clavier) ; `jobs-view.tsx:203` (bouton « × ») ; `components/views/offer-panel.tsx:68-104` (fenêtre modale sans piège du focus : la touche Tab peut sortir du panneau)
- **Points corrects relevés** : contour de focus visible global (`app/globals.css:42`), animations réduites respectées, libellés pour lecteur d'écran sur la frise et les pastilles, fermeture du panneau par Échap, messages d'erreur de connexion annoncés.
- **Proposition** : garder le focus dans le panneau ouvert ; retirer les rôles d'onglet ou les compléter.

## 4. Ce qui relève de la v1.1 (à ne pas faire maintenant)

- Porte d'accueil bloquante imposant l'import du CV : R3 et R4 en sont la version légère.
- Vue « Offres » par recommandations (8 par jour) et catalogue flouté : rien à anticiper. R1 ne la contredit pas, la spécification prévoit de garder « Nouvelles offres pour toi » à l'accueil.
- Écran « Prépare ta candidature » (ville et consigne avant génération) : R9 donne déjà la consigne après coup.
- Aucune recommandation ci-dessus ne modifie le contrat d'API figé.

## 5. Fonction livrée et parcours vérifié

Tout ce qui est décrit ici est « fonction présente dans le code ». Aucun parcours connecté n'a été vérifié en production par cette revue : MVP-01, MVP-03 et MVP-05 restent ouverts.

## Résumé pour le propriétaire

1. Tu as raison pour l'accueil : le bloc « Lancer la recherche », ses compteurs et ses explications montrent la machine au lieu de montrer les offres. Je recommande de le retirer pour l'étudiant et de le garder pour toi seul.
2. Avant de le retirer, le backend doit confirmer que chaque étudiant reçoit bien ses nouvelles offres tout seul : d'après le code, ce n'est pas garanti aujourd'hui.
3. Le nouvel étudiant n'est pas guidé : le CV devrait passer en premier, et créer un dossier sans CV donne un message incompréhensible.
4. Plusieurs boutons sont réservés à ton usage et devraient être cachés aux étudiants : « Envoyer sur Drive », « Approuver », LaTeX, pages carrière, messages d'erreur techniques.
5. Je n'ai rien pu regarder à l'écran (extension Chrome non connectée, pas de compte de test) : tout vient de la lecture du code et reste à confirmer.

## Vérifié à l'écran le 7 octobre

Reprise après reconnexion de l'extension Chrome. Périmètre : pages publiques seulement, dans un nouvel onglet, sans connexion, sans création de compte, sans envoi de formulaire. La ligne 5 du résumé ci-dessus est donc partiellement dépassée : voir le tableau.

### Ce qui a pu être regardé

| Page | Ordinateur (fenêtre ~1 536 px) | Mobile (~390 px) |
| --- | --- | --- |
| Accueil public, via `/accueil` | **Vu** | Non fait |
| `/mentions-legales`, `/conditions`, `/confidentialite` | **Vu** (haut de page à l'écran, texte complet lu) | Non fait |
| `/login` et ses trois onglets | **Non fait** | Non fait |
| `/` | **Non fait** | Non fait |

**Pourquoi `/login` et `/` n'ont pas été ouverts.** Ce navigateur a une session LeBonTaf active : depuis la page des mentions légales, `/api/status` a répondu 200 au lieu d'un refus (seul le code de réponse a été lu, pas son contenu). Or `/` affiche le tableau de bord quand on est connecté, et `/login` redirige vers lui (`app/login/page.tsx:15`). Les ouvrir aurait affiché le vrai profil du propriétaire, ce qui est exclu. L'accueil public a donc été regardé par `/accueil`, qui sert la même page (`app/accueil/page.tsx`).

**Pourquoi le mobile n'a pas été fait.** La fenêtre Chrome est restée à 1 536 px malgré deux demandes de redimensionnement (fenêtre agrandie). Un essai d'affichage dans un cadre de 390 px a été bloqué par la protection du site contre l'inclusion dans un cadre — ce qui est une bonne chose côté sécurité. Arrêt après ces essais.

### Ce que l'écran confirme

- **R13 confirmée à l'écran.** Les quatre phrases sont affichées sur l'accueil public : « puis écrit ton CV et ta lettre de motivation pour celles qui te ressemblent » (premier écran), « les questions du formulaire déjà remplies », « Un CV et une lettre écrits pour chaque offre », « tu réponds une fois, on reprend partout ». La page ne contient ni le mot « gratuit » ni aucune mention des deux dossiers par mois.
- **R12 non vue à l'écran** (page `/login` non ouverte). Elle reste établie par le code et par la réponse HTTP du premier passage.
- **Boutons de l'accueil public** : en-tête « Comment ça marche », « Recruteurs », « Se connecter », bouton « Ouvrir mon dossier » ; sous le titre, « Ouvrir mon dossier » et le lien « Voir l'enquête en action » ; plus bas « Essayer avec mon CV », puis « Ouvrir mon dossier » en fin de page. Tous les boutons d'action mènent à `/login`. Place et libellés cohérents, rien à déplacer.
- **Clavier** : le focus est bien visible (contour rouge net sur « Ouvrir mon dossier » après cinq tabulations). La langue de la page est déclarée, un seul titre principal, zone principale présente.
- **Fenêtre « Bientôt »** (bouton « Découvrir l'espace recruteur ») : s'ouvre, ne contient aucun champ de saisie, le focus se place sur la croix, la touche Échap la ferme à l'écran.
- **Débordement** : aucun défilement horizontal en largeur ordinateur sur les quatre pages.
- **Liens** : aucun lien vers `/demo` sur l'accueil public ni sur les trois pages légales, et aucun dans le code des vues ; la page 404 de `/demo` n'est donc pas atteignable par un clic. Liens internes en 200. France Travail et sa licence répondent 200. Adzuna répond 403 à une requête automatique, ce qui ne prouve pas un lien mort : à cliquer à la main.

### Nouveaux constats (absents du rapport initial)

**R23 — La politique de confidentialité décrit une IA qui n'est plus celle utilisée**
- **Type** : corriger
- **Gravité** : bloquant pour le pilote (information donnée aux étudiants sur leurs données)
- **Destinataire** : coordinateur (décision et texte), puis front
- **Où** : page `/confidentialite`, sections 4 et 5
- **Constat** : la page affiche que le CV et les offres sont envoyés « à l'API Gemini de Google », que le service « utilise l'offre gratuite de Gemini, dont Google peut se servir pour améliorer ses produits », et conseille « N'importe pas de CV pendant la phase de test si cela te gêne ». La liste des destinataires ne cite que Supabase, Vercel, Railway et Google. `docs/CONTEXTE-PROJET.md` indique au contraire un passage par AI Gateway avec d'autres modèles, des embeddings Perplexity et l'envoi des e-mails par Resend.
- **Proposition** : faire confirmer par le backend la liste réelle des prestataires qui reçoivent le CV, puis réécrire les sections 4 et 5. La phrase qui déconseille d'importer son CV contredit le parcours et doit disparaître si elle n'est plus vraie.
- **Preuve** : texte lu à l'écran sur `https://lebontaf.com/confidentialite` le 7 octobre.

**R24 — Les conditions d'utilisation oublient la connexion par mot de passe**
- **Type** : corriger — **Gravité** : amélioration — **Destinataire** : coordinateur, puis front
- **Où** : page `/conditions`, section 3
- **Constat** : « Tu te connectes avec Google ou avec un lien envoyé à ton adresse e-mail », alors que la création de compte par mot de passe est l'onglet ouvert par défaut. La section 2 parle de limites « par jour », la limite visible par l'étudiant est de deux dossiers par mois.
- **Proposition** : ajouter le mot de passe ; dire « par jour ou par mois ».
- **Preuve** : texte lu à l'écran le 7 octobre.

**R25 — Accessibilité de l'accueil public**
- **Type** : corriger — **Gravité** : amélioration — **Destinataire** : front
- **Où** : accueil public ; `components/jinnjob/soon.tsx:21-27`
- **Constat** : pas de lien « aller au contenu » ; après fermeture de la fenêtre « Bientôt », le focus ne revient pas sur le bouton qui l'a ouverte ; deux images sans texte de remplacement ; plusieurs liens de bas de page font 18 à 23 px de haut (mesuré en largeur ordinateur, à revoir au doigt sur téléphone).
- **Proposition** : rendre le focus au bouton d'origine, ajouter le lien d'évitement, marquer les images décoratives.
- **Non concluant** : le maintien du focus à l'intérieur de la fenêtre n'a pas pu être tranché.

### Recommandations existantes corrigées par l'écran

Aucune. L'écran ne contredit aucune recommandation du rapport initial.

### Ce qui reste non fait

- `/login` et ses trois onglets, et `/`, à l'écran : il faut une fenêtre de navigation privée ou un profil Chrome sans session LeBonTaf.
- Toute la vue mobile (~390 px) : il faut une fenêtre Chrome non agrandie, ou le mode appareil des outils de développement.
- Parcours connecté, import PDF, clavier et lecteur d'écran dans l'application : inchangé, il faut un compte de test dédié.
