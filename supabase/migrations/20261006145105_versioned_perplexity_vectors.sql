-- Preparation only: parallel storage; no rewrite of existing Gemini vectors.
alter table public.offers add column semantic_embedding extensions.vector(1024), add column semantic_model text, add column semantic_hash text;
alter table public.candidate_profiles add column semantic_embedding extensions.vector(1024), add column semantic_model text, add column semantic_hash text;
alter table public.offers add column semantic_claim_token uuid, add column semantic_claim_until timestamptz;
alter table public.candidate_profiles add column semantic_claim_token uuid, add column semantic_claim_until timestamptz;
create index offers_semantic_embedding_idx on public.offers using hnsw (semantic_embedding extensions.vector_cosine_ops) where status = 'open';

create function public.invalidate_semantic_embedding() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (tg_table_name = 'offers' and (to_jsonb(new) - array['semantic_embedding','semantic_model','semantic_hash']::text[]) -> 'description' is distinct from to_jsonb(old) -> 'description')
     or (tg_table_name = 'offers' and (to_jsonb(new) -> 'title' is distinct from to_jsonb(old) -> 'title' or to_jsonb(new) -> 'location' is distinct from to_jsonb(old) -> 'location' or to_jsonb(new) -> 'contract_type' is distinct from to_jsonb(old) -> 'contract_type' or to_jsonb(new) -> 'categories' is distinct from to_jsonb(old) -> 'categories'))
     or (tg_table_name = 'candidate_profiles' and to_jsonb(new) -> 'profile' is distinct from to_jsonb(old) -> 'profile') then
    new.semantic_embedding := null; new.semantic_model := null; new.semantic_hash := null;
    new.semantic_claim_token := null; new.semantic_claim_until := null;
    new.embedding := null;
    if tg_table_name = 'candidate_profiles' then new.embedding_hash := null; end if;
  end if;
  return new;
end; $$;
create trigger offers_semantic_invalidation before update on public.offers for each row execute function public.invalidate_semantic_embedding();
create trigger profile_semantic_invalidation before update on public.candidate_profiles for each row execute function public.invalidate_semantic_embedding();
revoke all on function public.invalidate_semantic_embedding() from public, anon, authenticated;

create function public.set_semantic_offer_embeddings(p_rows jsonb) returns integer
language sql security invoker set search_path = public, extensions as $$
  with done as (
    update public.offers o set semantic_embedding = (r ->> 'embedding')::extensions.vector(1024),
      semantic_model = 'perplexity/pplx-embed-v1-0.6b@retrieval-v1', semantic_hash = r ->> 'hash', semantic_claim_token=null, semantic_claim_until=null
    from jsonb_array_elements(p_rows) r
    where o.id = (r ->> 'id')::uuid and o.status = 'open' and o.semantic_embedding is null
      and o.semantic_claim_token=(r->>'token')::uuid
      and jsonb_build_object('title',o.title,'description',o.description,'location',o.location,'contract_type',o.contract_type,'categories',o.categories) = r -> 'source'
    returning 1
  ) select count(*)::integer from done;
$$;
revoke all on function public.set_semantic_offer_embeddings(jsonb) from public, anon, authenticated;
grant execute on function public.set_semantic_offer_embeddings(jsonb) to service_role;

create function public.claim_semantic_offers(p_limit integer default 50) returns jsonb
language sql volatile security invoker set search_path = public as $$
  with eligible as (
    select id from public.offers where status='open' and semantic_embedding is null
      and (semantic_claim_until is null or semantic_claim_until < now())
    order by id for update skip locked limit least(greatest(p_limit,1),50)
  ), claimed as (
    update public.offers o set semantic_claim_token=gen_random_uuid(), semantic_claim_until=now()+interval '2 minutes'
    from eligible e where o.id=e.id returning o.id,o.title,o.description,o.location,o.contract_type,o.categories,o.semantic_claim_token
  ) select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) from claimed;
$$;
create function public.release_semantic_offers(p_rows jsonb) returns void
language sql volatile security invoker set search_path = public as $$
  update public.offers o set semantic_claim_token=null,semantic_claim_until=null
  from jsonb_array_elements(p_rows) r where o.id=(r->>'id')::uuid and o.semantic_claim_token=(r->>'token')::uuid;
$$;
revoke all on function public.claim_semantic_offers(integer), public.release_semantic_offers(jsonb) from public, anon, authenticated;
grant execute on function public.claim_semantic_offers(integer), public.release_semantic_offers(jsonb) to service_role;

create function public.claim_semantic_profile(p_user_id uuid, p_hash text) returns uuid
language sql volatile security invoker set search_path = public as $$
  update public.candidate_profiles set semantic_claim_token=gen_random_uuid(), semantic_claim_until=now()+interval '2 minutes'
  where user_id=p_user_id and (p_user_id=(select auth.uid()) or current_user='service_role')
    and (semantic_embedding is null or semantic_hash is distinct from p_hash or semantic_model is distinct from 'perplexity/pplx-embed-v1-0.6b@retrieval-v1')
    and (semantic_claim_until is null or semantic_claim_until < now()) returning semantic_claim_token;
$$;
create function public.release_semantic_profile(p_user_id uuid, p_token uuid) returns void
language sql volatile security invoker set search_path = public as $$
  update public.candidate_profiles set semantic_claim_token=null,semantic_claim_until=null
  where user_id=p_user_id and (p_user_id=(select auth.uid()) or current_user='service_role') and semantic_claim_token=p_token;
$$;
revoke all on function public.claim_semantic_profile(uuid,text), public.release_semantic_profile(uuid,uuid) from public, anon;
grant execute on function public.claim_semantic_profile(uuid,text), public.release_semantic_profile(uuid,uuid) to authenticated, service_role;

create function public.set_semantic_profile_embedding(p_user_id uuid, p_profile jsonb, p_hash text, p_embedding text, p_skills text[], p_token uuid) returns boolean
language sql security invoker set search_path = public, extensions as $$
  with done as (
    update public.candidate_profiles set semantic_embedding = p_embedding::extensions.vector(1024),
      semantic_model = 'perplexity/pplx-embed-v1-0.6b@retrieval-v1', semantic_hash = p_hash, skills = p_skills, semantic_claim_token=null, semantic_claim_until=null
    where user_id = p_user_id and profile = p_profile and semantic_claim_token=p_token and (p_user_id = (select auth.uid()) or current_user = 'service_role') returning 1
  ) select exists(select 1 from done);
$$;
revoke all on function public.set_semantic_profile_embedding(uuid,jsonb,text,text,text[],uuid) from public, anon;
grant execute on function public.set_semantic_profile_embedding(uuid,jsonb,text,text,text[],uuid) to authenticated, service_role;

create function public.match_offers_for_me_v2(p_limit integer default 50)
returns table (offer_id uuid, similarity double precision, model text)
language sql stable security invoker set search_path = public, extensions as $$
  select o.id, 1 - (o.semantic_embedding <=> p.semantic_embedding), p.semantic_model
  from public.candidate_profiles p join public.offers o on o.status='open'
    and o.semantic_embedding is not null and o.semantic_model = p.semantic_model
  where p.user_id = (select auth.uid()) and p.semantic_embedding is not null
    and p.semantic_model = 'perplexity/pplx-embed-v1-0.6b@retrieval-v1'
  order by o.semantic_embedding <=> p.semantic_embedding limit least(greatest(p_limit,1),500);
$$;
revoke all on function public.match_offers_for_me_v2(integer) from public, anon;
grant execute on function public.match_offers_for_me_v2(integer) to authenticated;

create function public.my_job_fit_v2()
returns table (job_id uuid, similarity double precision, matched text[], missing text[], model text)
language sql stable security invoker set search_path = public, extensions as $$
  with mine as (
    select j.id, o.semantic_embedding oe, p.semantic_embedding pe, o.semantic_model om, p.semantic_model pm, p.skills ps,
      case when jsonb_typeof(o.summary -> 'skills')='array' then o.summary -> 'skills' else '[]'::jsonb end sk
    from public.jobs j join public.offers o on o.id=j.offer_id join public.candidate_profiles p on p.user_id=j.user_id
    where j.user_id=(select auth.uid()) and p.semantic_model='perplexity/pplx-embed-v1-0.6b@retrieval-v1'
  ) select id, case when oe is not null and pe is not null and om=pm then 1-(oe <=> pe) end,
    array(select s from jsonb_array_elements_text(sk) s where s=any(ps)),
    array(select s from jsonb_array_elements_text(sk) s where not(s=any(ps))), pm from mine;
$$;
revoke all on function public.my_job_fit_v2() from public, anon;
grant execute on function public.my_job_fit_v2() to authenticated;

-- A reservation spans serverless instances; only its token can release it.
create table public.document_generation_leases (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null,
  primary key(user_id, job_id)
);
alter table public.document_generation_leases enable row level security;
revoke all on public.document_generation_leases from public, anon, authenticated;
grant select, insert, update, delete on public.document_generation_leases to authenticated;
grant all on public.document_generation_leases to service_role;
create policy document_generation_lease_owner on public.document_generation_leases for all to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()) and exists(select 1 from public.jobs j where j.id=job_id and j.user_id=(select auth.uid())));
create function public.claim_document_generation(p_job_id uuid, p_user_id uuid) returns uuid
language sql volatile security invoker set search_path = public as $$
  insert into public.document_generation_leases(user_id,job_id,expires_at)
  select p_user_id, p_job_id, now()+interval '2 minutes'
  where (p_user_id=(select auth.uid()) or current_user='service_role')
    and exists(select 1 from public.jobs where id=p_job_id and user_id=p_user_id)
  on conflict(user_id,job_id) do update set token=gen_random_uuid(), expires_at=excluded.expires_at
    where document_generation_leases.expires_at < now()
  returning token;
$$;
create function public.release_document_generation(p_job_id uuid, p_user_id uuid, p_token uuid) returns void
language sql volatile security invoker set search_path = public as $$
  delete from public.document_generation_leases where user_id=p_user_id and (p_user_id=(select auth.uid()) or current_user='service_role') and job_id=p_job_id and token=p_token;
$$;
revoke all on function public.claim_document_generation(uuid,uuid), public.release_document_generation(uuid,uuid,uuid) from public, anon;
grant execute on function public.claim_document_generation(uuid,uuid), public.release_document_generation(uuid,uuid,uuid) to authenticated, service_role;
