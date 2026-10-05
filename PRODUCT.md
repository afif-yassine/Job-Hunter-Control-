# LeBonTaf — contexte produit

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Les étudiants qui cherchent un stage ou une alternance en France constituent le public principal confirmé par le propriétaire du produit.

## Product Purpose

Aider l’étudiant à trouver des offres adaptées à son profil, préparer son CV et sa lettre avec l’IA, puis suivre ses candidatures. Le visiteur doit comprendre cette utilité dès son arrivée.

## Operating Context

Le parcours existant comprend un compte, l’import du CV, un catalogue d’offres, leur classement selon le profil et la préparation de documents adaptés. La recherche et la préparation se font dans une application web utilisable sur ordinateur et mobile.

## Capabilities and Constraints

- Le dépôt contient une application Next.js / React avec Supabase, des traitements serveur et un worker. La refonte visuelle conserve cette architecture.
- L’import, le classement et la génération de documents existent dans le code ; cela ne vaut pas validation de tous les parcours authentifiés en production.
- Le suivi complet, les rappels, les notes et l’extension figurent encore dans le backlog. Leur présence dans une maquette ne signifie pas qu’ils fonctionnent.
- Le fonctionnement actuel prépare les candidatures : aucune promesse d’envoi automatique ne doit être ajoutée par la refonte.
- Le backlog historique inclut aussi les CDD et des catégories de métiers ciblées. Le nouveau discours privilégie stages et alternances, sans modifier implicitement les contrats ni les métiers collectés.

## Brand Commitments

- Nom actuel : LeBonTaf. JinnJob et Job Hunter sont des noms historiques présents dans certains fichiers.
- Demande du propriétaire : une identité premium, reconnaissable, un logo et des animations attractives mais mesurées.
- Le propriétaire apprécie le caractère des polices actuelles, mais trouve l’univers trop proche d’une bibliothèque.
- Après inspection du premier accueil proposé, il confirme aimer le nouveau logo et demande une animation plus expressive, les couleurs chaudes de l’ancien site et une ouverture rappelant un nouveau chapitre de vie. Cette métaphore d’entrée est appréciée ; la finalité professionnelle doit rester explicite.
- Thèmes clair et sombre, avec clair par défaut : confirmé le 5 octobre 2026.
- Le 5 octobre, le propriétaire demande de construire et déployer l’accueil seul pour juger une première proposition d’identité et de logo animé. L’extension aux autres écrans attend son retour. Une version implémentée ne constitue pas une approbation de la marque définitive.

## Evidence on Hand

- Implémentation actuelle : `components/jinnjob/`, `components/dashboard.tsx`, `app/fonts.ts`, `app/jinnjob.css` et `app/globals.css`.
- Vérification datée : `docs/VERIFICATION-2026-10-04.md`.
- Backlog actif et décisions de refonte : `docs/PRODUCT-BACKLOG.md`.
- Backlog historique du 3 octobre : `docs/archive/PRODUCT-BACKLOG-2026-10-03.txt`, conservé sans changement. Ses cases sont des déclarations historiques, pas un audit actuel.
- Aucun témoignage, taux de réussite ni chiffre commercial n’est validé pour la refonte.

## Product Principles

1. Dire clairement à qui le produit s’adresse et ce qu’il permet de faire.
2. Montrer les offres, les documents et les étapes concrètes de candidature.
3. Distinguer une fonction disponible d’une fonction prévue.
4. Garder les décisions et les documents dans le dépôt pour faciliter la reprise par Codex ou Cowork.

## Accessibility & Inclusion

Prévoir une navigation au clavier, des contrastes lisibles, des interfaces tactiles et le respect de la préférence de réduction des animations.
