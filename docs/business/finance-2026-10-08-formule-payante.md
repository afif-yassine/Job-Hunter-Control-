# Finance — formule payante, limite de 8 offres et plafonds (8 octobre 2026)

Auteur : agent « Finance & analytique ». Uniquement les chiffres. Aucun code, backlog ni registre modifié.

**À lire d'abord.**

- **Tout chiffre de coût ci-dessous est une estimation.** Les prix des modèles sont écrits dans le code (`lib/economics.ts:12-26`) et n'ont pas été comparés aux factures (BIZ-10 non fait). Seul MVP-02 est vérifié en production.
- Trois niveaux de preuve : **mesuré** (relevé une fois dans un document du dépôt), **calculé** (jetons × prix codés), **supposé** (hypothèse sans donnée).
- Fait nouveau par rapport au registre : le 8 octobre au soir, le propriétaire a décidé de mettre en œuvre la limite de 8 offres par jour, le floutage et une tarification. BIZ-15 et BIZ-16 étaient « proposées en report ». Ce rapport chiffre ; il ne lève aucune condition juridique (voir section 7).
- Taux de change : 1 € = 1,15 USD (**supposé**, valeur fixe de `lib/economics.ts:111-113`).
- Données connues : 4 inscrits, 0 payant, 0,40 USD d'IA affichés depuis le 1er octobre (mesuré ou estimé, non distingué), plafond de la clé 2 USD sans renouvellement (`docs/INTEGRATION-IA-2026-10-06.md:10`).

## Résumé en cinq lignes

1. Un abonné coûte peu en IA : environ 0,04 € par mois en usage normal, 0,94 € au pire avec des plafonds mensuels (estimations). Le prix de vente n'est donc pas limité par l'IA.
2. Ce qui coûte, ce sont les frais fixes qui apparaissent dès qu'on vend : Vercel Pro 20 USD par mois est obligatoire (le plan Hobby interdit l'usage commercial), puis Supabase Pro 25 USD.
3. Recommandation : **7,99 € par mois, ou 34,99 € le semestre**, avec 30 dossiers, 90 modifications et 600 analyses par mois.
4. Seuil de rentabilité estimé : **4 abonnés** avec Vercel Pro seul, **9 abonnés** avec Vercel Pro et Supabase Pro (TVA comprise dans le prix ; 3 et 7 sans TVA).
5. Le plafond de 2 USD ne permet pas de vendre : la lecture du catalogue en consomme environ 1 USD par mois à elle seule, et un seul abonné au maximum peut en consommer 1,08 USD.

## 1. Coût variable par action et par étudiant

### 1.1 Prix utilisés (codés, non vérifiés)

| Modèle | Rôle | Entrée USD / M jetons | Sortie USD / M jetons | Source |
| --- | --- | --- | --- | --- |
| GPT-6 Luna | rédaction : dossier, modification, import du CV | 0,10 | 0,50 | `lib/economics.ts:19` |
| Qwen 3.7 Flash | lecture du catalogue, analyse détaillée | 0,03 | 0,13 | `lib/economics.ts:25` |
| Perplexity embedding 0.6B | vecteurs | 0,004 | 0 | `lib/economics.ts:21` |

Écart déjà visible : le seul dossier mesuré (3 402 jetons lus, 1 313 écrits) a été déclaré à 0,001082 USD par le Gateway, alors que jetons × prix codés donne 0,000997 USD. Le coût déclaré est donc environ **9 % au-dessus** du calcul. Je garde la valeur déclarée comme valeur basse.

### 1.2 Bornes observables dans le code

- Sortie limitée à 2 400 jetons en rédaction et 1 600 ailleurs (`lib/ai.ts:119`).
- Entrée limitée à 80 000 octets (`lib/ai.ts:110`), soit environ 27 000 jetons au pire (**supposé** : 3 octets par jeton).
- Import du CV : 30 000 caractères au plus (`lib/cv-pdf.ts`, cité par l'audit du 7 octobre), envoyé au modèle de rédaction (`app/api/profile/import/route.ts:41-42`).
- Les valeurs de `TASK_TOKENS` (`lib/economics.ts:51-62`) annoncent 5 000 jetons de sortie pour un dossier : impossible avec la limite de 2 400. La page admin surestime donc le dossier.

### 1.3 Coût par action (USD, estimations)

| Action | Bas | Haut | Hypothèse du bas | Hypothèse du haut |
| --- | --- | --- | --- | --- |
| Dossier CV + lettre | 0,0011 | 0,0039 | **Mesuré** une fois : 0,001082 (`docs/INTEGRATION-IA-2026-10-06.md:9`) | **Calculé** : 27 000 lus + 2 400 écrits |
| Modification d'un document | 0,0011 | 0,0039 | **Supposé** égal à un dossier ; l'audit du 7 octobre dit « environ 0,002 » | Même plafond que le dossier |
| Analyse détaillée d'une offre | 0,00014 | 0,0010 | **Calculé** : 2 000 lus + 600 écrits (`TASK_TOKENS.score`) | **Calculé** : 27 000 lus + 1 600 écrits |
| Import du CV | 0,0019 | 0,0039 | **Calculé** : 6 000 lus + 2 500 écrits (`TASK_TOKENS.cvImport`) | Même plafond que le dossier |
| Classement gratuit (score par compétences) | 0 | 0 | Pas d'appel IA par étudiant | — |
| Vecteur du profil | 0,00001 | 0,00001 | **Calculé**, négligeable | — |
| Lecture d'une offre du catalogue (plateforme) | 0,00005 | 0,00005 | **Mesuré** : 52 offres pour 0,002591 USD (`docs/INTEGRATION-IA-2026-10-06.md:24`) | — |
| Vecteur d'une offre (plateforme) | 0,0000016 | 0,0000016 | **Mesuré** : 3 890 offres pour 0,006257 USD (même document, ligne 7) | — |

Ces coûts ne comptent pas les appels ratés ou coupés, qui peuvent être facturés sans trace (audit du 8 octobre, section 1.3).

### 1.4 Coût par étudiant gratuit et par mois (USD, estimations)

Limites actuelles : 2 dossiers par mois (`lib/plan.ts:12`), 20 analyses, 10 rédactions et 15 modifications par jour (`lib/quota.ts:12`).

| Profil | Coût / mois | Hypothèse |
| --- | --- | --- |
| Inscrit inactif | 0 | Aucun appel |
| Gratuit normal | 0,007 | 1 import, 2 dossiers, 5 analyses, 2 modifications, au coût bas (**supposé**) |
| Gratuit au maximum honnête | 0,10 à 0,60 | 2 dossiers + 600 analyses ; bas ou haut par appel |
| Gratuit abusif, quotas journaliers épuisés chaque jour | 0,91 à 3,60 | 10 rédactions + 15 modifications + 20 analyses par jour pendant 30 jours. Possible parce que la limite de 2 dossiers se contourne (constat M1 de l'audit du 7 octobre) |

**La limite de 8 offres par jour ne réduit pas le coût IA** : le classement gratuit ne paie aucun appel par étudiant. Elle ne devient une économie que si le nombre d'analyses détaillées gratuites passe aussi de 20 à 8 par jour (plafond mensuel au pire : 0,24 USD au lieu de 0,60).

### 1.5 Coût par abonné payant et par mois (estimations)

| Formule | Bas (usage normal) | Milieu (tout le plafond, coût bas par appel) | Haut (tout le plafond, coût maximal par appel) |
| --- | --- | --- | --- |
| **Plafonnée** : 30 dossiers, 90 modifications, 600 analyses, 2 imports | 0,05 USD (0,04 €) | 0,22 USD (0,19 €) | 1,08 USD (0,94 €) |
| **« Illimitée »** avec les quotas journaliers actuels | 0,05 USD (0,04 €) | 0,91 USD (0,79 €) | 3,60 USD (3,13 €) |
| **Illimitée sans quota journalier** (valeur 0 dans `lib/quota.ts:55`) | — | — | Sans borne : 30 appels par minute, soit environ 47 USD par jour au coût bas |

Hypothèse du « bas » : 10 dossiers, 20 modifications, 100 analyses, 1 import (**supposé**). Aujourd'hui un compte « pro » n'a aucune limite mensuelle de dossiers (`lib/plan.ts:85`), seulement les quotas journaliers.

## 2. Trois prix candidats

### 2.1 Frais de paiement (vérifiés en ligne le 8 octobre 2026)

Source : [stripe.com/fr/pricing](https://stripe.com/fr/pricing) et [stripe.com/fr/billing/pricing](https://stripe.com/fr/billing/pricing).

- Carte standard de l'Espace économique européen : 1,5 % + 0,25 €. Carte premium : 2,8 % + 0,25 €. Carte britannique : 2,5 % + 0,25 €. Carte internationale : 3,15 % + 0,25 €.
- Stripe Billing (abonnements) : 0,7 % du volume.
- Stripe Tax, si utilisé : 0,5 % par transaction. Non compté ci-dessous.

Ces taux confirment ceux écrits dans `lib/economics.ts:105-108`.

### 2.2 Ce qui reste par abonné (calculé)

Carte standard + Billing. « Sans TVA » suppose une franchise de TVA ; « avec TVA » suppose 20 % compris dans le prix affiché. Lequel s'applique dépend du statut (section 3) : **à confirmer par un comptable**.

| Prix | Frais Stripe | Net sans TVA | Net avec TVA | Net par mois avec TVA | Coût IA milieu | **Marge / abonné / mois, sans TVA** | **Avec TVA** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4,99 € / mois | 0,36 € | 4,63 € | 3,80 € | 3,80 € | 0,19 € | **4,44 €** | **3,61 €** |
| 7,99 € / mois | 0,43 € | 7,56 € | 6,23 € | 6,23 € | 0,19 € | **7,37 €** | **6,04 €** |
| 9,99 € / mois | 0,47 € | 9,52 € | 7,86 € | 7,86 € | 0,19 € | **9,33 €** | **7,67 €** |
| 24,99 € / semestre | 0,80 € | 24,19 € | 20,03 € | 3,34 € | 0,19 € | 3,84 € | 3,15 € |
| 34,99 € / semestre | 1,02 € | 33,97 € | 28,14 € | 4,69 € | 0,19 € | 5,47 € | 4,50 € |
| 44,99 € / semestre | 1,24 € | 43,75 € | 36,25 € | 6,04 € | 0,19 € | 7,10 € | 5,85 € |

Carte premium : retirer 0,06 à 0,13 € par paiement mensuel. Le semestre paie les frais fixes de 0,25 € une fois au lieu de six, et encaisse six mois d'avance.

### 2.3 Coûts fixes retenus pour le seuil (USD par mois)

| Palier d'inscrits | Hébergement | Catalogue IA | Étudiants gratuits (0,01 USD par inscrit, **supposé**) | Total | En euros |
| --- | --- | --- | --- | --- | --- |
| 100 | 22 : Vercel Pro 20 + « autres » 2 (**supposé**, `lib/admin/growth.ts:112-116`) | 1 | 1 | 24 | 20,9 € |
| 1 000 | 47 : + Supabase Pro 25 | 1 | 10 | 58 | 50,4 € |
| 8 000 | 135 (**supposé**, `lib/admin/levels.ts:139`, aucune facture) | 1 | 80 | 216 | 187,8 € |

Catalogue : 645 nouvelles offres par jour (page admin) × 30 × 0,00005 USD ≈ 1 USD par mois (**calculé** à partir d'une mesure). Railway, Resend, nom de domaine, JSearch : **à fournir par le propriétaire**, absents du dépôt ; ils sont représentés par les 2 USD « autres ».

### 2.4 Seuil de rentabilité, en abonnés (calculé)

Format : sans TVA / avec TVA. Entre parenthèses, la part des inscrits que cela représente.

| Inscrits | 4,99 € | 7,99 € | 9,99 € |
| --- | --- | --- | --- |
| 100 | 5 / 6 (5 à 6 %) | 3 / 4 (3 à 4 %) | 3 / 3 (3 %) |
| 1 000 | 12 / 14 (1,2 à 1,4 %) | 7 / 9 (0,7 à 0,9 %) | 6 / 7 (0,6 à 0,7 %) |
| 8 000 | 43 / 53 (0,5 à 0,7 %) | 26 / 32 (0,3 à 0,4 %) | 21 / 25 (0,3 %) |

### 2.5 Sensibilité au taux de conversion : marge mensuelle en euros (calculé)

Format : sans TVA / avec TVA. Les taux de 1, 3 et 5 % sont des **hypothèses** ; aucune conversion n'a jamais été mesurée (0 payant sur 4 inscrits).

| Inscrits | Prix | 1 % | 3 % | 5 % |
| --- | --- | --- | --- | --- |
| 100 | 4,99 € | −16 / −17 | −8 / −10 | +1 / −3 |
| 100 | 7,99 € | −13 / −15 | +1 / −3 | +16 / +9 |
| 100 | 9,99 € | −12 / −13 | +7 / +2 | +26 / +18 |
| 1 000 | 4,99 € | −6 / −14 | +83 / +58 | +172 / +130 |
| 1 000 | 7,99 € | +23 / +10 | +171 / +131 | +318 / +252 |
| 1 000 | 9,99 € | +43 / +26 | +230 / +180 | +416 / +333 |
| 8 000 | 4,99 € | +168 / +102 | +880 / +680 | +1 591 / +1 259 |
| 8 000 | 7,99 € | +402 / +296 | +1 583 / +1 264 | +2 763 / +2 231 |
| 8 000 | 9,99 € | +559 / +426 | +2 053 / +1 655 | +3 547 / +2 883 |

Lecture : à conversion égale, le prix le plus haut gagne toujours. Mais la conversion dépend du prix. 4,99 € ne bat 7,99 € que s'il convertit **1,66 fois plus** d'étudiants ; 7,99 € ne bat 9,99 € que s'il en convertit **1,27 fois plus**. Aucune donnée ne permet de le dire aujourd'hui.

À 100 inscrits, aucun prix ne rapporte plus de 26 € par mois : le projet couvre ses frais, il ne gagne pas d'argent.

## 3. Coûts fixes qui apparaissent quand on vend

| Poste | Montant | Preuve | Statut |
| --- | --- | --- | --- |
| **Vercel Pro** | 20 USD par mois, avec 20 USD de crédit d'usage inclus | [vercel.com/pricing](https://vercel.com/pricing) | **Obligatoire avant le premier encaissement** |
| **Supabase Pro** | à partir de 25 USD par mois | [supabase.com/pricing](https://supabase.com/pricing) | Pas obligatoire par les conditions lues ; recommandé avant de vendre |
| Stripe | 0 € fixe, frais par paiement (section 2.1) | stripe.com/fr/pricing | À créer |
| Railway, Resend, nom de domaine, JSearch | **à fournir par le propriétaire** | Absents du dépôt | — |
| Juriste (France Travail art. 5.1), comptable | **à fournir par le propriétaire** | — | Dépense unique probable |

**Vercel Hobby et l'usage commercial.** Vérifié le 8 octobre 2026 dans la documentation Vercel, page « Fair Use Guidelines » mise à jour le 14 septembre 2026 ([lien](https://vercel.com/docs/limits/fair-use-guidelines)) :

> « Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan. »

Parmi les exemples d'usage commercial cités : « Any method of requesting or processing payment from visitors of the site » et « Advertising the sale of a product or service ». Conséquence : afficher un prix ou un bouton de paiement sur le plan Hobby est déjà hors des conditions. Vercel Pro doit être payé **avant** la mise en ligne de la tarification, pas au premier abonné.

**Supabase Free.** La page de tarifs indique : 500 Mo de base, 50 000 utilisateurs actifs par mois, 5 Go de trafic sortant, et « Free projects are paused after 1 week of inactivity ». La base faisait environ 49 Mo le 6 octobre (`docs/INTEGRATION-IA-2026-10-06.md:28`). La page ne dit rien de l'usage commercial : **non vérifié**. Le risque chiffré est ailleurs : le plan gratuit n'a pas de sauvegarde quotidienne, et la protection des mots de passe compromis est réservée au plan Pro (audit du 8 octobre, section 3).

**Statut et TVA en France (simple signalement, pas un conseil).** Pour encaisser, Stripe demande une identité d'entreprise ou d'entrepreneur. Il faut donc un statut déclaré, des conditions générales de vente, et une réponse sur la TVA (franchise ou 20 %). L'écart est de 1,33 € par abonné à 7,99 €. À voir avec un comptable. Le droit de rétractation et les remboursements ne sont pas chiffrés ici.

## 4. Plafond pour qu'un abonné abusif ne coûte jamais plus que ce qu'il paie

Référence : le net le plus bas, celui de 4,99 € avec TVA, soit 3,80 € (4,37 USD).

| Plafond | Coût maximal par abonné et par mois | Part du net à 4,99 € | Part du net à 7,99 € |
| --- | --- | --- | --- |
| Quotas journaliers actuels seuls (10 / 15 / 20 par jour) | 3,60 USD (3,13 €) | 82 % | 50 % |
| **Plafonds mensuels : 30 dossiers, 90 modifications, 600 analyses** | **1,08 USD (0,94 €)** | **25 %** | **15 %** |
| Aucun quota (valeur 0) | sans borne | perte | perte |

Conclusion chiffrée :

- Les quotas journaliers actuels suffisent déjà à ne jamais perdre d'argent sur un abonné, mais de peu à 4,99 €.
- Avec des plafonds mensuels de **30 dossiers, 90 modifications (3 par dossier) et 600 analyses**, tout en gardant les quotas journaliers, un abonné ne peut pas coûter plus de 0,94 € (estimation).
- « Illimité » ne doit jamais vouloir dire quota à 0.
- Ces plafonds ne valent que si le compteur mensuel est tenu par le serveur. Aujourd'hui il se contourne (constat M1 de l'audit du 7 octobre), et la réservation des dossiers dépend d'une variable (constat E3).
- Limite de l'estimation : les appels coupés ou tronqués peuvent être facturés. Marge de sécurité conseillée : +20 % sur ces coûts, soit 1,30 USD au pire.

## 5. Cohérence avec le plafond de 2 USD de la clé

| Question | Réponse (estimation) |
| --- | --- |
| Combien de dossiers dans 2 USD ? | 1 848 au coût mesuré (0,001082), 512 au coût maximal (0,0039) |
| Que consomme le catalogue seul ? | Environ 1 USD par mois, sans aucun étudiant |
| Combien de temps tient la clé ? | Le plafond ne se renouvelle pas. Avec 0,40 USD déjà affichés, il reste 1,60 USD, soit environ 6 à 7 semaines de catalogue seul |
| Un abonné au maximum ? | 1,08 USD par mois : plus de la moitié du plafond total |
| Un compte gratuit abusif ? | 0,91 à 3,60 USD par mois : peut vider la clé seul |

Le plafond de 2 USD est cohérent avec un pilote fermé de quelques semaines. Il ne l'est pas avec une vente : un seul abonné actif et le catalogue l'épuisent en un mois. Budget IA mensuel à prévoir, **pour décision du propriétaire seulement** :

- formule : 1 USD (catalogue) + 1,08 USD × abonnés + 0,03 USD × inscrits gratuits (pire cas) ;
- exemple à 100 inscrits et 10 abonnés : 15 USD au pire, environ 4 USD attendus.

Je ne recommande aucune hausse sans le rapprochement avec les factures (BIZ-10).

## 6. Recommandation chiffrée unique

| Élément | Valeur |
| --- | --- |
| **Prix** | **7,99 € par mois**, ou **34,99 € le semestre** (5,83 € par mois, −27 %) |
| **Plafonds de la formule payante** | 30 dossiers, 90 modifications et 600 analyses par mois ; quotas journaliers conservés (10 / 15 / 20) |
| **Formule gratuite** | 2 dossiers par mois ; analyses détaillées ramenées à 8 par jour, alignées sur les 8 offres |
| **Marge par abonné** | 6,04 € par mois avec TVA, 7,37 € sans (mensuel) ; 4,50 € et 5,47 € au semestre |
| **Seuil de rentabilité** | **4 abonnés** avec Vercel Pro seul (20,9 € de coûts) ; **9 abonnés** avec Vercel Pro et Supabase Pro (50,4 €). Sans TVA : 3 et 7 |
| **Dépense avant le premier euro** | 20 USD par mois (Vercel Pro), dès l'affichage du prix |

Pourquoi 7,99 € et non 9,99 € : l'écart de seuil n'est que d'un abonné, et 9,99 € rapporte moins dès qu'il convertit 21 % d'étudiants en moins que 7,99 €, ce qui est plausible pour des étudiants (**supposé**, à trancher par le commercial). Pourquoi pas 4,99 € : il demande 5 à 6 % de conversion à 100 inscrits pour couvrir les frais.

Avec 4 inscrits aujourd'hui, le seuil de 4 abonnés veut dire 100 % de conversion. **Le projet sera en perte d'environ 21 € par mois dès l'affichage du prix, jusqu'à environ 100 à 130 inscrits à 3 ou 4 % de conversion.**

## 7. Ce qui casse la marge en premier

| Rang | Risque | Effet chiffré (estimation) |
| --- | --- | --- |
| 1 | Trop peu d'inscrits | Sous 100 inscrits, perte fixe d'environ 21 € par mois, quel que soit le prix |
| 2 | Plafond de la clé à 2 USD | Service coupé pour tous, abonnés compris, en moins d'un mois |
| 3 | Abus du gratuit (M1) | Un compte : jusqu'à 3,60 USD par mois, soit la marge d'un demi-abonné |
| 4 | TVA non prévue | −1,33 € par abonné à 7,99 € (−18 % de marge) |
| 5 | Prix des modèles multipliés par 3 | Coût maximal d'un abonné : 3,24 USD (2,82 €), encore sous le net de 6,23 €. La marge tient |
| 6 | Licence France Travail (art. 5.1) | Non chiffrable. Si le floutage des offres est jugé « vente d'offres », le revenu doit venir des dossiers seuls |

## 8. Propositions pour le registre

Je ne modifie pas le registre (consigne de cette mission). À inscrire par la coordination, statut `proposée` :

| Proposition | Chiffre |
| --- | --- |
| FIN-01 : prix 7,99 € par mois et 34,99 € le semestre | Marge 6,04 € par abonné avec TVA |
| FIN-02 : plafonds payants 30 dossiers, 90 modifications, 600 analyses par mois, compteur tenu par le serveur | Coût maximal 0,94 € par abonné |
| FIN-03 : analyses gratuites à 8 par jour | Coût maximal du gratuit honnête : 0,24 USD au lieu de 0,60 |
| FIN-04 : passer à Vercel Pro avant d'afficher un prix | 20 USD par mois |
| FIN-05 : Supabase Pro avant le premier abonné | 25 USD par mois |
| FIN-06 : budget IA mensuel renouvelable à la place du plafond total de 2 USD, après BIZ-10 | 1 + 1,08 × abonnés + 0,03 × gratuits, en USD |
| FIN-07 : corriger `TASK_TOKENS.kit` dans la page admin | 5 000 jetons annoncés, 2 400 possibles |

## 9. Questions

**Au commercial**

- Quelle conversion attendre à 4,99 €, 7,99 € et 9,99 € ? Il faut 1,66 fois plus de conversions à 4,99 € qu'à 7,99 € pour gagner autant.
- Le semestre à 34,99 € correspond-il à la durée d'une recherche de stage ou d'alternance ?
- Combien d'inscrits peut-on atteindre en trois mois ? Le seuil demande environ 100 à 130 inscrits.

**À la valorisation**

- Un abonné vaut-il 6 mois de marge (36 €) ou moins ? Durée d'abonnement attendue d'un étudiant.
- Quel coût d'acquisition par inscrit reste acceptable avec 6,04 € de marge par abonné et 3 % de conversion (soit 0,18 € de marge par inscrit et par mois) ?

**Au critique**

- Flouter les offres au-delà de 8 pour les non-payants est-il une « vente d'offres d'emploi » au sens de la licence France Travail (question Q8, sans réponse) ? Si oui, le chiffrage tient-il en ne vendant que des dossiers ?
- Adzuna demande un accord écrit pour un autre usage commercial (Q1) : quel coût si une licence est exigée ?
- La base fait environ 4 000 offres : un étudiant paiera-t-il 7,99 € pour 30 dossiers s'il n'en utilise que 2 à 5 ?

**Au propriétaire (montants à fournir)**

- Factures ou forfaits Railway, Resend, nom de domaine, JSearch.
- Captures du rapprochement BIZ-10, pour remplacer ces estimations par des mesures.
- Statut juridique prévu et régime de TVA.

## Sources

- Dépôt : `lib/economics.ts`, `lib/ai.ts`, `lib/plan.ts`, `lib/quota.ts`, `docs/INTEGRATION-IA-2026-10-06.md`, `docs/RESULTATS-COMPARATIF-IA-2026-10-06.md`, `docs/audits/securite-couts-2026-10-07.md`, `docs/audits/admin-couts-reels-et-acces-2026-10-08.md`, `docs/audits/public-02-attributions-sources-2026-10-07.md`, `docs/business/jugement-2026-10-08-admin-et-limite-8.md`.
- En ligne, consultés le 8 octobre 2026 : [Stripe, tarifs France](https://stripe.com/fr/pricing), [Stripe Billing](https://stripe.com/fr/billing/pricing), [Vercel, Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines), [Vercel, tarifs](https://vercel.com/pricing), [Supabase, tarifs](https://supabase.com/pricing).
- Non vérifié : tarifs réels des trois modèles, toutes les factures, conditions commerciales de Supabase Free, seuils de TVA.
