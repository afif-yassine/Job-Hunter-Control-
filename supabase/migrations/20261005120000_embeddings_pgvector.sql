-- Sprint 3 — embeddings (pgvector): every open offer and every profile gets a
-- 768-dimension vector (Gemini embedding), computed once; offers are ranked
-- by how close they are to the account's profile, whatever their words.
create extension if not exists vector with schema extensions;

alter table public.offers add column if not exists embedding extensions.vector(768);
alter table public.candidate_profiles add column if not exists embedding extensions.vector(768);
alter table public.candidate_profiles add column if not exists embedding_at timestamptz;

create index if not exists offers_embedding_idx on public.offers
  using hnsw (embedding extensions.vector_cosine_ops) where status = 'open';

-- Harvest: store the embeddings of offers (service only).
create function public.set_offer_embeddings(p_rows jsonb)
returns integer language sql security definer set search_path = public, extensions as $$
  with done as (
    update public.offers o
    set embedding = (r ->> 'embedding')::extensions.vector
    from jsonb_array_elements(p_rows) r
    where o.id = (r ->> 'id')::uuid
    returning 1
  )
  select count(*)::int from done;
$$;
revoke all on function public.set_offer_embeddings(jsonb) from public, anon, authenticated;
grant execute on function public.set_offer_embeddings(jsonb) to service_role;

-- Open offers closest to the signed-in account's profile (cosine similarity, 0..1).
create function public.match_offers_for_me(p_limit integer default 50)
returns table (offer_id uuid, similarity double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select o.id, 1 - (o.embedding <=> p.embedding)
  from public.candidate_profiles p
  join public.offers o on o.status = 'open' and o.embedding is not null
  where p.user_id = auth.uid() and p.embedding is not null
  order by o.embedding <=> p.embedding
  limit least(greatest(p_limit, 1), 500);
$$;
grant execute on function public.match_offers_for_me(integer) to authenticated;

-- The signed-in account's own offers, with how close each is to its profile.
create function public.my_job_similarity()
returns table (job_id uuid, similarity double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select j.id, 1 - (o.embedding <=> p.embedding)
  from public.jobs j
  join public.offers o on o.id = j.offer_id and o.embedding is not null
  join public.candidate_profiles p on p.user_id = j.user_id and p.embedding is not null
  where j.user_id = auth.uid();
$$;
grant execute on function public.my_job_similarity() to authenticated;

-- Which version of the profile text the vector was computed from (updated_at
-- moves on every update, so it cannot tell).
alter table public.candidate_profiles add column if not exists embedding_hash text;
