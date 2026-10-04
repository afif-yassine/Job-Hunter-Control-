# Accueil LeBonTaf — vérification du 5 octobre 2026

## Périmètre

Accueil public à `/` pour les visiteurs non connectés et à `/accueil` pour tous. Connexion, tableau de bord et fonctions métier conservent leur implémentation. La version retenue pour publication suit le retour utilisateur sur l’aperçu local : logo conservé, animation plus expressive, ouverture en deux volets, palette parchemin/bordeaux/or et sombre brun encre.

## Contrôles locaux effectués

- `npm run lint` : réussi. Contrôle ciblé supplémentaire après révision des animations : réussi.
- `npm test` : 125 tests, 124 réussis, 1 ignoré, aucun échec.
- `npm run build` : réussi, compilation et TypeScript inclus, après la révision visuelle finale.
- `node tools/verify-homepage.mjs` : Chrome, largeurs 1440, 1024, 768, 390 et 320 px. Aucun débordement des éléments du contenu et aucune erreur JavaScript/console relevée.
- Vérifications interactives : clair par défaut malgré un système sombre, changement de thème et persistance au rechargement, exemples stage/alternance, FAQ, cibles des ancrages et des appels à l’action.
- Introduction : disparition automatique, absence de répétition au cours de la session, bouton pour revoir et bouton pour passer. Préférence de réduction des animations respectée.
- Captures clair/sombre examinées sur ordinateur et mobile ; deux captures supplémentaires confirment l’assemblage du logo et l’ouverture des volets.
- Contrastes calculés sur les principales paires de couleurs : de 5,18:1 pour le texte secondaire clair sur la surface chaude à 12,90:1 pour le texte principal clair. Cela ne constitue pas un audit complet de conformité.
- Revue indépendante Impeccable de la direction révisée : `ship`, aucun correctif matériel demandé. Évaluation contre le brief et les captures, sans maquette approuvée de référence.

## Performance et limites

L’ouverture est une animation CSS/SVG d’environ 2,1 secondes, passable et jouée une fois par session. Les logos ont un cycle de sept secondes majoritairement immobile. Les apparitions de sections utilisent un observateur d’intersection, sans boucle JavaScript de défilement. Aucun moteur 3D, vidéo ou fichier d’image lourd n’est ajouté.

Ces choix limitent le travail ajouté au navigateur ; aucun score Lighthouse ni mesure de Core Web Vitals en conditions réelles n’est revendiqué. Les parcours métier authentifiés ne font pas partie de cette refonte d’accueil.

## Publication

La publication GitHub/Vercel et la vérification de production sont suivies séparément dans le backlog. Ce rapport décrit les vérifications locales réalisées avant l’envoi du code.
