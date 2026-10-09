-- NON APPLIQUÉE — à ranger avec les autres migrations en attente (docs/MIGRATIONS-EN-ATTENTE-2026-10-08.md).
-- Les trois fonctions de note n'avaient pas d'ORDER BY. Le client les lit désormais par pages de 1 000 lignes
-- (la base ne renvoie pas plus de 1 000 lignes par requête) : sans ordre fixe, deux pages peuvent répéter ou
-- sauter des lignes. On ajoute seulement « order by » sur l'identifiant de l'offre : mêmes colonnes, mêmes
-- droits, mêmes résultats, dans un ordre stable. Sans cette migration, rien ne casse : seuls les comptes de
-- plus de 1 000 offres (aujourd'hui l'administrateur) peuvent voir une note manquante, jamais une fausse note.

create or replace function public.my_job_fit_v2()
returns table (job_id uuid, similarity double precision, matched text[], missing text[], model text)
language sql stable security invoker set search_path = public, extensions as $$
  with mine as (
    select j.id, o.semantic_embedding oe, p.semantic_embedding pe, o.semantic_model om, p.semantic_model pm, p.skills ps,
      case when jsonb_typeof(o.summary -> 'skills')='array' then o.summary -> 'skills' else '[]'::jsonb end sk
    from public.jobs j join public.offers o on o.id=j.offer_id join public.candidate_profiles p on p.user_id=j.user_id
    where j.user_id=(select auth.uid()) and p.semantic_model='perplexity/pplx-embed-v1-0.6b@retrieval-v1'
  ) select id, case when oe is not null and pe is not null and om=pm then 1-(oe <=> pe) end,
    array(select s from jsonb_array_elements_text(sk) s where s=any(ps)),
    array(select s from jsonb_array_elements_text(sk) s where not(s=any(ps))), pm from mine
  order by id;
$$;

create or replace function public.my_job_fit()
returns table (job_id uuid, similarity double precision, matched text[], missing text[])
language sql stable security invoker set search_path = public, extensions as $fn$
  with mine as (
    select j.id, o.embedding oe, p.embedding pe, p.skills ps,
      case when jsonb_typeof(o.summary -> 'skills') = 'array' then o.summary -> 'skills' else '[]'::jsonb end sk
    from public.jobs j
    join public.offers o on o.id = j.offer_id
    join public.candidate_profiles p on p.user_id = j.user_id
    where j.user_id = (select auth.uid())
  )
  select id,
    case when oe is not null and pe is not null then 1 - (oe <=> pe) end,
    array(select s from jsonb_array_elements_text(sk) s where s = any(ps)),
    array(select s from jsonb_array_elements_text(sk) s where not (s = any(ps)))
  from mine
  order by id;
$fn$;

create or replace function public.my_job_similarity()
returns table (job_id uuid, similarity double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select j.id, 1 - (o.embedding <=> p.embedding)
  from public.jobs j
  join public.offers o on o.id = j.offer_id and o.embedding is not null
  join public.candidate_profiles p on p.user_id = j.user_id and p.embedding is not null
  where j.user_id = auth.uid()
  order by j.id;
$$;
-- Les droits (grant / revoke) des trois fonctions sont conservés par « create or replace ».
