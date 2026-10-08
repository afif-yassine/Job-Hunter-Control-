# Critique du 8 octobre 2026 (soir) — limite de 8 offres, floutage et tarification

Auteur : agent Critique. Demande de la coordination, après la décision du propriétaire de mettre en œuvre **maintenant** la limite de 8 offres par jour pour le compte gratuit, le floutage du reste du catalogue et une tarification.

**À lire d'abord.**

- La décision est prise : ce rapport ne redit pas « reportez ». Il dit ce qui peut mal tourner dans la mise en œuvre et comment l'éviter au moindre coût.
- **Je ne suis pas juriste.** Les articles de loi sont cités de mémoire et n'ont pas été relus sur Légifrance aujourd'hui. Ils servent à savoir quoi demander à un juriste, pas à le remplacer.
- Seul MVP-02 est vérifié en production. Tout coût est une estimation. Rien de ce qui suit n'a été testé : c'est une lecture des documents et du code.
- Chaque phrase importante porte une étiquette : **[fait]** (lu dans un fichier cité), **[probable]**, **[inconnu]**, **[opinion]**.
- Classement demandé : **A = bloquant avant mise en ligne** (de la limite et du flou, même sans paiement) ; **B = à traiter avant d'encaisser un euro** ; **C = acceptable en pilote fermé**.

## Le point qui commande tout le reste

Il y a deux façons de construire la formule payante. Elles n'ont pas du tout le même risque.

| | Variante 1 : « payer pour voir plus d'offres » | Variante 2 : « payer pour plus de dossiers préparés » |
| --- | --- | --- |
| Ce que le gratuit voit | 8 offres par jour, le reste flouté et fermé | 8 offres recommandées par jour, le reste flouté **dans la vue d'accueil**, mais tout le catalogue reste consultable gratuitement par « Explorer tout le catalogue » |
| Ce que le payant achète | l'accès au reste des annonces | plus de CV + lettres adaptés par mois, et les outils de préparation |
| Risque juridique | élevé (voir point 1) | nettement plus faible, à confirmer par un juriste |
| Travail technique | lourd : il faut fermer l'accès aux offres côté base de données | léger : c'est la spécification v1.1 déjà écrite, plus un quota payant |
| Image | « ils font payer des annonces publiques » | « ils font payer un travail de rédaction » |

**[opinion]** La variante 2 respecte la décision du propriétaire (limite de 8, flou, prix) et retire l'essentiel du danger. Tout le rapport la recommande. La variante 1 n'est pas défendable sans avis écrit d'un juriste.

---

## 1. Juridique et sources

### 1.1 La loi française s'applique à toutes les sources, pas seulement à France Travail — A

- **Constat.** Le jugement du 8 octobre parle de l'article 5.1 de la licence France Travail. Mais cet article ne fait que rappeler deux règles du code du travail, qui valent **quelle que soit l'origine de l'annonce** : on ne peut exiger aucune rétribution, « directe ou indirecte », d'une personne qui cherche un emploi en échange d'un service de placement (L. 5321-3), et il est interdit de vendre des offres d'emploi « quel que soit le support » (L. 5331-1). Retirer les offres France Travail du catalogue ne suffirait donc pas.
- **Preuve ou source.** **[fait]** Articles cités dans `docs/audits/public-02-attributions-sources-2026-10-07.md`, ligne 100 et question Q8. **[probable]** Le « placement » est défini par la loi comme le fait de rapprocher offres et demandes d'emploi : faire payer un classement d'offres personnalisé peut y ressembler autant que faire payer l'accès. **[probable]** Ces interdictions sont assorties de sanctions pénales ; montants à faire confirmer.
- **Gravité.** Bloquant pour la variante 1. Sérieux pour la variante 2 tant qu'aucun juriste ne l'a lue.
- **Ce qui le lèverait.** Écrire la formule en variante 2, puis une consultation courte d'un juriste sur la question Q8, avec les textes d'écran sous les yeux. **[estimation, non vérifiée]** Une consultation d'une heure, ou gratuite auprès d'une permanence d'avocats ou d'une clinique juridique d'université.

### 1.2 Ce qui est certain, probable, inconnu, source par source

| Source | Faire payer l'accès aux offres | Faire payer la préparation du dossier | Classe |
| --- | --- | --- | --- |
| **France Travail** | **[fait]** L'article 5.1 l'exclut en toutes lettres (audit, ligne 100). | **[inconnu]** Rien ne l'interdit en toutes lettres ; c'est la question Q8. La licence cite aussi les traitements « à des fins commerciales » comme incompatibles pour les données personnelles (article 8). | A pour l'accès, B pour le reste |
| **La bonne alternance** | **[fait]** Interdit : « la facturation de l'accès pour des tiers comme des candidats est interdite », usage non lucratif seulement (audit, ligne 144). | **[probable]** Interdit aussi dès que le service est lucratif. | A : la clé doit rester absente en production. **[inconnu]** si elle l'est (Q18). |
| **Adzuna** | **[fait]** Hors publication simple, tout usage par une organisation commerciale est limité à 14 jours d'essai puis demande un accord écrit (audit, ligne 71). | **[probable]** Même condition : un service payant est un usage commercial. | B : réponse écrite d'Adzuna (Q1), ou retrait d'Adzuna du catalogue avant d'encaisser. |
| **JSearch** | **[fait]** OpenWeb Ninja permet l'exploitation commerciale dans un produit, mais interdit de revendre les données comme produit à part (audit, ligne 131). Faire payer l'accès aux annonces s'en rapproche. **[inconnu]** Conditions RapidAPI non lues. | **[probable]** Permis avec une clé OpenWeb Ninja. | C si la clé n'est pas posée en production (**[inconnu]**, Q13 et Q18), sinon B. |
| **Jooble** | **[inconnu]** Aucune condition propre à l'API n'a été trouvée ; les conditions du site interdisent la republication sans accord écrit (audit, ligne 120). | **[inconnu]** | C si la clé n'est pas posée, sinon B (écrire à Jooble, Q12). |
| **Pages carrière** | **[inconnu]** Aucun texte ne donne de droits à un agrégateur (audit, ligne 156). **[opinion]** Vendre l'accès à des annonces recopiées sans accord aggrave le risque. | **[probable]** Risque faible : l'entreprise veut que son annonce soit vue, et le lien mène chez elle. | C |
| **Alertes Gmail** | **[fait]** Ne tournent pas en production (registre, BIZ-01). | — | C, à condition de rester éteintes. |

### 1.3 Les écarts déjà connus deviennent plus graves le jour où l'on encaisse — B

- **Constat.** L'audit a relevé six écarts de gravité élevée avec les licences France Travail et Adzuna (E1 à E6). Tant que le service est gratuit et fermé, ce sont des défauts de pilote. Avec un prix, ce sont les défauts d'un service commercial. France Travail peut faire un audit et résilier (articles 10 et 13 de sa licence).
- **Preuve ou source.** **[fait]** `docs/audits/public-02-attributions-sources-2026-10-07.md`, section 4. En particulier : Adzuna dépasse sa limite mensuelle d'après le code (environ 3 300 appels pour 2 500) ; l'étudiant voit un résumé de l'IA et non la totalité de l'offre France Travail.
- **Gravité.** Sérieux. **[inconnu]** quelle part des 4 129 offres ouvertes vient de France Travail : si c'est la majorité, perdre cette source vide le catalogue.
- **Ce qui le lèverait.** Une requête de lecture qui compte les offres ouvertes par source (question à la finance ci-dessous). Puis traiter au moins E5 (mention Adzuna de 116 × 23 px) et E6 (quota) avant d'encaisser.

### 1.4 Ce qui doit rester gratuit et visible — A

**[opinion fondée sur les textes cités]** Pour rester dans les clous, quel que soit le prix :

1. Toute annonce du catalogue reste **trouvable et lisible gratuitement** (bouton « Explorer tout le catalogue », filtres, recherche).
2. Le bouton « Voir l'annonce » vers le site d'origine n'est **jamais** derrière un paiement ni derrière le flou d'une offre que l'étudiant a ouverte.
3. Les mentions restent sur chaque fiche : « Source : France Travail », date, lien vers la licence ; le mot « Adzuna » avec son lien.
4. Les silhouettes floutées ne sont pas de vraies annonces masquées (voir point 4.1) : sinon la mention Adzuna « sur chaque annonce affichée » se poserait aussi pour elles. **[inconnu]**
5. Aucun texte ne dit ou ne laisse entendre que payer donne accès à des offres.

### 1.5 Formulation défendable de l'offre payante

**[opinion, à faire relire]** À écrire : « Les annonces sont gratuites, ici comme sur leur site d'origine. La formule payante, c'est plus de dossiers préparés : X CV + lettres adaptés par mois au lieu de 2. »

Un argument simple à garder : le service payant fonctionne aussi sur une annonce que l'étudiant apporte lui-même (« Ajouter une offre », déjà déverrouillée d'office dans la spécification v1.1, décision 4). Ce qu'on vend ne dépend donc pas du catalogue.

À ne pas écrire : « Débloque toutes les offres », « Accède au catalogue complet », « offres réservées », « offres exclusives », « 8 offres par jour en gratuit, illimité en Pro ».

**Point d'attention.** Si la formule payante donne aussi « plus de 8 recommandations par jour », on revient à faire payer un rapprochement entre offres et candidat. **[probable]** C'est la zone grise. Le plus sûr : la limite de 8 est la même pour tous, payants compris.

---

## 2. Droit de la consommation et données personnelles — B

### 2.1 Rien n'est prêt pour vendre

- **Constat.** Les pages actuelles sont écrites pour un service gratuit en test.
- **Preuve ou source.** **[fait]** `app/conditions/page.tsx`, section 2 : « Si une offre payante apparaît un jour, elle sera optionnelle, annoncée à l'avance et soumise à des conditions séparées ». **[fait]** `app/mentions-legales/page.tsx:28-29` : « Avant toute offre payante, l'éditeur sera immatriculé ». **[fait]** Backlog, PUBLIC-03 non fait ; PLUS-01 (Stripe) non commencé. **[fait]** Aucune page de conditions de vente dans `app/`.
- **Gravité.** Bloquant avant d'encaisser. Sans effet tant qu'aucun paiement n'est possible.
- **Ce qui le lèverait.** La liste ci-dessous.

### 2.2 Liste courte : ce qui doit exister AVANT d'encaisser un euro

Tout est **[probable]** : obligations connues du droit français de la vente en ligne aux particuliers, à faire confirmer.

1. **Une entreprise immatriculée** (numéro SIREN), avec nom, adresse et contact dans les mentions légales. Sans elle, pas de compte Stripe. **[inconnu]** : compatibilité avec la situation personnelle du propriétaire.
2. **Des conditions générales de vente** séparées, acceptées par une case non cochée d'avance : ce qui est vendu, prix, durée, renouvellement, résiliation, remboursement, garantie légale de conformité des services numériques.
3. **Le prix affiché toutes taxes comprises**, par mois, avec la durée d'engagement. En micro-entreprise sous le seuil de TVA : mention « TVA non applicable, article 293 B du CGI ».
4. **Un bouton de paiement sans ambiguïté** (« Payer 7,99 € par mois » et non « Continuer »), précédé d'un récapitulatif.
5. **Le droit de rétractation de 14 jours** expliqué, avec le formulaire type. Si l'étudiant utilise le service tout de suite, il faut sa demande expresse. **[opinion]** Le plus simple et le meilleur pour l'image : « remboursé sur simple demande pendant 14 jours ».
6. **La résiliation en ligne en quelques clics**, depuis le compte, sans écrire à quelqu'un (obligation pour les abonnements souscrits en ligne depuis 2023).
7. **Un médiateur de la consommation** désigné et nommé dans les conditions de vente. C'est une adhésion payante. **[estimation, non vérifiée]** quelques dizaines d'euros par an.
8. **Un reçu ou une facture** envoyé à chaque paiement, et une adresse de support réellement lue.
9. **Une règle pour les mineurs** (voir 2.3).
10. **La page de confidentialité corrigée** (voir 2.4).
11. **Un message aux comptes existants avant le changement** : c'est une promesse écrite des conditions actuelles (sections 2 et 10).

**[opinion]** Vendre un **paquet de dossiers en une fois** (par exemple 5 dossiers) plutôt qu'un abonnement retire les points 6 et le renouvellement automatique, et simplifie le remboursement. C'est plus léger pour un propriétaire seul. À faire chiffrer par la finance et le commercial.

### 2.3 Mineurs — B

- **Constat.** Les conditions ouvrent le service dès 15 ans. Un mineur ne peut pas, en principe, souscrire seul un abonnement payant.
- **Preuve ou source.** **[fait]** `app/conditions/page.tsx:40` et `app/confidentialite/page.tsx:161`. **[probable]** Un contrat signé par un mineur seul peut être annulé, sauf actes courants.
- **Gravité.** Sérieux avant d'encaisser, mineur en pilote gratuit.
- **Ce qui le lèverait.** Réserver la formule payante aux 18 ans et plus, par une déclaration à cocher au moment du paiement. Le gratuit reste ouvert dès 15 ans.

### 2.4 Données personnelles — B

- **Constat.** La page de confidentialité est déjà inexacte, et le paiement ajoute un destinataire et une durée de conservation.
- **Preuve ou source.** **[fait]** `docs/audits/destinataires-donnees-2026-10-07.md`, section 10 : la page cite Gemini alors que la production passerait par le Gateway ; elle omet Resend, le Gateway, les fournisseurs de modèles et Overleaf ; elle annonce des clauses contractuelles dont le dépôt ne garde aucune trace ; elle dit « effacés dès que tu supprimes ton compte ». **[probable]** Les pièces de facturation doivent être gardées environ dix ans : la phrase « tout est effacé » devient fausse pour un client.
- **Gravité.** Sérieux. Vendre avec une page de confidentialité inexacte ajoute un risque de pratique trompeuse.
- **Ce qui le lèverait.** Réécrire la page (tâche PUBLIC-05 existante) en ajoutant le prestataire de paiement, la conservation des factures, et en retirant ce qui n'est pas prouvé. Ne jamais stocker de numéro de carte : laisser la page de paiement du prestataire le faire.

---

## 3. Produit : si les 8 offres du jour sont mauvaises, l'étudiant part

### 3.1 Le classement n'est prouvé sur rien de solide — A

- **Constat.** La limite de 8 fait reposer toute la valeur du produit sur le classement, vu sur un seul profil, avec des défauts connus.
- **Preuve ou source.** **[fait]** Jugement du 8 octobre, lignes 21 et 35 : « Java 17/21 » du CV ne reconnaît pas « java » d'une offre (0/100). **[fait]** Backlog, ligne 157 : des contrats mal étiquetés (« Alternance » marquée « Stage » ou « Freelance »). **[fait]** Spécification v1.1, section 5 : si le vecteur du profil manque, les recommandations sont vides.
- **Gravité.** Bloquant avant mise en ligne pour les deux derniers ; sérieux pour le reste.
- **Ce qui le lèverait.** Trois protections peu coûteuses : (1) le correctif Java avant la mise en ligne ; (2) ne jamais proposer dans les 8 une offre dont le type de contrat contredit ce que l'étudiant cherche ; (3) si le vecteur manque ou si le calcul échoue, afficher le catalogue normal, jamais une page vide.

### 3.2 La qualité baisse mécaniquement jour après jour — A

- **Constat.** La règle est « les 8 meilleures offres pas encore déverrouillées ». Le premier jour, l'étudiant reçoit les rangs 1 à 8 ; le dixième jour, les rangs 73 à 80. Pour un métier peu représenté, les bonnes offres sont épuisées en quelques jours et la liste se remplit d'offres hors sujet.
- **Preuve ou source.** **[fait]** Spécification v1.1, décision 2. **[fait]** 4 129 offres ouvertes et 645 nouvelles par jour, tous métiers confondus (jugement, ligne 15, d'après la page admin, non recoupé). **[inconnu]** combien concernent un métier et une ville donnés.
- **Gravité.** Bloquant : c'est le défaut le plus probable et le moins visible, car le compte du propriétaire (informatique) est le mieux servi.
- **Ce qui le lèverait.** Un seuil de qualité : en dessous, on n'ajoute pas l'offre. Mieux vaut « Aujourd'hui, 3 offres te correspondent » que 8 offres dont 5 mauvaises. Vérifier sur un profil hors informatique ce que donnent les jours 1, 5 et 10 (calcul en lecture seule, sans rien écrire).

### 3.3 Protections minimales pour l'étudiant — A pour les deux premières, C pour la suite

1. **Sortie de secours toujours visible** : « Explorer tout le catalogue », gratuit. C'est aussi la protection juridique du point 1.4. **[fait]** déjà dans la spécification.
2. **« Pas pour moi » avec remplacement** : l'offre écartée est remplacée par la suivante, dans une limite (par exemple 3 remplacements par jour). **[fait]** le bouton existe (`components/views/offer-panel.tsx:604`), pas le remplacement. Si le catalogue reste libre, il n'y a rien à tricher.
3. **Changer ses métiers** : quand l'étudiant modifie sa cible, il obtient un nouveau lot le jour même. Sinon il reste coincé avec 8 offres de l'ancien profil jusqu'au lendemain.
4. **Voir pourquoi** : une ligne par carte (« 4 compétences en commun : … »). **[fait]** déjà livré en code par BIZ-02, non revu à l'écran.
5. **Retrouver les offres écartées** : aujourd'hui presque introuvables (défaut D3 de `docs/audits/mvp-05-suivi-2026-10-08.md`).

### 3.4 Un message d'erreur clé serait invisible — A

- **Constat.** La spécification prévoit un message quand l'étudiant tente de créer un dossier sur une offre verrouillée. Or les messages s'affichent sous la fiche ouverte : il ne le verra pas.
- **Preuve ou source.** **[fait]** Défaut D1 de l'audit MVP-05 (`app/globals.css:100-101` et `:601`) ; spécification v1.1, section 3 (« toast sur 403 OFFER_LOCKED »).
- **Gravité.** Bloquant : l'étudiant clique, rien ne se passe, il croit le site cassé.
- **Ce qui le lèverait.** Corriger D1 avant la mise en ligne, ou écrire le message dans la fiche elle-même.

### 3.5 On ne saura pas si ça marche — C

- **Constat.** Aucune mesure n'est prévue pour savoir si les 8 offres sont bonnes.
- **Gravité.** Mineur en pilote, sérieux ensuite.
- **Ce qui le lèverait.** Trois compteurs sans IA ni coût : part des offres du jour écartées, part ouvertes, part ayant donné un dossier. Et poser la question de vive voix aux étudiants du pilote.

---

## 4. Technique

### 4.1 Le flou en CSS ne protège rien — A

- **Constat.** Un flou d'affichage laisse le titre, l'entreprise et le lien dans la page : on les lit en dix secondes avec les outils du navigateur. Et aujourd'hui toutes les offres du compte sont envoyées au navigateur.
- **Preuve ou source.** **[fait]** Spécification v1.1, section 3 : `blurred-offers.tsx` utilise `filter: blur`. **[fait]** `components/use-dashboard-data.ts:40` charge toutes les lignes du compte (`select("*")`).
- **Gravité.** Bloquant si le flou cache quelque chose de vendu (variante 1). Sans importance en variante 2, où le flou n'est qu'un décor.
- **Ce qui le lèverait.** Les silhouettes ne contiennent **aucune donnée réelle** : des formes grises dessinées, et au plus un nombre (« 312 autres offres dans le catalogue »). Pas de vrai titre flouté. C'est aussi plus honnête.

### 4.2 Toute limite doit être tenue par le serveur — A pour le dossier, B pour le reste

- **Constat.** Trois verrous existent ou sont prévus ; un seul est solide.
- **Preuve ou source.**
  - **[fait]** Tout compte connecté peut lire la table entière des offres, directement, sans passer par le site : `supabase/migrations/20261003090000_offers_catalogue.sql:42`. Une limite « 8 offres » affichée par l'écran ne limite donc rien. Fermer cet accès est un gros chantier (toutes les lectures du catalogue à refaire). **En variante 2 il n'est pas nécessaire**, puisque le catalogue reste gratuit ; il reste l'écart E4 avec France Travail.
  - **[fait]** Le refus de créer un dossier sur une offre non déverrouillée est prévu côté serveur (`403 OFFER_LOCKED`, spécification, section 2). C'est le bon endroit. À vérifier en production, pas seulement par les tests.
  - **[fait]** Le compteur des 2 dossiers par mois compte des lignes que l'étudiant peut supprimer lui-même : audit sécurité et coûts du 7 octobre, lignes 76-77 ; backlog PUBLIC-06. Si l'on vend « plus de dossiers », ce que l'on vend se contourne gratuitement.
  - **[fait, lu dans l'audit, non testé]** Le passage en « pro » est protégé : un compte ne peut pas se le donner.
- **Gravité.** Sérieux avant d'encaisser pour le compteur de dossiers.
- **Ce qui le lèverait.** Compter les dossiers dans une table que seul le serveur écrit. Petite migration, à tester sur une copie avec le lot REVUE-03.

### 4.3 Un client payant peut être bloqué par le plafond commun, ou coûter plus qu'il ne paie — B

- **Constat.** Un compte « pro » n'a aucune limite mensuelle de dossiers, et tous les comptes partagent un plafond de 2 USD.
- **Preuve ou source.** **[fait]** `lib/plan.ts:7` et `:85`. **[fait]** Registre, priorité 3. **[fait]** Jugement, ligne 64 : « un seul compte Pro de test peut bloquer tous les autres ». **[inconnu]** coût réel d'un dossier : jamais comparé à une facture.
- **Gravité.** Sérieux avant d'encaisser : quelqu'un paie et reçoit « budget épuisé ».
- **Ce qui le lèverait.** Un plafond mensuel de dossiers pour la formule payante (un nombre, pas « illimité »), fixé après le rapprochement avec les factures (BIZ-10). Le relèvement du plafond de 2 USD reste une décision du propriétaire. Prévoir la phrase et le remboursement si le service est indisponible.

### 4.4 Comptes existants et leur liste déjà remplie (737 offres) — A

- **Constat.** La règle écrite est « une offre déverrouillée ne se re-verrouille jamais ». Les comptes actuels ont déjà vu toutes leurs offres. Les flouter du jour au lendemain reprend quelque chose de donné, et casserait le suivi (25 offres « à préparer » et 26 « dossier prêt » sur le compte du propriétaire).
- **Preuve ou source.** **[fait]** Spécification v1.1, décision 2. **[fait]** Compteurs de l'audit MVP-05. **[fait]** Conditions actuelles, section 10 : prévenir avant un changement important. **[inconnu]** : ce que la spécification prévoit pour les offres déjà présentes ; elle n'en parle pas.
- **Gravité.** Bloquant : à décider avant d'écrire la migration.
- **Ce qui le lèverait.** Le plus simple et le plus honnête : toutes les offres déjà dans la liste d'un compte à la date de bascule sont déclarées déverrouillées, regroupées sous « Avant le … » et repliées. Quatre comptes sont concernés (**[fait]** jugement, ligne 16) : un message individuel suffit. Migration testée sur une copie d'abord.
- **Question au backend.** Après la bascule, la recherche d'un compte continue-t-elle d'ajouter des centaines de lignes dans la liste de l'étudiant ? Si oui, elles arrivent dans son navigateur, floutées ou non.

### 4.5 Petits pièges de mise en œuvre — C

- **Deux onglets ou deux clics au même instant** : risque d'obtenir 16 offres au lieu de 8. À tester avec MVP-06a.
- **Plusieurs comptes par personne** : 8 offres et 2 dossiers par adresse e-mail. Acceptable en pilote ; le plafond de 2 USD borne la perte, mais pénalise alors tout le monde.
- **Secours de l'écran** : si la liste des offres déverrouillées ne répond pas, l'écran traite tout comme déverrouillé (spécification, section 2). Correct tant que le serveur refuse le dossier.
- **Mobile** : le suivi n'a pas pu être vérifié à 390 px (audit MVP-05). Le nouvel écran d'accueil non plus.
- **Vérifications à refaire** : REVUE-01 et les essais MVP-03 et MVP-05 portaient sur l'ancienne liste. Les faire directement sur le nouvel écran évite de les faire deux fois.
- **Paiement** : le cas classique « l'argent est pris mais le compte reste gratuit » doit être testé en mode test du prestataire avant le premier vrai paiement (classe B).

---

## 5. Réputation

### 5.1 « Ils font payer des annonces publiques à des étudiants » — A pour les textes

- **Constat.** Le risque d'image est réel et tient en une phrase facile à répéter, surtout avec des offres France Travail, service public gratuit. Le flou sur des annonces est le signe habituel d'un mur payant : l'étudiant le lira ainsi même si le texte dit autre chose.
- **Preuve ou source.** **[opinion]** Aucune étude dans le dépôt ; aucun rapport commercial n'existe. **[fait]** La spécification demandait un message neutre « sans promesse de paiement » (décision 5) : mettre un prix à côté du flou change le sens de l'écran.
- **Gravité.** Sérieux. Bloquant pour les textes d'écran, qui ne coûtent rien à bien écrire.
- **Ce qui le lèverait.**
  1. Ne jamais placer le prix à côté de la zone floutée. Le prix se montre à côté du compteur de dossiers (« 2 sur 2 utilisés ce mois-ci »).
  2. Sous le flou : « 8 nouvelles offres choisies pour toi chaque jour. Tout le catalogue reste ouvert : Explorer. »
  3. Dire pourquoi c'est payant, simplement : « Chaque dossier est écrit par une IA qui nous coûte de l'argent. Deux sont offerts chaque mois. »
  4. Aucune fausse urgence, aucun « exclusif », aucun compte à rebours.
  5. Tenir la promesse des conditions : prévenir avant, rien de facturé sans accord explicite.

### 5.2 Afficher un prix sans pouvoir payer — C, avec une condition

- **Constat.** Tant que l'entreprise et Stripe n'existent pas, un prix affiché ne peut mener à aucun paiement.
- **Gravité.** Acceptable en pilote **si** l'écran dit clairement « pas encore disponible » et propose seulement de laisser son intérêt. C'est aussi le moyen le moins cher de savoir si quelqu'un paierait.
- **À retirer dans tous les cas.** **[fait]** Le « 7,99 € » codé comme prix par défaut (`lib/economics.ts:100`) n'est pas un tarif adopté (backlog PLUS-01).

---

## 6. Hypothèses non prouvées et preuve à faible coût

| Hypothèse | Preuve peu coûteuse |
| --- | --- |
| Un étudiant paierait pour plus de dossiers | Bouton « Ça m'intéresse » sans paiement, compté pendant le pilote |
| 8 offres par jour est le bon nombre | Demander aux étudiants du pilote ; mesurer combien sont ouvertes |
| Le classement donne 8 bonnes offres hors informatique | Trois profils de test, calcul en lecture seule des jours 1, 5 et 10 |
| 2 dossiers gratuits par mois créent l'envie d'en avoir plus | Compter les comptes qui atteignent la limite |
| Un dossier coûte moins que son prix de vente | Rapprochement avec les factures (BIZ-10), toujours pas fait |
| Vendre la rédaction est permis quand le catalogue contient France Travail | Une consultation de juriste (Q8) |
| Adzuna accepte un service payant | Un e-mail (Q1) ; sans réponse, retirer la source |
| Les clés La bonne alternance, Jooble, JSearch ne sont pas en production | Le propriétaire lit la liste des variables dans Vercel (Q18), deux minutes |
| Les offres France Travail ne sont pas l'essentiel du catalogue | Une requête de lecture : offres ouvertes par source |

---

## 7. Classement d'ensemble

**A — Bloquant avant mise en ligne de la limite et du flou**

1. Aucun texte ne vend l'accès aux offres ; le catalogue entier reste consultable gratuitement, avec lien d'origine et mentions (1.1, 1.4, 1.5).
2. Les silhouettes floutées ne contiennent aucune donnée réelle (4.1).
3. Le refus de créer un dossier sur une offre verrouillée est tenu par le serveur et vérifié en production (4.2).
4. Les offres déjà présentes dans les comptes existants restent déverrouillées ; les quatre comptes sont prévenus avant (4.4).
5. Correctif Java, contrats cohérents, seuil de qualité au lieu de remplir à 8, catalogue normal si le calcul échoue (3.1, 3.2).
6. Les messages s'affichent au-dessus de la fiche (3.4).
7. « Pas pour moi » remplace l'offre ; changer ses métiers redonne un lot (3.3).
8. Si un prix est affiché : loin du flou, marqué « pas encore disponible », sans bouton de paiement (5.1, 5.2).

**B — À traiter avant d'encaisser un euro**

1. Avis d'un juriste sur la formule écrite (Q8) ; réponse écrite d'Adzuna ou retrait de la source ; La bonne alternance confirmée éteinte (1.1 à 1.3).
2. Les onze points de la liste 2.2, dont entreprise immatriculée, conditions de vente, rétractation, résiliation en ligne, médiateur.
3. Formule payante réservée aux 18 ans et plus (2.3).
4. Page de confidentialité réécrite, prestataire de paiement compris (2.4).
5. Compteur de dossiers que l'étudiant ne peut pas remettre à zéro (4.2).
6. Plafond de dossiers pour le payant, coût réel d'un dossier connu, décision du propriétaire sur le plafond de 2 USD (4.3).
7. Paiement testé en mode test, y compris l'échec et le remboursement (4.5).
8. Réserves de sécurité PUBLIC-06 et PUBLIC-01 levées ou acceptées par écrit.

**C — Acceptable en pilote fermé**

Plusieurs comptes par personne ; sources Jooble, JSearch et pages carrière tant que rien n'est encaissé ; mobile non vérifié ; absence de mesures fines ; ordre des cartes ; affichage d'un prix « pas encore disponible ».

---

## 8. Questions à poser aux autres agents

**Au commercial**

1. Que vend exactement la formule payante, en une phrase qui ne contient pas le mot « offres » ?
2. Abonnement mensuel ou paquet de dossiers payé une fois ? Lequel un étudiant accepte-t-il, et lequel demande le moins d'obligations ?
3. Chez France Travail, Indeed, LinkedIn et Welcome to the Jungle, les annonces sont gratuites et sans limite. Pourquoi un étudiant accepterait-il 8 par jour ici ? Faut-il présenter la limite comme une sélection (« on a trié pour toi ») ?
4. Quels services d'aide au CV font déjà payer des étudiants en France, à quel prix, et comment le formulent-ils ?
5. Texte exact de l'écran flouté et de l'écran de prix, à faire relire par le juriste.

**À la finance**

1. Coût réel d'un dossier CV + lettre, modifications comprises, d'après les factures et non d'après les prix codés.
2. Combien de dossiers par mois peut-on inclure dans la formule payante sans vendre à perte, frais de paiement et médiateur compris ?
3. Coût fixe annuel de « pouvoir encaisser » : entreprise, médiateur, juriste, cotisations.
4. Part des offres ouvertes par source : que reste-t-il du catalogue sans France Travail, et sans Adzuna ?
5. Si le plafond de 2 USD est atteint avec des clients payants, combien coûte un mois de remboursements ?

**À la valorisation**

1. Un service payant dont la source principale peut être résiliée par le fournisseur vaut-il plus ou moins qu'un service gratuit avec des utilisateurs actifs ?
2. Qu'est-ce qui a le plus de valeur à montrer : dix payants, ou cent étudiants actifs chaque semaine ?
3. Un accord écrit d'Adzuna ou de France Travail est-il un actif à faire figurer ?

---

## 9. Propositions pour le registre

La coordination m'a demandé de ne pas modifier le registre. Je les liste ici pour qu'elle les inscrive au statut `proposée` si elle le juge utile. Fait nouveau par rapport à BIZ-15 et BIZ-16 (en report) : décision du propriétaire du 8 octobre au soir de mettre en œuvre maintenant.

| Proposition | Classe |
| --- | --- |
| Formule payante écrite en « plus de dossiers préparés » ; catalogue entier consultable gratuitement ; limite de 8 identique pour tous | A |
| Silhouettes floutées sans donnée réelle ; prix jamais à côté du flou | A |
| Offres déjà présentes dans les comptes existants déclarées déverrouillées ; message préalable aux quatre comptes | A |
| Seuil de qualité au lieu de remplir à 8 ; remplacement après « Pas pour moi » ; nouveau lot après changement de métiers | A |
| Correction du défaut D1 (messages cachés) avant la mise en ligne | A |
| Liste « avant d'encaisser » de la section 2.2 comme condition de PLUS-01 | B |
| Formule payante réservée aux 18 ans et plus | B |
| Compteur de dossiers écrit par le serveur seul ; plafond de dossiers pour le payant | B |
| Étudier le paquet de dossiers payé une fois au lieu de l'abonnement | B |
| Vérifier dans Vercel les clés de sources posées (Q18) et compter les offres par source | B |

---

## Résumé en cinq lignes pour le propriétaire

1. Tu peux faire la limite de 8, le flou et un prix, à une condition : vendre **plus de dossiers CV + lettre**, pas l'accès aux annonces. La loi interdit de vendre des offres d'emploi, quelle que soit la source ; je ne suis pas juriste, fais relire la formule avant d'encaisser.
2. Tout le catalogue doit rester consultable gratuitement, avec le lien vers l'annonce d'origine et les mentions France Travail et Adzuna. Le flou n'est qu'un décor : il ne doit contenir aucune vraie annonce.
3. Avant de mettre en ligne : garder déverrouillées les offres déjà dans les comptes (tes 737), prévenir les quatre inscrits, corriger le défaut Java et les messages cachés, et ne jamais remplir à 8 avec de mauvaises offres.
4. Avant d'encaisser : entreprise immatriculée, conditions de vente, rétractation de 14 jours, résiliation en ligne, médiateur, 18 ans et plus, page de confidentialité corrigée, réponse d'Adzuna, compteur de dossiers non contournable.
5. Le plus grand risque n'est pas juridique : c'est qu'un étudiant hors informatique reçoive 8 offres hors sujet et parte. Le classement n'a été vu que sur ton profil.
