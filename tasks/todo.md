# MVP — travaux et vérifications

- [ ] Quotas : compteur indisponible bloque les appels payants avec une erreur 503, sans confondre quota atteint et panne. Tests erreur/null/refus/autorisation et limites gratuites vides.
- [ ] Import CV : PDF texte local + fournisseur Gateway, un appel maximum ; tests PDF vide/corrompu/scanné et vérification du brouillon. Dépend de la validation des limites.
- [ ] Comptes : SMTP déjà configuré selon l'utilisateur ; vérifier le parcours et l'expéditeur. L'advisor confirme actuellement la protection des mots de passe divulgués désactivée ; ne pas cocher sans activation vérifiée.
- [ ] Catalogue : collecte, stages, source Adzuna et validité des offres. Vérifier la taille réelle avant toute recommandation de forfait.
- [ ] Recherche : filtres avancés et recherches enregistrées ; résultats et classement vérifiés avec un profil réel.
- [ ] IA : limiter les analyses répétées, résumés partagés et embeddings compatibles ; CV/lettre avec preuves et validation utilisateur.
- [ ] Suivi : parcours complet, documents téléchargeables et absence d'envoi automatique.
- [ ] Budget : quota gratuit, plafond existant 2 $, alertes et comportement en cas d'épuisement.
- [ ] Livraison : tests, typecheck, lint, build, CI, déploiement, vérification de production et backlog actualisé.
