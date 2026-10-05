# Vérification LeBonTaf — 4 octobre 2026

## Résultats confirmés

- Copie locale propre avant cet audit, branche `main`.
- GitHub `main` et copie locale : même commit `1badf98a67a9cd06528398e51f87eac05f353c2f`.
- CI GitHub du commit : terminée avec succès. Installation, typage, lint, tests et build ont tous réussi.
- Preuve CI : https://github.com/afif-yassine/Job-Hunter-Control-/actions/runs/37229906800 (job 111517213845).
- Statut Vercel du commit : succès.
- https://lebontaf.com : accueil, `/login`, `/confidentialite`, `/mentions-legales`, `/conditions` répondent HTTP 200 et portent le nom LeBonTaf.
- En-têtes CSP et HSTS présents sur ces pages. Cela ne constitue pas un audit de sécurité complet.
- `/api/account` sans connexion répond HTTP 401.
- Accueil et connexion inspectés dans le navigateur. Connexion inspectée en format mobile : nom dans la couverture lisible. Aucun débordement horizontal mesuré sur accueil et connexion avec un viewport demandé de 390 pixels (largeur utile observée : 375 pixels).

## Backlog à actualiser

- Renommage LeBonTaf : livré et visible en production.
- Accueil et connexion au nouveau design : livrés.
- Pages légales : présentes en production ; leur existence ne valide pas leur conformité juridique.
- Google et lien de connexion par e-mail : interface et routes présentes ; connexion réelle non testée.
- Export et suppression du compte : implémentation présente ; parcours réel et cascades de suppression non testés.
- Import CV, embeddings, résumé partagé, génération PDF/LaTeX : code présent et CI verte ; scénario complet avec compte réel non testé.
- Suivi des candidatures : interface actuelle partielle. Le registre complet est encore annoncé « Bientôt » dans `components/views/applications-view.tsx` et `lib/roadmap.ts`.
- Rappels, notes de dossier, corbeille de 30 jours, recherches enregistrées et leurs alertes : livraison non confirmée ; aucune implémentation identifiée dans les fichiers examinés.
- Envoi automatique : absent. `lib/config.ts` autorise uniquement `PREPARE_ONLY`.

## Écarts et points non vérifiés

- L'accueil promet un suivi comprenant les entretiens, alors que le registre complet reste à construire.
- `vercel.json` contient un cron quotidien pour `/api/cron/tick`. La collecte annoncée deux fois par jour et son avancement toutes les dix minutes dépendent des réglages externes Supabase, non vérifiés ici.
- Le contact du code reste l'adresse Gmail ; `contact@lebontaf.com` et le service SMTP du domaine ne sont pas confirmés.
- Réglages Supabase (migrations appliquées, RLS effective, quotas, OAuth, SMTP), Google Cloud, DNS et worker Railway non inspectés.
- Tests locaux non relancés : dépendances absentes. Résultats vérifiés directement dans la CI du commit exact.
- Maquette HTML et conversation Cowork traitées comme références, pas comme preuve de livraison ni instructions d'exécution.

Cet audit n'a modifié aucun code applicatif et n'a lancé aucun déploiement.
