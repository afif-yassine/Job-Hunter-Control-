---
name: "LeBonTaf — accueil, identité candidate"
description: "Une ouverture de chapitre pour les premiers pas professionnels ; système observé sur l’accueil uniquement."
colors:
  brand-bordeaux: "#7b2d26"
  brand-peach-dark: "#e0ac91"
  chapter-bordeaux: "#5a211d"
  cover-bordeaux: "#702a23"
  accent-gold: "#d9b86a"
  ground-parchment: "#f3ecdc"
  ink-brown: "#2d241e"
  muted-brown: "#695747"
  line-parchment: "#d4c6af"
  paper-ivory: "#fffcf4"
  wash-parchment: "#e9dfc6"
  button-ivory: "#fff6e5"
  ground-dark: "#201915"
  muted-dark: "#c0b19b"
  line-dark: "#534537"
  paper-dark: "#302620"
  wash-dark: "#382c23"
  button-ink-dark: "#271711"
typography:
  display:
    fontFamily: "IM Fell English, Georgia, serif"
    fontSize: "clamp(58px, 6.35vw, 90px)"
    fontWeight: 400
    lineHeight: 0.99
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "IM Fell English, Georgia, serif"
    fontSize: "clamp(38px, 4.4vw, 62px)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  offer-title:
    fontFamily: "Instrument Sans, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  step-title:
    fontFamily: "Instrument Sans, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    letterSpacing: "-0.03em"
  lead:
    fontFamily: "Instrument Sans, sans-serif"
    fontSize: "17px"
    lineHeight: 1.75
  body:
    fontFamily: "Instrument Sans, sans-serif"
    fontSize: "14px"
    lineHeight: 1.8
  button:
    fontFamily: "Instrument Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  navigation:
    fontFamily: "Instrument Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  tag:
    fontFamily: "Instrument Sans, sans-serif"
    fontSize: "10px"
rounded:
  tag: "4px"
  control: "8px"
  card: "12px"
  scene: "16px"
  switch: "30px"
  circle: "50%"
spacing:
  tight: "6px"
  icon-small: "8px"
  item: "12px"
  inset: "16px"
  section-small: "24px"
  copy: "30px"
  layout: "64px"
components:
  button-primary:
    backgroundColor: "{colors.brand-bordeaux}"
    textColor: "{colors.button-ivory}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "14px 23px"
  button-primary-dark:
    backgroundColor: "{colors.brand-peach-dark}"
    textColor: "{colors.button-ink-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "14px 23px"
  button-final:
    backgroundColor: "{colors.accent-gold}"
    textColor: "{colors.ink-brown}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "14px 23px"
  theme-button:
    textColor: "{colors.ink-brown}"
    rounded: "{rounded.circle}"
    width: "44px"
    height: "44px"
  skill-tag:
    textColor: "{colors.ink-brown}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "4px 9px"
  offer-card:
    backgroundColor: "{colors.paper-ivory}"
    textColor: "{colors.ink-brown}"
    rounded: "{rounded.card}"
    padding: "23px 25px 0"
  demo-scene:
    backgroundColor: "{colors.wash-parchment}"
    textColor: "{colors.ink-brown}"
    rounded: "{rounded.scene}"
    padding: "25px 28px 18px"
---

# Design System: LeBonTaf — accueil, identité candidate

## Overview

**Creative North Star: "Un nouveau chapitre"**

Identité candidate « Un nouveau chapitre », appliquée uniquement à l’accueil public LeBonTaf. Le propriétaire apprécie le symbole Le Déclic et demande les couleurs chaudes de l’ancien site, une ouverture de livre et davantage d’animation. Cette implémentation reste une proposition à évaluer avant toute extension à la connexion, à l’espace étudiant ou aux autres écrans.

Le parchemin, l’encre brune, le bordeaux et l’or donnent une matière de livre ancien à une interface de recherche professionnelle. Le serif raconte le départ ; le sans rend les offres, les actions et les explications immédiatement lisibles. L’animation ouvre le chapitre puis laisse une longue place au repos.

**Key Characteristics:**

- Palette chaude en clair et brun encre en sombre ; clair par défaut.
- Le Déclic : deux rubans complémentaires reliés en diagonale.
- Titres IM Fell English, contenu et commandes Instrument Sans.
- Surfaces tonales, traits fins et ombres diffuses sur les objets de papier.
- Mouvements CSS/SVG, introduction passable et réduction des animations respectée.

Photographie de l’implémentation au 5 octobre 2026, dérivée de `components/jinnjob/landing.tsx`, `components/jinnjob/landing.module.css` et `app/fonts.ts`, avec le contexte de `PRODUCT.md` et `docs/HOME-DESIGN-BRIEF.md`. Les valeurs du frontmatter sont normatives pour cette surface ; les noms descriptifs documentent les valeurs locales existantes, sans créer une bibliothèque globale de tokens.

L’accueil est rendu sur `/` pour les visiteurs non connectés lorsque Supabase est disponible. Les comptes connectés conservent leur tableau de bord sur `/`. L’alias `/accueil` présente cette même page publique, y compris aux comptes connectés, avec une URL canonique `/`. Le repli sans client Supabase sur `/` reste le tableau de bord.

Revue finale transmise : **ship**, aucun constat matériel restant. Captures de référence existantes : `test-results/homepage/light-1440.png`, `dark-1440.png`, `light-390.png`, `dark-390.png`, `light-320.png`, `opening-start.png` et `opening-turn.png`. Cette disposition de revue ne vaut ni approbation définitive de la marque ni validation de tous les parcours authentifiés.

## Colors

Palette de papier ancien, bordeaux et or ; les variantes sombres conservent cette chaleur sans inversion mécanique des illustrations.

### Primary

- **Bordeaux de marque** (`brand-bordeaux`) : symbole, accent du titre, actions principales et sceau de CV en clair.
- **Pêche de marque sombre** (`brand-peach-dark`) : remplace le bordeaux sur les mêmes éléments en thème sombre.
- **Bordeaux de chapitre** (`chapter-bordeaux`) : fond du bandeau final, commun aux deux thèmes. Le nom CSS historique `--forest` désigne aujourd’hui cette couleur bordeaux.
- **Bordeaux de couverture** (`cover-bordeaux`) : volet gauche de l’ouverture ; le droit utilise le bordeaux de marque.

### Secondary

- **Or** (`accent-gold`) : symbole d’ouverture, repères du profil et du rapprochement, sélection de texte, action finale et focus sur le bandeau final. Il reste identique dans les deux thèmes.

### Neutral

| Propriété locale | Clair | Sombre | Rôle |
| --- | --- | --- | --- |
| `--ground` | `ground-parchment` | `ground-dark` | Fond de page |
| `--ink` | `ink-brown` | `ground-parchment` | Texte principal et sélection d’offre |
| `--muted` | `muted-brown` | `muted-dark` | Texte secondaire |
| `--line` | `line-parchment` | `line-dark` | Séparateurs et contours |
| `--paper` | `paper-ivory` | `paper-dark` | Offre, profil et CV |
| `--wash` | `wash-parchment` | `wash-dark` | Scène de démonstration et section CV |
| `--button-ink` | `button-ivory` | `button-ink-dark` | Texte sur la couleur de marque |

Le thème est limité au conteneur de l’accueil par `data-theme`. Le clair est le défaut serveur ; le choix sombre est lu depuis le cookie `lbt-home-theme`, mémorisé pendant un an. Le rendu initial et l’état client partagent la même valeur.

**The Home Scope Rule.** Ces règles décrivent la proposition de l’accueil. Leur présence à la racine du dépôt n’autorise pas leur généralisation aux autres écrans.

## Typography

**Display Font:** IM Fell English, via `--font-fell`, avec Georgia et serif dans le module. Les fontes locales déclarent aussi Iowan Old Style en repli.
**Body Font:** Instrument Sans, via `--font-sans`, avec sans-serif dans le module ; le chargeur local prévoit Helvetica Neue et Arial.

Les fichiers WOFF2 locaux utilisent `display: swap`. IM Fell English est chargé en romain et italique de graisse 400 ; Instrument Sans en 400, 500, 600 et 700. IM Fell English SC et Courier Prime existent dans les variables partagées, mais aucun rôle de l’accueil ne les utilise : ils ne font pas partie de ce système candidat.

Le grand titre associe trois lignes de serif, une dernière ligne italique bordeaux et un trait SVG dessiné. Les titres de section reprennent le serif ; le titre d’offre et les étapes gardent le sans. La marque combine « lebon » en sans et « taf » en serif italique, suivi du point.

### Hierarchy

Les tailles de référence sont dans le frontmatter. Le display descend à `clamp(54px, 6.5vw, 76px)` jusqu’à 1100 px, puis `clamp(49px, 10.8vw, 78px)` jusqu’à 760 px et 47 px jusqu’à 370 px. Son interligne mobile passe à 1.01. Les titres de section passent à 43 px puis 38 px. Le titre final a son propre accent d’échelle, `clamp(44px, 5.6vw, 78px)`, puis 52 px sur mobile, avec le repli des titres à 38 px au plus petit seuil.

Le texte d’introduction est limité à 490 px en grand format et passe à 15 px sur les écrans intermédiaires et mobiles. Les paragraphes d’explication tournent autour de 14–16 px et d’un interligne 1.8. Les réponses FAQ sont limitées à 60ch. Les petites mentions d’illustration, de statut et de pied de page sont distinctes des titres.

**The Story and Action Rule.** Le serif donne le ton aux grands titres et aux accents ; les informations d’offre, les étapes et les commandes restent en sans.

## Layout

Le conteneur mesure au maximum 1280 px, avec 56 px de marge latérale initiale, 32 px à 1100 px et moins, 20 px à 760 px et moins, puis 16 px à 370 px et moins. Ces seuils sont ceux du CSS ; il n’existe pas de grille globale importée pour cette page.

Le premier écran utilise deux colonnes de proportions 1.1fr / 1fr et un intervalle de 64 px ; celui-ci devient 100 px à partir de 1500 px, et 34 px jusqu’à 1100 px. La navigation mesure au minimum 100 px de haut, puis 82 px sur mobile. À 760 px, la page devient une colonne, la scène de démonstration est limitée à 480 px et les liens de navigation centraux disparaissent. À 1100 px, le second de ces liens disparaît déjà.

Le rythme repose sur de petits écarts de 6–16 px pour les groupes et icônes, de 24–30 px pour les blocs de texte et d’action, et de grandes respirations de 54–105 px entre sections. Les trois étapes deviennent des lignes numérotées sur mobile. Le CV conserve une largeur maximale de 400 px et sa légère rotation. Les pieds de page et actions se replient sans imposer une largeur fixe.

## Elevation & Depth

Les aplats distinguent la page, la scène et les feuilles. Des ombres brunes translucides donnent une profondeur localisée, sans transformer chaque section en carte flottante.

### Shadow Vocabulary

- **Offre** : `0 12px 34px #41261910`.
- **CV** : `0 18px 45px #41261914`.
- **Sceau** : `0 10px 24px #41261920`.
- **Intérieur de couverture** : `inset 0 0 75px #36100e45`.

La couverture utilise une perspective CSS de 1600 px ; la scène arrive avec une perspective de 1000 px. Le CV repose à −3° et le sceau à +3°.

**The Paper Depth Rule.** Les ombres douces appartiennent aux objets de démonstration et au sceau ; la structure de la page repose sur les surfaces et les séparateurs.

## Shapes

Les coins ont une fonction : tags à 4 px, actions et sceau à 8 px, offre et profil à 12 px, scène à 16 px. Les commandes de type d’offre ont une courbure de 30 px ; le bouton de thème et les repères de profil sont circulaires. Le CV garde sa forme de feuille rectangulaire. Les traits séparateurs sont fins, généralement d’un pixel.

Le Déclic est un SVG de 64 × 64 unités, composé de deux rubans remplis et d’une liaison diagonale de huit unités d’épaisseur. Il hérite de sa couleur avec `currentColor`. Le même dessin circule entre navigation, démonstration, document, ouverture et fin de page, sans nouvel emblème concurrent.

## Components

### Buttons and links

L’action principale utilise la couleur de marque, un arrondi de contrôle, le padding du frontmatter et une hauteur minimale de 56 px. Son intervalle icône/texte est de 28 px. Sur mobile, elle passe à 54 px minimum, 14 px de texte et 20 px de padding horizontal ; l’action du héros descend à 14 px de padding jusqu’à 370 px. L’action finale utilise l’or avec l’encre brune dans les deux thèmes.

En environnement avec survol, l’action principale monte de 3 px avec une transition de 180 ms ease-out. Les liens secondaires restent soulignés et ont une hauteur minimale de 44 px ; leur flèche avance de 3 px au survol. Le bouton de thème mesure 44 × 44 px et possède un nom accessible correspondant à l’action suivante.

Le focus clavier est un contour de 3 px d’encre avec un décalage de 5 px ; sur le bandeau bordeaux final, le contour utilise l’or. Le lien « Aller au contenu » devient visible au focus.

### Offer switch and paper objects

Les boutons « Une alternance » et « Un stage » sont regroupés, portent `aria-pressed` et mesurent au minimum 44 px de haut. L’état sélectionné utilise l’encre sur le fond de page inversé ; le repos reste transparent avec un contour. Les données changent localement dans une zone `aria-live="polite"`, sans recherche serveur ni génération IA.

La scène associe une offre, un lien graphique et un profil, avec les mentions explicites de données fictives. Les tags de compétences sont de simples étiquettes bordées. Le CV et son sceau illustrent la préparation d’un document ; les lignes du futur suivi sont non interactives et marquées comme un aperçu à venir.

### Navigation and FAQ

La marque ramène à `/accueil`, les actions d’entrée à `/login`, et les liens de contenu visent les ancres `#comment` et `#questions`. Les liens légaux restent présents au pied de page. La FAQ utilise des éléments natifs `details` / `summary`, avec un chevron qui tourne de 180° en 180 ms.

### Le Déclic and chapter opening

L’ouverture montre deux volets bordeaux, un grand Déclic doré et « Un nouveau chapitre. Le tien. ». Elle est fixe et décorative, avec `pointer-events: none` ; son bouton de passage reste interactif. Elle n’enferme pas le focus et ne bloque pas les interactions du contenu.

Les volets commencent après 700 ms et pivotent de ±110° pendant 1150 ms. Le titre disparaît à partir de 750 ms pendant 600 ms. Le calque devient invisible à 2100 ms puis est retiré par le timer à 2200 ms. Le cookie de session `lbt-home-intro` évite la répétition automatique ; « Revoir le premier chapitre » recrée l’ouverture. Les deux cookies utilisent `SameSite=Lax`, le chemin racine et `Secure` sur HTTPS.

Le héros se révèle ligne par ligne sur 850 ms, avec des décalages de 0 / 100 / 220 ms et une entrée décalée de 1100 ms lorsque l’ouverture initiale est présente. Le soulignement se dessine sur une seconde. La scène arrive sur 1100 ms ; sa carte se pose sur 900 ms. Le changement d’exemple anime aussi son contenu sur 380 ms. Les marques de navigation, de pied de page et de tête de démonstration ont une impulsion de sept secondes, immobile pendant les premiers 77 % du cycle.

Un IntersectionObserver au seuil de 0.12 révèle chaque section une fois : étapes sur 700 ms avec des décalages de 120 ms ; CV sur 950 ms ; sceau sur 650 ms avec un retard de 250 ms ; lignes de suivi sur 700 ms avec des décalages de 100 ms ; marque finale sur une seconde. La courbe expressive principale est `cubic-bezier(0.16, 1, 0.3, 1)`.

Avec `prefers-reduced-motion: reduce`, l’ouverture et son bouton de répétition sont masqués, toutes les animations et transitions du module sont supprimées et les contenus restent visibles. Le CV conserve uniquement sa rotation statique. Sans IntersectionObserver, aucun masquage de contenu au défilement n’est activé. L’ensemble repose sur CSS, SVG et un observateur léger, sans vidéo, image matricielle lourde ou moteur 3D.

## Do's and Don'ts

### Do:

- Do conserver l’association du parchemin, du bordeaux et de l’or, avec les substitutions prévues pour le thème sombre.
- Do garder Le Déclic reconnaissable dans ses deux rubans et sa liaison diagonale.
- Do utiliser les titres serif pour le récit et le sans pour les actions et les informations pratiques.
- Do garder l’introduction passable, les contenus utilisables et le mode de réduction des animations immédiat.
- Do préserver les repères de focus et la version mobile jusqu’à 320 px.

### Don't:

- Don't traiter cette documentation comme une approbation de l’identité pour toute la plateforme.
- Don't transformer la métaphore du livre en bibliothèque qui masque les offres et la candidature.
- Don't ajouter de vidéo, de moteur 3D ou d’images lourdes pour reproduire les effets actuels.
- Don't présenter les exemples fictifs ou le futur suivi comme des résultats ou des fonctionnalités déjà validés.
- Don't promouvoir les petites mentions décoratives en capitales en nouveau style de titre ou de surtitre.

**Non canonisé :** la petite signature en capitales de l’ouverture et les légendes très petites de la démonstration restent des détails locaux observés ; elles ne deviennent pas un modèle de surtitre ou une taille de lecture générale. Aucune réparation de source n’appartient à ce passage documentaire. Aucun autre défaut matériel n’a été transmis par la revue finale.
