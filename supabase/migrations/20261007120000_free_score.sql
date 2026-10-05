-- Sprint 7 — the free score: every offer of every student compared with the
-- CV in the database (vectors + skills in common), without any AI call.

-- Skills the CV proves, normalized (lib/skills.ts), written with the vector.
alter table public.candidate_profiles add column if not exists skills text[] not null default '{}';

-- The signed-in account's offers: closeness to the CV, skills in common and
-- skills asked that the CV does not show (from the offer read once for all).
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
  from mine;
$fn$;
revoke all on function public.my_job_fit() from public, anon;
grant execute on function public.my_job_fit() to authenticated;
