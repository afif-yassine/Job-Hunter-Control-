-- ============================================================================
-- NON EXÉCUTÉ — écriture en production réservée à une décision du propriétaire.
-- ROLLBACK par défaut : l'étape 2 se termine par ROLLBACK ; seul le propriétaire
-- remplace cette ligne par COMMIT. L'étape 1 est en lecture seule.
-- Aucune donnée personnelle ni identifiant dans ce fichier.
-- À lancer dans l'éditeur SQL Supabase, après le déploiement du correctif de
-- lib/semantic-embeddings.ts (qui garde ensuite les compétences du profil à jour).
-- ============================================================================
-- Re-normalisation des compétences déjà stockées (alias sûrs de lib/skills.ts, commit 6b19a6dc).
-- Les compétences stockées sont déjà normalisées (minuscules, sans accents) : il suffit de
-- remplacer les anciennes formes par la forme d'alias, en gardant l'ordre et sans doublon.
--
-- Sécurité vérifiée dans supabase/migrations :
--  * modifier offers.summary ne déclenche ni l'invalidation des vecteurs (offers_semantic_invalidation
--    ne réagit qu'au titre, description, lieu, contrat, catégories) ni celle de la lecture
--    (invalidate_offer_reading ne réagit qu'au titre, entreprise, lieu, contrat, description).
--  * modifier candidate_profiles.skills ne déclenche pas profile_semantic_invalidation
--    (réagit seulement si la colonne `profile` change) : aucun vecteur n'est recalculé, aucun coût IA.

------------------------------------------------------------------------------
-- ÉTAPE 1 — LECTURE SEULE : combien de lignes changeraient ? (aucune écriture)
------------------------------------------------------------------------------
with alias(k, v) as (values
  ('ml', 'machine learning'), ('apprentissage automatique', 'machine learning'),
  ('apprentissage profond', 'deep learning'), ('dl', 'deep learning'),
  ('genai', 'ia generative'), ('generative ai', 'ia generative'),
  ('intelligence artificielle', 'ia'), ('torch', 'pytorch')),
quality(q) as (values
  ('autonomie'), ('curiosite'), ('ecoute'), ('rigueur'), ('motivation'), ('dynamisme'),
  ('esprit d equipe'), ('communication'), ('adaptabilite'), ('organisation'),
  ('resolution de problemes'), ('resolution de probleme'), ('apprentissage')),
offer_skills as (
  select o.id, o.status, e.s
  from public.offers o
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(o.summary -> 'skills') = 'array' then o.summary -> 'skills' else '[]'::jsonb end) e(s)
),
profile_skills as (
  select p.user_id, e.s
  from public.candidate_profiles p
  cross join lateral unnest(coalesce(p.skills, '{}')) e(s)
)
select 'offres avec compétences' as mesure, count(distinct id)::int as nombre from offer_skills
union all select 'offres ouvertes avec compétences', count(distinct id)::int from offer_skills where status = 'open'
union all select 'offres dont une compétence change (alias)', count(distinct id)::int from offer_skills where s in (select k from alias)
union all select 'offres ouvertes dont une compétence change (alias)', count(distinct id)::int from offer_skills where status = 'open' and s in (select k from alias)
union all select 'offres qui contiennent une qualité (info, rien à écrire : fitScore les ignore déjà)', count(distinct id)::int from offer_skills where s in (select q from quality)
union all select 'profils avec compétences', count(distinct user_id)::int from profile_skills
union all select 'profils dont une compétence change (alias)', count(distinct user_id)::int from profile_skills where s in (select k from alias);

-- Détail par alias (quelles formes existent vraiment aujourd'hui) :
-- select e.s as ancienne_forme, count(distinct o.id) as offres
-- from public.offers o
-- cross join lateral jsonb_array_elements_text(
--   case when jsonb_typeof(o.summary -> 'skills') = 'array' then o.summary -> 'skills' else '[]'::jsonb end) e(s)
-- where e.s in ('ml','apprentissage automatique','apprentissage profond','dl','genai','generative ai','intelligence artificielle','torch')
-- group by 1 order by 2 desc;

------------------------------------------------------------------------------
-- ÉTAPE 2 — ÉCRITURE (production). NE PAS LANCER sans décision du propriétaire.
-- Les qualités ne sont PAS supprimées des données : le score les ignore déjà à l'affichage
-- et cela évite de perdre de l'information. Seuls les alias sont réécrits.
-- Le script se termine par ROLLBACK : il montre le nombre de lignes modifiées sans rien garder.
-- Pour appliquer pour de bon, le propriétaire remplace la dernière ligne par COMMIT.
------------------------------------------------------------------------------
begin;

create temporary table alias_map(k text primary key, v text) on commit drop;
insert into alias_map values
  ('ml', 'machine learning'), ('apprentissage automatique', 'machine learning'),
  ('apprentissage profond', 'deep learning'), ('dl', 'deep learning'),
  ('genai', 'ia generative'), ('generative ai', 'ia generative'),
  ('intelligence artificielle', 'ia'), ('torch', 'pytorch');

-- Offres (summary.skills) : forme d'alias, ordre d'origine conservé, doublons retirés.
with src as (
  select o.id,
    case when jsonb_typeof(o.summary -> 'skills') = 'array' then o.summary -> 'skills' else '[]'::jsonb end as sk
  from public.offers o
),
changed as (
  select s.id,
    (select coalesce(jsonb_agg(x.s order by x.first_pos), '[]'::jsonb)
     from (select coalesce(a.v, e.s) as s, min(e.pos) as first_pos
           from jsonb_array_elements_text(s.sk) with ordinality e(s, pos)
           left join alias_map a on a.k = e.s
           group by coalesce(a.v, e.s)) x) as new_sk
  from src s
  where exists (select 1 from jsonb_array_elements_text(s.sk) e(s) where e.s in (select k from alias_map))
)
update public.offers o set summary = jsonb_set(o.summary, '{skills}', c.new_sk)
from changed c where c.id = o.id;

-- Profils (candidate_profiles.skills) : même règle.
with changed as (
  select p.user_id,
    (select array_agg(x.s order by x.first_pos)
     from (select coalesce(a.v, e.s) as s, min(e.pos) as first_pos
           from unnest(p.skills) with ordinality e(s, pos)
           left join alias_map a on a.k = e.s
           group by coalesce(a.v, e.s)) x) as new_sk
  from public.candidate_profiles p
  where exists (select 1 from unnest(coalesce(p.skills, '{}')) e(s) where e.s in (select k from alias_map))
)
update public.candidate_profiles p set skills = c.new_sk
from changed c where c.user_id = p.user_id;

rollback;   -- remplacer par COMMIT; seulement après décision du propriétaire
