-- ============================================================================
-- NON EXÉCUTÉ — écriture en production réservée à une décision du propriétaire.
-- ROLLBACK par défaut : l'étape 2 se termine par ROLLBACK ; seul le propriétaire
-- remplace cette ligne par COMMIT. L'étape 1 est en lecture seule.
-- Aucune donnée personnelle ni identifiant dans ce fichier.
-- PROBABLEMENT SANS OBJET : le propriétaire dit ne pas avoir de variable Gmail en production,
-- donc la lecture de la boîte d'alertes n'a pas tourné. L'étape 1 (lecture seule) le confirmera :
-- si tous les nombres valent 0, ne pas lancer l'étape 2.
-- ============================================================================
-- Pourquoi : avant le commit dcd53805, la recherche de l'administrateur versait au
-- catalogue partagé les offres lues dans la boîte d'alertes de l'opérateur (source
-- « alert:<plateforme> »). Elles ont pu être recopiées dans la liste d'autres comptes.
-- Depuis dcd53805 elles ne sont plus versées ; ce script nettoie ce qui existe déjà.
--
-- À FAIRE AVANT l'étape 2 : prendre une sauvegarde de la base (ou vérifier qu'une
-- sauvegarde récente existe). Un COMMIT ne peut pas être annulé autrement.
--
-- Liens entre les tables (relus dans supabase/migrations) :
--   * jobs.offer_id -> offers(id) ON DELETE SET NULL : supprimer une offre du catalogue
--     ne supprime PAS les copies des comptes ; elles perdent seulement le lien.
--   * offer_reports.offer_id -> offers(id) ON DELETE CASCADE : les signalements « offre
--     plus disponible » faits sur ces offres disparaissent avec elles.
--   * les lignes qui dépendent d'une ligne jobs supprimée en cascade (par exemple les
--     liens d'origine des offres, job_sources) suivent la ligne ; elles n'ont pas toutes
--     été relues une par une.

------------------------------------------------------------------------------
-- ÉTAPE 1 — LECTURE SEULE : combien de lignes seraient concernées ? (aucune écriture)
------------------------------------------------------------------------------
select 'offres du catalogue, source alert:%' as mesure, count(*)::int as nombre
  from public.offers where source like 'alert:%'
union all
select '  dont ouvertes', count(*)::int
  from public.offers where source like 'alert:%' and status = 'open'
union all
select 'lignes jobs de source alert:%, tous comptes', count(*)::int
  from public.jobs where source_platform like 'alert:%'
union all
select '  dont comptes non administrateurs (lignes)', count(*)::int
  from public.jobs j where j.source_platform like 'alert:%'
  and j.user_id not in (select user_id from public.app_admins)
union all
select '  dont comptes non administrateurs (comptes)', count(distinct j.user_id)::int
  from public.jobs j where j.source_platform like 'alert:%'
  and j.user_id not in (select user_id from public.app_admins)
union all
select '  parmi elles, copies INTACTES (retirées par l''étape 2)', count(*)::int
  from public.jobs j where j.source_platform like 'alert:%'
  and j.user_id not in (select user_id from public.app_admins)
  and j.stage = 'new' and j.notes is null
  and not exists (select 1 from public.applications a where a.job_id = j.id)
  and not exists (select 1 from public.documents d where d.job_id = j.id)
union all
select '  parmi elles, copies TOUCHÉES (vues, notées, avec dossier : GARDÉES)', count(*)::int
  from public.jobs j where j.source_platform like 'alert:%'
  and j.user_id not in (select user_id from public.app_admins)
  and not (j.stage = 'new' and j.notes is null
    and not exists (select 1 from public.applications a where a.job_id = j.id)
    and not exists (select 1 from public.documents d where d.job_id = j.id))
union all
select 'lignes jobs de l''administrateur, source alert:% (GARDÉES)', count(*)::int
  from public.jobs j where j.source_platform like 'alert:%'
  and j.user_id in (select user_id from public.app_admins)
union all
select 'signalements portant sur ces offres (supprimés avec elles)', count(*)::int
  from public.offer_reports r join public.offers o on o.id = r.offer_id where o.source like 'alert:%';

-- Détail par plateforme d'alerte (nombres seulement) :
-- select source, count(*) as offres from public.offers where source like 'alert:%' group by source order by 2 desc;

------------------------------------------------------------------------------
-- ÉTAPE 2 — ÉCRITURE (production). NE PAS LANCER sans décision du propriétaire.
-- Elle fait, dans UNE transaction, sans rien afficher d'identifiant :
--   A) retire du catalogue partagé TOUTES les offres de source alert:% (open, closed, expired) ;
--   B) retire des listes des COMPTES NON ADMINISTRATEURS les copies INTACTES de ces offres
--      (jamais vues, sans note, sans candidature ni document) ;
--   ET LAISSE EN PLACE : les copies que l'étudiant a vues, notées ou utilisées (elles perdent
--      seulement le lien avec le catalogue) et toutes les lignes de l'administrateur.
-- Le résultat affiche combien de copies et d'offres ont été retirées. Il se termine par
-- ROLLBACK : rien n'est gardé tant que le propriétaire n'a pas remplacé la dernière ligne.
------------------------------------------------------------------------------
begin;

with removed_copies as (
  delete from public.jobs j
  where j.user_id not in (select user_id from public.app_admins)
    and (j.source_platform like 'alert:%'
         or j.offer_id in (select id from public.offers where source like 'alert:%'))
    and j.stage = 'new' and j.notes is null
    and not exists (select 1 from public.applications a where a.job_id = j.id)
    and not exists (select 1 from public.documents d where d.job_id = j.id)
  returning 1
), removed_offers as (
  delete from public.offers where source like 'alert:%' returning 1
)
select (select count(*) from removed_copies) as copies_retirees_chez_les_etudiants,
       (select count(*) from removed_offers) as offres_retirees_du_catalogue;

-- Variante plus prudente (à utiliser À LA PLACE du bloc ci-dessus, pas en plus) :
-- ne retirer que les offres du catalogue et laisser TOUTES les copies chez les comptes :
--   delete from public.offers where source like 'alert:%';
-- Les copies restent alors visibles dans les listes des étudiants (sans lien catalogue).

rollback;   -- remplacer par COMMIT; seulement après décision du propriétaire

------------------------------------------------------------------------------
-- CE QUI NE PEUT PAS ÊTRE ANNULÉ APRÈS UN COMMIT (sauf restauration de sauvegarde) :
--   * les lignes d'offers de source alert:% et leurs vecteurs et résumés calculés
--     (les recalculer coûterait une lecture et une vectorisation par offre, si elles
--     revenaient un jour dans le catalogue, ce qui n'arrive plus par la recherche) ;
--   * les signalements « offre plus disponible » qui portaient sur elles ;
--   * les copies intactes retirées des listes des comptes non administrateurs.
-- APRÈS UN COMMIT : relancer l'étape 1. Attendu : 0 offre alert:%, 0 copie intacte chez
-- les non-administrateurs, copies touchées et lignes de l'administrateur inchangées.
------------------------------------------------------------------------------
