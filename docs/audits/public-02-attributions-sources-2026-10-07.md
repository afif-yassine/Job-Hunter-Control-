# PUBLIC-02 — Attributions et conditions d'utilisation des sources d'offres

- **Date de consultation des pages officielles : 7 octobre 2026.**
- **État du dépôt lu :** branche `main`, dernier commit `99e15f8f`, plus les changements en cours des autres sessions. `lib/scan/index.ts`, `lib/scan/config.ts` et `lib/scan/types.ts` étaient en cours de modification par une autre session pendant la lecture : leurs numéros de ligne peuvent avoir bougé de quelques lignes.
- **Nature du document :** recherche préparatoire. **Ce n'est pas un avis juridique.** Il rapporte ce qu'écrivent les fournisseurs sur leurs pages publiques, ce que fait le code, et marque ce qui n'a pas pu être confirmé. Les mots « conforme en apparence » veulent dire « le code semble faire ce que la phrase citée demande », rien de plus.
- **Ce qui n'a pas été fait :** aucun compte créé, aucun formulaire envoyé, aucune API appelée avec les clés du projet, aucun fichier existant modifié, aucun logo téléchargé.
- **Dates :** toutes les pages citées ont été lues le 7 octobre 2026. Le rapport a été relu et complété le 8 octobre 2026, sans nouvelle consultation de page.
- **Comment les pages ont été lues :** par requête simple ou dans un navigateur, comme un visiteur sans compte. Le texte de la licence France Travail vient de l'adresse que la page publique appelle elle-même pour s'afficher (`francetravail.io/api-peio/v2/pages/page?slug=…`), sans connexion. Avant de la trouver, trois adresses devinées sur le même site ont répondu 404, et la même adresse pour la fiche de l'API a répondu 403 : je n'ai pas insisté. Les pages qui ont refusé la requête simple (403) ont été soit lues dans le navigateur ordinaire (Adzuna), soit laissées de côté (voir § 7). Aucune protection n'a été contournée, aucune page derrière une connexion n'a été lue.
- **Transparence :** pour lister les noms des variables de sources, une commande a lu `.env.example` (le modèle sans secret) en masquant toutes les valeurs. Aucun fichier `.env` réel n'a été ouvert. Conséquence : je ne sais pas quelles clés sont réellement posées en production, donc je ne peux pas dire quelles sources « optionnelles » tournent vraiment.

---

## 1. Résumé pour le propriétaire

1. **Adzuna.** Les conditions de l'API ne parlent pas de « Jobs by Adzuna ». Elles demandent que **chaque annonce affichée** porte le mot « Adzuna » en **116 × 23 pixels au minimum**, avec un lien vers le site Adzuna du pays. Aujourd'hui LeBonTaf affiche un petit lien texte « Jobs by Adzuna » en bas de la fiche : la taille minimale n'est pas garantie. Le logo officiel règle ce point.
2. **Adzuna, quotas.** Les limites par défaut sont 25 appels/minute, 250/jour, 1 000/semaine, **2 500/mois**. Le code ne surveille que la limite par jour. D'après le code, la collecte du matin fait environ 110 appels par jour, soit environ 3 300 par mois : au-dessus de la limite mensuelle écrite.
3. **France Travail.** La licence est précise et LeBonTaf n'en respecte, en apparence, qu'une partie. Les points les plus sensibles : la licence demande d'afficher **la totalité** du contenu de chaque offre (LeBonTaf montre un résumé), de publier **la méthode de modification** (rien n'existe), et **d'effacer aussi le nom de l'entreprise, le lieu et les liens** quand France Travail retire une offre (LeBonTaf n'efface que le texte).
4. **France Travail et offre payante.** L'article 5.1 de la licence rappelle qu'on ne peut rien faire payer à un chercheur d'emploi pour un service de placement et qu'il est interdit de vendre des offres d'emploi. À faire lire par un juriste **avant** toute formule payante.
5. **Jooble.** Je n'ai trouvé **aucune condition écrite propre à l'API**. Seules existent : une phrase de présentation, la limite de 500 requêtes à vie par clé, et les conditions générales du site. LeBonTaf n'affiche aucune mention pour Jooble. Il faut écrire à Jooble.
6. **La bonne alternance.** Les pages officielles disent « usages non lucratifs » et interdisent l'usage commercial. Je n'ai **pas** trouvé la mention d'un « accord écrit » possible, contrairement à ce que dit l'ancien backlog.
7. **Pages carrière (Greenhouse, Lever…).** Les documentations décrivent des adresses publiques, mais aucune ne donne de règles pour un site tiers qui recopie les offres. L'affirmation du dépôt « prévu pour être lu par les sites d'emploi » n'est pas confirmée par les textes lus.
8. **Pages légales.** Elles citent France Travail, Adzuna et les pages carrière, mais pas Jooble ni JSearch, et la page confidentialité dit que les offres sont « effacées » alors que le code les marque seulement comme fermées.

---

## 2. Sources réellement présentes dans le code

| Source | Comment elle est interrogée | Quand | Fichier |
| --- | --- | --- | --- |
| **France Travail** | API officielle « Offres d'emploi v2 », avec identifiant et secret (jeton OAuth) | Collecte plateforme 2 fois par jour (04:00 et 12:00 UTC) + recherche par compte | `lib/scan/sources/francetravail.ts:6-8`, `lib/scan/harvest.ts:36`, `lib/scan/harvest.ts:121-124` |
| **Adzuna** | API officielle avec `app_id` et `app_key` | Collecte du matin seulement (11 métiers × 2 contrats × 5 villes) + recherche par compte | `lib/scan/sources/adzuna.ts:45-58`, `lib/scan/harvest.ts:80-81`, `lib/scan/harvest.ts:126-131` |
| **Pages carrière** : Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee | Adresses JSON publiques, sans clé | Collecte plateforme (jusqu'à 300 entreprises) + recherche par compte | `lib/scan/sources/ats.ts:229-245`, `lib/scan/harvest.ts:82`, `lib/scan/harvest.ts:125` |
| **Jooble** | API avec clé dans l'adresse | Recherche par compte seulement, si une clé existe | `lib/scan/sources/jooble.ts:60-64`, `lib/scan/index.ts:197-206` |
| **JSearch** (RapidAPI ou OpenWeb Ninja) | API avec clé ; données issues de Google Emplois | Recherche par compte seulement, si une clé existe | `lib/scan/sources/jsearch.ts:71-80`, `lib/scan/index.ts:176-186` |
| **La bonne alternance** | API avec clé | Seulement si `LBA_API_KEY` est posée (connecteur prévu « éteint ») | `lib/scan/sources/lba.ts:10-12`, `lib/scan/index.ts:207-216` |
| **Alertes e-mail Gmail** | Lecture des e-mails d'alerte (LinkedIn, Indeed, Hellowork, APEC, WTTJ) d'une boîte Gmail | Seulement si les variables Gmail sont posées | `lib/scan/sources/gmail.ts:23-49`, `lib/scan/index.ts:217-225` |
| **Scanner externe** | Appel d'une adresse configurée | Seulement si `SCAN_WEBHOOK_URL` est posée | `lib/scan/index.ts:46-62` |
| **Lecture de la page de l'annonce** (toutes sources « à extrait ») | Une requête automatique sur la page publique de l'annonce pour récupérer le texte complet | À l'analyse d'une offre, sauf France Travail et pages carrière | `lib/scan/enrich.ts:51-73`, `lib/pipeline/analyze.ts:159-164` |

Je n'ai pas pu vérifier lesquelles des sources optionnelles (Jooble, JSearch, La bonne alternance, Gmail, scanner externe) ont une clé en production.

### Ce qui est stocké, pour toutes les sources

- **Champs gardés dans le catalogue commun** (table `offers`) : titre, entreprise, lieu, type de contrat, description, source, lien, lien de candidature, date de publication, code ROME, salaire. `lib/scan/catalogue.ts:79-95`.
- **Longueur du texte** : coupé à 8 000 caractères pour Adzuna, Jooble, JSearch, pages carrière (`lib/scan/text.ts:29-32`). France Travail : texte complet de l'API, non coupé (`lib/scan/sources/francetravail.ts:42`).
- **Durée** : une offre non revue depuis 21 jours passe à « expirée » (`lib/scan/catalogue.ts:25`, `supabase/migrations/20261003090000_offers_catalogue.sql:152-173`). **Elle n'est pas supprimée** : je n'ai trouvé aucune suppression de ligne de `offers` dans les migrations lues. Seul le texte des offres France Travail retirées est effacé (voir § 3.2).
- **Cache des recherches** (table `source_cache`) : réutilisé pendant 12 h (`lib/scan/health.ts:147-150`), mais la ligne reste en base jusqu'à la prochaine recherche identique ; aucune purge trouvée (`supabase/migrations/20260928090000_source_health_admin.sql:68-76`).
- **Visibilité** : tout compte connecté peut lire toute la table `offers` (`supabase/migrations/20261003090000_offers_catalogue.sql:42`).
- **Usage par l'IA** : chaque offre ouverte est envoyée une fois à un modèle d'IA qui écrit un résumé (missions, outils, conditions, compétences) à partir de 6 000 caractères du texte (`lib/offer-reader.ts:28-39`, `lib/offer-reader.ts:94-104`). Un vecteur (embedding) est calculé à partir du titre, du lieu et de 1 800 caractères du texte (`lib/embeddings.ts:78-86`, `lib/scan/harvest.ts:205-221`). Résumé et vecteur restent en base. Je n'ai trouvé aucun entraînement de modèle dans le code.
- **Lien vers l'annonce** : bouton « Voir l'annonce » qui ouvre le lien de candidature ou, à défaut, le lien de la source (`components/views/offer-panel.tsx:111`, `components/views/offer-panel.tsx:533-536`).
- **Ce que voit l'étudiant** : le résumé de l'IA (`components/views/offer-panel.tsx:322-338`). Le texte complet de l'offre n'est pas affiché dans la fiche (il sert seulement de condition aux lignes 124, 148 et 283).
- **Mentions affichées** : uniquement France Travail et Adzuna, en bas de la fiche (`components/views/offer-panel.tsx:583-607`), plus l'accueil public (`components/jinnjob/landing-sections.tsx:373-378` et `:469`). Aucune mention pour Jooble, JSearch, La bonne alternance (hors offres France Travail relayées) ou les plateformes de pages carrière.

---

## 3. Tableaux par source

Légende du statut : **Conforme en apparence** · **Écart** · **Non confirmé**.

### 3.1 Adzuna

Pages lues : [Terms of Service de l'API](https://developer.adzuna.com/docs/terms_of_service) (aucune date ni version ; pied de page « © 2026 ADZUNA LTD »), [documentation de la recherche](https://developer.adzuna.com/docs/search), [page presse et logos](https://www.adzuna.co.uk/press.html), [conditions générales du site](https://www.adzuna.co.uk/terms-and-conditions.html) (recherche par mots-clés seulement, pas de lecture intégrale).

| Exigence | Ce que dit la source | Ce que fait LeBonTaf | Statut |
| --- | --- | --- | --- |
| Mention sur chaque annonce | « An API user shall label each displayed advert with the phrase "Adzuna" at least 116 X 23 pixels in size, wherein the word "Adzuna" shall be hyperlinked to http://www.adzuna.co.uk or the relevant local domain » — [ToS](https://developer.adzuna.com/docs/terms_of_service) | Lien texte « Jobs by Adzuna » vers `https://www.adzuna.fr`, en petit et en gris, en bas de la fiche détaillée : `components/views/offer-panel.tsx:590`, `:600-603` | **Écart** : la taille minimale n'est pas garantie par un petit texte. Le lien vers le domaine local est correct. |
| Mention sur les listes d'offres | Même phrase : « each displayed advert » | La mention n'existe que dans la fiche détaillée (`offer-panel.tsx:529`). Aucune mention trouvée sur les cartes de liste. | **Non confirmé** : la phrase ne dit pas si une carte de liste compte comme une annonce affichée. |
| Texte « Jobs by Adzuna » | Ce texte **n'apparaît pas** dans les conditions lues. Seul le mot « Adzuna » est demandé. | « Jobs by Adzuna » : `offer-panel.tsx:602`, `landing-sections.tsx:376`, `:469` | **Conforme en apparence** (le texte contient le mot « Adzuna » avec le lien). L'origine de la formule « Jobs by Adzuna » n'est pas retrouvée. |
| Logo | « Adzuna Logo images can be found at: http://www.adzuna.co.uk/press.html » — [ToS](https://developer.adzuna.com/docs/terms_of_service). Le texte indique où trouver le logo ; il n'écrit pas mot pour mot qu'un logo est obligatoire. | Aucun fichier de logo Adzuna dans `public/` | **Non confirmé** pour « logo obligatoire » (affirmation de l'ancien backlog). Le logo reste le moyen le plus simple de tenir les 116 × 23 px. |
| Usages permis | « The Adzuna API may be used for: Publishing Adzuna ad listings / Publishing Jobsworth salary estimates / Personal research » | Publication d'annonces dans un catalogue, plus résumé par IA, classement, score, embeddings | **Non confirmé** : la publication est permise ; le reste n'est pas décrit. |
| Autre usage commercial | « Any other use of the Adzuna API by a commercial, government or academic organisation […] is permitted subject to a 14 day trial period », puis « It may not be used in its original format or in aggregation […] without written consent. After the trial period ends, a licence agreement may be required. » | Service public, formule payante envisagée (backlog PLUS-01) | **Non confirmé** : à demander à Adzuna par écrit. |
| Limites d'appels | « 25 hits per minute / 250 hits per day / 1000 hits per week / 2500 hits per month » | Seul un budget **par jour** de 240 est appliqué : `lib/scan/health.ts:62-64`. Pas de compteur par minute, par semaine ni par mois. Collecte du matin : 11 × 2 × 5 = 110 appels (`lib/scan/harvest.ts:80-81`, `:126-131`), soit environ 3 300 par mois (calcul d'après le code, consommation réelle non vérifiée). | **Écart** sur la limite mensuelle ; **non confirmé** pour la limite par minute (appels enchaînés avec 120 ms de pause, `adzuna.ts:67`). |
| Hausse des limites | « If you wish to publish Adzuna ad listings and need to request increased rate limits then please contact us » | Aucune demande connue dans le dépôt | **Non confirmé** |
| Conservation / cache | Rien d'écrit, sauf à la fin du contrat : « an API user shall immediately remove all insertion codes and data acquired from Adzuna from all pages of its web sites » | Titre, extrait, entreprise, lieu, lien gardés sans date de suppression (voir § 2). Aucune procédure de purge par source trouvée. | **Non confirmé** |
| Texte complet | « Please note we currently only provide a snipped of the job description in the response. » — [doc recherche](https://developer.adzuna.com/docs/search) | L'extrait est stocké (`adzuna.ts:29-31`), puis l'analyse lit automatiquement la page de l'annonce pour obtenir le texte complet et le stocke : `lib/pipeline/analyze.ts:159-164`, `lib/scan/enrich.ts:51-73`. Le lien Adzuna pointe vers le site Adzuna. | **Non confirmé** : cette lecture automatique n'est prévue nulle part dans les conditions de l'API. À noter : adzuna.fr et adzuna.co.uk ont répondu 403 à mes requêtes automatiques. |
| Modification des annonces | Rien dans les conditions de l'API. Les conditions « Partner » du site disent : « The Partner shall not materially alter the Content […] » — [conditions générales](https://www.adzuna.co.uk/terms-and-conditions.html) | Résumé par IA affiché à la place du texte | **Non confirmé** : je ne sais pas si les conditions « Partner » s'appliquent à un utilisateur gratuit de l'API. |
| Lien vers l'annonce | Le champ `redirect_url` est fourni, avec des paramètres de suivi (`utm_medium=api&utm_source=…`) dans l'exemple de la doc | `redirect_url` sert de lien (`adzuna.ts:31`). Dans le catalogue commun, les paramètres `utm_…` sont retirés avant stockage : `lib/scan/ingest.ts:9-20`, `lib/scan/catalogue.ts:87` | **Non confirmé** : aucune phrase n'oblige à garder ces paramètres, mais Adzuna parle de « mutual commercial benefit » et ne peut plus reconnaître les clics venus de LeBonTaf. |
| Salaires estimés | Mention spéciale « Adzuna Jobsworth » pour toute estimation publiée | Les salaires estimés sont écartés : `adzuna.ts:33-34` | **Conforme en apparence** |
| Contact avec les annonceurs | « Any attempt to contact a third party, even where they provide listings content, will be considered a breach » | Rien dans le code ne contacte les annonceurs | **Conforme en apparence** |
| Plusieurs comptes | « Creation of multiple accounts for a single entity or individual will immediately be considered misuse » | Les réglages invitent chaque utilisateur à créer son propre compte Adzuna : `lib/providers.ts:53-67` | **Non confirmé** : à garder en tête, une seule clé pour la plateforme. |
| IA, embeddings | Rien dans les conditions de l'API | Résumé et embeddings (voir § 2) | **Non confirmé** |

### 3.2 France Travail

Page lue : [Licence de réutilisation de la base de données des offres d'emploi](https://francetravail.io/produits-partages/documentation/conditions-dutilisation-api/licence-offres-emploi) (texte intégral lu ; **aucune date ni numéro de version affichés**) et [Conditions d'utilisation des API](https://francetravail.io/produits-partages/documentation/conditions-dutilisation-api).

| Exigence | Ce que dit la source | Ce que fait LeBonTaf | Statut |
| --- | --- | --- | --- |
| Mentions obligatoires (art. 4) | « mentionner : la source du Contenu (France Travail) et la date de sa dernière mise à jour ; le fait que la réutilisation […] est soumise à la présente Licence, ainsi qu'un lien hypertexte » | « Source : France Travail · publiée le … · licence de réutilisation » avec lien : `components/views/offer-panel.tsx:591-597`, `:30`. Pied de l'accueil : `landing-sections.tsx:469` | **Conforme en apparence** pour la source et le lien. **Non confirmé** pour la date : c'est la date de création qui est affichée (`francetravail.ts:45`), pas une date de dernière mise à jour. |
| Mentions faciles à trouver (art. 4) | « Ces mentions doivent être aisément accessibles par les Utilisateurs. » | En bas de la fiche, en petit et en gris ; absentes des listes | **Non confirmé** |
| Fichier ou méthode des modifications (art. 4) | « Un fichier détaillant l'ensemble des modifications apportées à la Base de données ou la méthode appliquée pour apporter ces modifications (par exemple un algorithme) est également mis à la disposition des Utilisateurs » | Rien trouvé. LeBonTaf résume par IA, classe par métier, regroupe les doublons. | **Écart** |
| Totalité du contenu (art. 5.3) | « le Réutilisateur est tenu de faire figurer sur chaque offre d'emploi la totalité du Contenu mis à disposition dans l'API pour cette offre d'emploi. Cette obligation s'applique également au logo figurant sur l'offre d'emploi. » | Seuls une dizaine de champs sont gardés (`francetravail.ts:30-48`) ; le logo, le contact, l'expérience demandée, etc. ne sont pas repris. L'étudiant voit le résumé de l'IA, pas le texte complet (`offer-panel.tsx:322-338`). | **Écart** |
| Ne pas dénaturer (art. 1.1) | « ne pas altérer le Contenu de la Base de données ou d'en dénaturer le sens » | Résumé écrit par une IA | **Non confirmé** |
| Mise à jour toutes les 24 h (art. 5.2) | « le Réutilisateur sollicite l'API au minimum une fois toutes les 24 heures : le Contenu créé, supprimé ou modifié de la Base de données est respectivement créé, supprimé ou modifié de la Création » | Collecte prévue à 04:00 et 12:00 UTC (`lib/scan/harvest.ts:36`). Mais `vercel.json:5-8` ne planifie que `/api/cron/tick` ; la collecte dépend d'un déclencheur Supabase décrit dans `docs/SCANNER.md:162-166`, non visible dans le dépôt. | **Non confirmé** : le rythme réel en production n'est pas vérifiable d'ici. |
| Suppression des offres retirées (art. 5.2) | Même phrase : le contenu supprimé doit être supprimé | Fermeture seulement quand **toutes** les recherches France Travail de la collecte ont réussi (`harvest.ts:372-381`), et seulement pour les métiers et contrats de la collecte (`supabase/migrations/20261004180000_close_offer_ft_anonymize.sql:28-31`). Les offres France Travail arrivées par une recherche de compte hors de ce périmètre n'expirent qu'après 21 jours. | **Écart** partiel |
| Offres modifiées (art. 5.2) | Même phrase : le contenu modifié doit être modifié | Le texte n'est remplacé que s'il est plus long ; le titre et l'entreprise ne sont pas mis à jour : `supabase/migrations/20261003090000_offers_catalogue.sql:126-138` | **Écart** |
| Date de l'offre (art. 5.2) | « conserve la date de première publication ou, le cas échéant, de mise à jour indiquée sur chaque offre » | Date de création gardée et affichée | **Conforme en apparence** |
| Anonymisation après retrait (art. 7) | Conserver une offre retirée n'est permis qu'en supprimant notamment : « nom, description et URL de l'entreprise », « URL de l'offre chez l'entreprise », « URL de modalité de contact », « code postal, code INSEE et libellé de la commune du lieu de travail » | À la fermeture, seul le **texte** est effacé, dans le catalogue et chez les comptes qui n'ont pas postulé : `…close_offer_ft_anonymize.sql:26-41`. Le nom de l'entreprise, le lieu, le lien et le lien de candidature restent. Le résumé de l'IA et le vecteur restent aussi. Le texte reste chez les comptes qui ont postulé. L'expiration à 21 jours n'efface rien. | **Écart** partiel |
| Pas de mise à disposition à des tiers (art. 3) | « Il prend toute mesure technique et/ou contractuelle afin que les Utilisateurs ne puissent extraire et/ou exploiter le Contenu » | Tout compte connecté peut lire la table entière : `…offers_catalogue.sql:42`. Aucune clause trouvée dans les pages légales. | **Écart** |
| Gratuité pour le chercheur d'emploi (art. 5.1) | « aucune rétribution, directe ou indirecte, ne peut être exigée des personnes à la recherche d'un emploi en contrepartie de la fourniture de services de placement » ; « il est interdit […] de vendre des offres d'emploi » | Offre gratuite aujourd'hui ; formule payante envisagée (`docs/PRODUCT-BACKLOG.md:162`) | **Non confirmé** : à faire lire par un juriste avant tout paiement. |
| Données personnelles (art. 8) | « traiter et stocker les données sur le territoire de l'Union européenne ou dans un pays assurant un niveau de sécurité équivalent » ; les traitements « à des fins commerciales » sont cités comme incompatibles | Les champs de contact ne sont pas stockés (`francetravail.ts:30-48`), mais le texte libre peut en contenir. Il est envoyé à des fournisseurs d'IA et l'hébergement Vercel est aux États-Unis (`app/confidentialite/page.tsx:90`, `:104`). | **Non confirmé** |
| Logos (art. 9) | « Il n'est pas autorisé à les exploiter sans accord exprès. » | Aucun logo France Travail utilisé | **Conforme en apparence**. Ne pas ajouter le logo France Travail sans accord. |
| Base dérivée (art. 6) | « Toute mise à disposition d'une Base de données dérivée est soumise aux conditions de la présente Licence » | Résumés, catégories, embeddings calculés sur les offres | **Non confirmé** : la licence ne parle ni d'IA ni d'embeddings. |
| Lien vers l'annonce | L'introduction dit que le candidat est « redirigé vers le site www.francetravail.fr ou vers le site du partenaire » quand il n'y a pas de contact | Lien vers la fiche sur francetravail.fr, et lien de candidature fourni par l'API : `francetravail.ts:32`, `:43-44` | **Conforme en apparence** |
| Limites d'appels | Page du catalogue de l'API **non consultée** (elle demande une connexion) | Le code suppose 10 appels par seconde : `francetravail.ts:83`, `harvest.ts:296` | **Non confirmé** |
| Durée et contrôle (art. 10 et 13) | Résiliation de plein droit après 12 mois sans appel ; France Travail peut faire un audit | — | Pour information |

### 3.3 Jooble

Pages lues : [présentation de l'API](https://jooble.org/api/about), [documentation REST](https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation) (modifiée le 16 août 2026), [conditions générales en français](https://fr.jooble.org/info/terms) (« Date d'entrée en vigueur : 3 août 2026 ») et [en anglais](https://jooble.org/info/terms) (« Effective Date: January 8, 2019 » ; la version française dit que l'anglais prévaut). La page `fr.jooble.org/api/about` a répondu 403.

**Aucune condition d'utilisation propre à l'API n'a été trouvée.** Les conditions générales ne contiennent pas le mot « API ».

| Exigence | Ce que dit la source | Ce que fait LeBonTaf | Statut |
| --- | --- | --- | --- |
| Usage prévu | « Our REST API allows you to take search queries from Jooble and post the results on your website in your own design. » — [API](https://jooble.org/api/about) | Résultats stockés dans le catalogue commun, résumés par IA, montrés à tous les comptes | **Non confirmé** |
| Mention / logo | Rien trouvé | Aucune mention Jooble : `components/views/offer-panel.tsx:583-587` ne traite que France Travail et Adzuna | **Non confirmé** |
| Quota | « The free REST API plan includes a total lifetime limit of 500 requests per key » — [doc REST](https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation) | Budget total de 450 : `lib/scan/health.ts:66-67` | **Conforme en apparence** |
| Clé par pays | « Each Jooble domain (country) requires its own unique REST API key. » | Essai de `fr.jooble.org` puis `jooble.org` : `lib/scan/sources/jooble.ts:41-44` | **Conforme en apparence** |
| Republication | Conditions générales, 4 i) : « Le contenu de notre Site ne peut être copié pour être republié, en ligne ou sur papier, sans notre autorisation écrite expresse préalable. » | Extrait Jooble stocké et affiché (`jooble.ts:27`) | **Non confirmé** : je ne sais pas si cette règle du site vaut pour les données reçues par l'API. |
| Robots | Conditions générales, 4 m) : pas de « robots d'indexation, bots […] ou tout autre processus automatique pour accéder à, acquérir, copier ou surveiller toute partie du Site » | Le lien fourni pointe vers une page Jooble (« Direct URL to the job posting on Jooble »). L'analyse lit automatiquement cette page pour compléter le texte : `lib/pipeline/analyze.ts:159-164` | **Écart** probable sur cette lecture automatique |
| Liens | Conditions générales, 9 d) : un lien vers le site est permis s'il est fait « de manière équitable » | Lien direct vers l'annonce Jooble | **Conforme en apparence** |
| Conservation, usage commercial, IA | Rien trouvé | Voir § 2 | **Non confirmé** |

### 3.4 JSearch (RapidAPI ou OpenWeb Ninja)

Pages lues : [conditions d'OpenWeb Ninja](https://www.openwebninja.com/terms) (« Last updated Sep 14, 2026 », recherche par mots-clés) et [page produit JSearch](https://www.openwebninja.com/api/jsearch). **Les conditions de RapidAPI n'ont pas pu être lues** (la page s'affiche vide). Le code essaie RapidAPI puis OpenWeb Ninja (`lib/scan/sources/jsearch.ts:71-80`) ; je ne sais pas lequel sert en production.

| Exigence | Ce que dit la source | Ce que fait LeBonTaf | Statut |
| --- | --- | --- | --- |
| Usage commercial (OpenWeb Ninja) | Licence pour « use, reproduce, and commercially exploit such API Data in your own products […] provided that you do not resell, sublicense, or redistribute API Data as a standalone data or API product » | Offres intégrées à un produit plus large | **Conforme en apparence**, pour une clé OpenWeb Ninja seulement |
| Usage commercial (RapidAPI) | Page non lue | — | **Non confirmé** |
| Mention | Rien trouvé par mots-clés dans les conditions d'OpenWeb Ninja | Aucune mention JSearch ni du site d'origine | **Non confirmé** |
| Origine des offres | « Real-Time Job Postings […] from LinkedIn, Indeed, Glassdoor, ZipRecruiter, and All Public Job Sites via Google for Jobs » — [page produit](https://www.openwebninja.com/api/jsearch) | Texte complet stocké jusqu'à 8 000 caractères : `jsearch.ts:50` | **Non confirmé** : les conditions du revendeur ne disent rien des droits des sites d'origine. Le dépôt écrit lui-même que ces sites interdisent les robots (`lib/admin/catalog.ts:157`). |
| Quota | Dépend de la formule ; non lu | 3 requêtes par recherche, budget 180 par mois : `jsearch.ts:127-128`, `health.ts:60-61` | **Non confirmé** |
| Conservation, IA | Rien trouvé | Voir § 2 | **Non confirmé** |

### 3.5 La bonne alternance

Pages lues : [fiche de l'API « Recherche d'opportunités d'emploi en alternance »](https://api.apprentissage.beta.gouv.fr/fr/explorer/recherche-offre) et [CGU](https://api.apprentissage.beta.gouv.fr/fr/cgu) (« Dernière mise à jour le : 31 mars 2025 - v1.0 »).

| Exigence | Ce que dit la source | Ce que fait LeBonTaf | Statut |
| --- | --- | --- | --- |
| Usage non lucratif | « L'utilisation de cette API est gratuite et réservée à des usages non lucratifs. Notez que toute utilisation de ces données à des fins commerciales, telles que la revente ou la facturation de l'accès pour des tiers comme des candidats est interdite. » | Connecteur présent, actif seulement si `LBA_API_KEY` est posée : `lib/scan/index.ts:207-216` | **Non confirmé** (présence de la clé en production non vérifiée) |
| Accord écrit possible | **Non trouvé** dans les deux pages lues | Le dépôt affirme qu'un accord écrit permettrait l'usage commercial : `lib/scan/sources/lba.ts:10-12`, `docs/SCANNER.md:176` | **Non confirmé** : cette affirmation n'a pas de source retrouvée. |
| Communication à des tiers | CGU 5.2 : « Il s'engage à ne pas commercialiser les données reçues et à ne pas les communiquer à des tiers en dehors des cas prévus par la loi. » | Les offres iraient dans le catalogue commun | **Non confirmé** |
| Jeton | CGU 5.2 : « Toute divulgation du jeton quelle que soit sa forme, est interdite. » | Clé côté serveur | **Conforme en apparence** |

### 3.6 Pages carrière (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee)

Pages lues : [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html), [Lever Postings API](https://github.com/lever/postings-api), [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api), [SmartRecruiters Posting API](https://developers.smartrecruiters.com/docs/posting-api), [Workable](https://workable.readme.io/reference/jobs), [Recruitee](https://docs.recruitee.com/reference/offers). Ce sont des documentations techniques, pas des conditions d'utilisation : je n'ai pas lu les conditions générales de ces six éditeurs.

| Exigence | Ce que dit la source | Ce que fait LeBonTaf | Statut |
| --- | --- | --- | --- |
| Accès public | Greenhouse : « Job Board data is publicly available, so authentication is not required for any GET endpoints. » Lever : « all job postings in the published state are publicly viewable. These jobs may be scraped by third parties. » | Lecture sans clé : `lib/scan/sources/ats.ts:229-245` | **Conforme en apparence** pour l'accès technique |
| Usage par un site tiers | Les documentations s'adressent à l'entreprise cliente (Greenhouse : « you can build careers pages »). Aucune ne donne de règles pour un agrégateur. | Le dépôt affirme « meant to be read by job boards. Reading it is legitimate » : `ats.ts:6-10`, `docs/SCANNER.md:73-74` | **Non confirmé** : affirmation sans source retrouvée. |
| Adresse Workable | L'adresse utilisée (`apply.workable.com/api/v1/widget/accounts/…`) n'apparaît pas dans la page de documentation lue | `ats.ts:240-241` | **Non confirmé** |
| SmartRecruiters | « The Public Posting API supports both API Key and OAuth 2.0 Client Credentials authentication. » | Appel sans clé : `ats.ts:238-239` | **Non confirmé** |
| Mention, conservation, IA | Rien trouvé | Texte complet stocké jusqu'à 8 000 caractères ; nom de l'entreprise affiché ; lien vers la page de l'entreprise ; offres retirées fermées (`harvest.ts:306`) | **Non confirmé** |
| Identification du robot | Rien trouvé | Le robot se présente comme « JobHunterControl/1.0 (personal job assistant) » : `ats.ts:279`, `lib/scan/enrich.ts:59` | **Écart** mineur de transparence : ce n'est plus un assistant personnel, et aucun contact n'est indiqué. |

### 3.7 Alertes Gmail, scanner externe et lecture des pages d'annonce

Aucune page officielle consultée pour LinkedIn, Indeed, Hellowork, APEC ou Welcome to the Jungle.

| Point | Ce que fait LeBonTaf | Statut |
| --- | --- | --- |
| Alertes e-mail | Les offres extraites des e-mails d'alerte d'une boîte Gmail rejoignent le catalogue **commun** comme les autres : `lib/scan/index.ts:217-225` puis `:376-379` | **Non confirmé** : conditions de ces plateformes non lues. |
| Lecture automatique des pages | Une requête par offre, abandon devant un CAPTCHA ou une page de connexion (`lib/scan/enrich.ts:4-11`). Aucune lecture de `robots.txt` trouvée dans le code. | **Non confirmé** |

### 3.8 Pages légales de LeBonTaf

| Texte affiché | Constat | Statut |
| --- | --- | --- |
| « Les offres affichées proviennent de sources publiques (France Travail, Adzuna, pages carrières des entreprises). » — `app/mentions-legales/page.tsx:52` | Jooble, JSearch, les alertes Gmail et La bonne alternance existent dans le code et ne sont pas citées. Exact seulement si ces sources n'ont aucune clé en production. | **Non confirmé** |
| Même phrase, « Les offres d'emploi viennent de France Travail, d'Adzuna et des pages carrières » — `app/confidentialite/page.tsx:110` | Idem | **Non confirmé** |
| « elles sont fermées puis effacées quand l'annonce disparaît » — `app/confidentialite/page.tsx:118` | Aucune suppression de ligne d'offre trouvée dans les migrations lues ; seules les offres France Travail retirées perdent leur texte. | **Écart** entre le texte et le code |
| « les résume et renvoie toujours vers l'annonce d'origine » — `app/mentions-legales/page.tsx:53` | Correspond au code | **Conforme en apparence** |

---

## 4. Écarts classés par gravité

Le classement suit un seul critère : ce qui est écrit noir sur blanc par la source et que le code ne fait pas, d'abord.

### Élevée

| N° | Écart | Pour qui |
| --- | --- | --- |
| E1 | France Travail art. 5.3 : la totalité du contenu de l'offre (et son logo) doit figurer sur chaque offre ; LeBonTaf affiche un résumé et ne garde qu'une partie des champs. | Front + backend ; décision du propriétaire |
| E2 | France Travail art. 7 : après retrait d'une offre, le nom de l'entreprise, le lieu et les liens restent en base ; seul le texte est effacé. Le résumé de l'IA reste aussi. | Backend |
| E3 | France Travail art. 4 : aucun fichier ni page décrivant les modifications apportées (résumé par IA, classement, dédoublonnage). | Front + backend |
| E4 | France Travail art. 3 : tout compte connecté peut lire la table entière des offres. | Backend |
| E5 | Adzuna : la mention ne garantit pas 116 × 23 px sur chaque annonce affichée. | Front |
| E6 | Adzuna : limite de 2 500 appels par mois non surveillée ; la collecte prévue la dépasse d'après le code (environ 3 300). Limites par minute et par semaine non surveillées non plus. | Backend |

### Moyenne

| N° | Écart | Pour qui |
| --- | --- | --- |
| E7 | France Travail art. 5.2 : les offres retirées hors du périmètre de la collecte attendent 21 jours ; les offres modifiées ne sont pas mises à jour. | Backend |
| E8 | Jooble : lecture automatique de la page Jooble de l'annonce, alors que les conditions du site interdisent les processus automatiques. | Backend |
| E9 | Page confidentialité : « effacées quand l'annonce disparaît » ne correspond pas au code. | Front (texte) + backend ; coordinateur |
| E10 | Pages légales et accueil : la liste des sources ne cite pas Jooble ni JSearch. À corriger ou à confirmer selon les clés réellement posées. | Coordinateur + front |

### Faible

| N° | Écart | Pour qui |
| --- | --- | --- |
| E11 | Le robot se présente comme « personal job assistant », sans contact. | Backend |
| E12 | France Travail art. 4 : la date affichée est la date de publication, pas une date de dernière mise à jour. | Backend + front |
| E13 | Adzuna : les paramètres de suivi du lien sont retirés dans le catalogue commun. | Backend |
| E14 | Trois affirmations du dépôt sans source retrouvée : « logo exigé par les conditions » d'Adzuna, « accord écrit » pour La bonne alternance, pages carrière « prévues pour être lues par les sites d'emploi ». | Coordinateur (documentation) |

---

## 5. Points non confirmés et question à poser

| N° | Point | À qui | Question précise |
| --- | --- | --- | --- |
| Q1 | Adzuna : usage au-delà de la simple publication | Adzuna (formulaire de contact cité dans les conditions ; résiliation : info [at] adzuna [dot] com) | « Nous affichons vos annonces dans un catalogue pour étudiants, avec la mention Adzuna et un lien vers votre annonce. Pouvons-nous aussi : garder l'extrait en base et pendant combien de temps ; le faire résumer par une IA ; calculer des embeddings ; le faire dans un service qui pourrait devenir payant ? Faut-il un accord de licence ? » |
| Q2 | Adzuna : quotas | Adzuna | « Notre collecte demande environ 110 appels par jour. Pouvez-vous relever la limite mensuelle de 2 500 ? » |
| Q3 | Adzuna : forme de la mention | Adzuna | « La mention doit-elle figurer sur chaque carte d'une liste ou seulement sur la fiche détaillée ? Le texte "Jobs by Adzuna" convient-il ? Le logo est-il obligatoire ? Existe-t-il une charte d'usage du logo (fond sombre, marge, couleurs) et un fichier SVG ou PNG ? » |
| Q4 | Adzuna : lecture de la page de l'annonce | Adzuna | « Pouvons-nous lire automatiquement la page vers laquelle pointe redirect_url pour obtenir le texte complet ? » |
| Q5 | Adzuna : conditions « Partner » | Adzuna | « Les "Partner terms" de vos conditions générales s'appliquent-elles à un utilisateur gratuit de l'API ? » |
| Q6 | France Travail : résumé par IA et totalité du contenu | France Travail (francetravail.io, « Nous contacter ») et juriste | « Un service qui affiche un résumé automatique de l'offre, avec un lien vers l'offre complète sur francetravail.fr, respecte-t-il l'article 5.3 ? Sinon, que faut-il afficher exactement, logo compris ? » |
| Q7 | France Travail : embeddings et résumés conservés | France Travail et juriste | « Un résumé et un vecteur calculés à partir d'une offre sont-ils une "Base de données dérivée" ? Doivent-ils être supprimés quand l'offre est retirée (article 7) ? » |
| Q8 | France Travail : offre payante | Juriste | « L'article 5.1 de la licence et les articles L. 5321-3 et L. 5331-1 du code du travail permettent-ils de faire payer un étudiant pour des fonctions autour des offres (CV, lettres, suivi) quand le catalogue contient des offres France Travail ? » |
| Q9 | France Travail : données envoyées hors Union européenne | Juriste | « L'envoi du texte des offres à des fournisseurs d'IA et l'hébergement aux États-Unis sont-ils compatibles avec l'article 8 ? » |
| Q10 | France Travail : quotas et version de la licence | France Travail | « Quelle est la limite d'appels de l'API Offres d'emploi v2 et quelle est la date de la version en vigueur de la licence ? » |
| Q11 | France Travail : rythme réel de la collecte | Coordinateur / backend | « La collecte tourne-t-elle bien au moins une fois par 24 h en production (déclencheur Supabase) ? » |
| Q12 | Jooble : conditions de l'API | Jooble (compliance@jooble.com, cité dans leurs conditions) | « Quelles sont les conditions écrites de l'API REST : mention ou logo à afficher, droit de garder les résultats en base et durée, droit de les résumer par IA et de calculer des embeddings, usage dans un service public ou payant, lecture automatique de la page de l'annonce ? » |
| Q13 | JSearch : quel fournisseur | Coordinateur / propriétaire | « La clé JSearch vient-elle de RapidAPI ou d'OpenWeb Ninja, et est-elle posée en production ? » |
| Q14 | JSearch : droits sur le texte des annonces | Fournisseur JSearch et juriste | « Votre licence couvre-t-elle l'affichage et la conservation du texte complet d'annonces venant de LinkedIn, Indeed, etc. ? Une mention est-elle demandée ? » |
| Q15 | La bonne alternance | Équipe La bonne alternance (espace développeurs) | « Un service gratuit pour l'étudiant, édité par une entreprise, est-il un "usage non lucratif" ? Existe-t-il un accord possible pour un autre usage ? Montrer les offres à nos utilisateurs est-il une "communication à des tiers" ? » |
| Q16 | Pages carrière | Juriste | « Peut-on recopier, conserver et résumer des offres lues sur les adresses publiques de Greenhouse, Lever, Ashby, SmartRecruiters, Workable et Recruitee sans accord de l'entreprise ni de l'éditeur ? » |
| Q17 | Alertes Gmail | Juriste / propriétaire | « Peut-on verser dans un catalogue commun des offres extraites des e-mails d'alerte reçus par une seule personne ? » |
| Q18 | Sources actives | Coordinateur | « Quelles clés sont posées en production : Jooble, JSearch, La bonne alternance, Gmail, scanner externe ? » |

---

## 6. Ce qu'il faut pour « ajouter le logo officiel Adzuna »

**Ce qui est écrit par Adzuna** ([Terms of Service](https://developer.adzuna.com/docs/terms_of_service)) :

- le mot « Adzuna » sur **chaque annonce affichée** ;
- taille **116 × 23 pixels au minimum** ;
- un **lien** sur ce mot vers `http://www.adzuna.co.uk` ou le domaine local — pour LeBonTaf, `https://www.adzuna.fr`, déjà utilisé ;
- les logos se trouvent sur la [page presse](https://www.adzuna.co.uk/press.html).

**Fichiers officiels vus sur la page presse, section « Adzuna brand assets »** (non téléchargés) :

| Version | Formats proposés | Adresse |
| --- | --- | --- |
| Logo horizontal | JPG (342 Ko, 300 dpi), AI, PDF, EPS | `https://zunastatic-abf.kxcdn.com/assets/images/press/adzuna_logo/adzuna_logo.jpg` (et `.ai`, `.pdf`, `.eps`) |
| Logo empilé | JPG (398 Ko, 300 dpi), AI, PDF, EPS | `https://zunastatic-abf.kxcdn.com/assets/images/press/adzuna_logo/adzuna_logo_stacked.jpg` (et `.ai`, `.pdf`, `.eps`) |

La page presse ne propose **ni SVG ni PNG** au téléchargement. Elle affiche un aperçu PNG de 220 × 80 px, et le site Adzuna utilise son propre SVG dans son en-tête, mais ni l'un ni l'autre n'est présenté comme fichier à réutiliser.

**Ce qui n'est pas écrit** (à ne pas inventer) : aucune charte d'usage du logo trouvée — rien sur les couleurs, la marge autour, le fond sombre, ni sur le droit de le recolorer. Voir la question Q3.

**Pour le front, concrètement :**

1. Le propriétaire télécharge le logo horizontal depuis la page presse (un agent ne télécharge pas de fichier sans son accord) et le dépose dans `public/`.
2. L'afficher dans `SourceCredits` (`components/views/offer-panel.tsx:600-603`) à **au moins 116 px de large et 23 px de haut**, sans le déformer ni le recolorer, avec `alt="Adzuna"`, dans le lien existant vers `https://www.adzuna.fr`.
3. Garder le texte « Jobs by Adzuna » à côté, comme demandé par le backlog : rien dans les conditions ne l'interdit, rien ne l'exige.
4. Vérifier le rendu en thème sombre : le JPG a un fond ; sans charte, mieux vaut un petit cartouche clair qu'un logo modifié.
5. Emplacement : la fiche détaillée est le minimum. Les cartes de liste restent à décider après la réponse à Q3.
6. Ne **pas** ajouter de logo France Travail (article 9 de sa licence : pas d'usage sans accord exprès).

---

## 7. Pages non consultées ou incomplètes

| Page | Raison |
| --- | --- |
| `https://francetravail.io/produits-partages/catalogue/offres-emploi` (fiche de l'API, quotas) | Redirige vers une page de connexion. Non consultée. |
| `https://rapidapi.com/terms/` | La page s'affiche vide dans le navigateur et par requête directe. Non lue. |
| `https://fr.jooble.org/api/about` | Réponse 403. La version `jooble.org/api/about` a été lue. |
| `https://www.adzuna.fr/terms-and-conditions.html` | Réponse 403 par requête directe. La version britannique a été lue dans le navigateur, **par recherche de mots-clés seulement**. |
| Conditions générales de Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee | Non recherchées : seules les documentations techniques ont été lues. |
| Conditions de LinkedIn, Indeed, Hellowork, APEC, Welcome to the Jungle | Non recherchées. |
| Conditions d'OpenWeb Ninja | Lues par recherche de mots-clés, pas intégralement. |

Aucun blog ni forum n'a servi de source.
