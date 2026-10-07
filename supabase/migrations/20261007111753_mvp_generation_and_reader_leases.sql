-- One active kit per account makes the monthly allowance check serial, across jobs.
-- Expired leases contain no documents or profile data.
delete from public.document_generation_leases where expires_at < now();
alter table public.document_generation_leases drop constraint document_generation_leases_pkey;
alter table public.document_generation_leases add primary key(user_id);
-- Clients must not remove or forge their lease while the server is writing.
revoke all on public.document_generation_leases from authenticated;
revoke execute on function public.claim_document_generation(uuid,uuid),public.release_document_generation(uuid,uuid,uuid) from authenticated;
create or replace function public.claim_document_generation(p_job_id uuid, p_user_id uuid) returns uuid
language sql volatile security invoker set search_path = public as $$
  insert into public.document_generation_leases(user_id,job_id,expires_at)
  select p_user_id,p_job_id,now()+interval '2 minutes'
  where (p_user_id=(select auth.uid()) or current_user='service_role')
    and exists(select 1 from public.jobs where id=p_job_id and user_id=p_user_id)
  on conflict(user_id) do update set job_id=excluded.job_id,token=gen_random_uuid(),expires_at=excluded.expires_at
    where document_generation_leases.expires_at < now()
  returning token;
$$;

-- Shared readings are reserved before the paid call and saved only for their source version.
alter table public.offers add column reader_token uuid;
alter table public.offers add column reader_until timestamptz;
alter table public.offers add column reader_source_hash text;
alter table public.offers add column availability_check jsonb;
create function public.offer_reader_hash(o public.offers) returns text
language sql immutable security invoker set search_path = public as $$
  select md5(jsonb_build_array(o.title,o.company,o.location,o.contract_type,o.description)::text);
$$;
revoke all on function public.offer_reader_hash(public.offers) from public,anon,authenticated;
grant execute on function public.offer_reader_hash(public.offers) to service_role;

create function public.invalidate_offer_reading() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if row(new.title,new.company,new.location,new.contract_type,new.description)
     is distinct from row(old.title,old.company,old.location,old.contract_type,old.description) then
    new.summary=null; new.reader_token=null; new.reader_until=null; new.reader_source_hash=null;
  end if;
  return new;
end;
$$;
revoke all on function public.invalidate_offer_reading() from public,anon,authenticated;
grant execute on function public.invalidate_offer_reading() to service_role;
create trigger invalidate_offer_reading before update on public.offers
for each row execute function public.invalidate_offer_reading();

create function public.claim_offer_readings(p_limit integer default 60) returns jsonb
language sql volatile security invoker set search_path = public as $$
  with pending as (
    select id from public.offers
    where status='open' and summary is null and length(coalesce(description,'')) >= 120
      and (reader_until is null or reader_until < now())
    order by first_seen_at desc
    limit greatest(0,least(p_limit,60)) for update skip locked
  ), claimed as (
    update public.offers o set reader_token=gen_random_uuid(),reader_until=now()+interval '2 minutes',reader_source_hash=public.offer_reader_hash(o)
    from pending p where o.id=p.id
    returning o.id,o.title,o.company,o.location,o.contract_type,o.description,o.reader_token
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) from claimed;
$$;
create function public.finish_offer_reading(p_id uuid,p_token uuid,p_summary jsonb) returns boolean
language sql volatile security invoker set search_path = public as $$
  with saved as (
    update public.offers o set summary=p_summary || jsonb_build_object('source_hash',reader_source_hash),reader_token=null,reader_until=null,reader_source_hash=null
    where id=p_id and reader_token=p_token and reader_until>now() and status='open' and summary is null
      and reader_source_hash=public.offer_reader_hash(o) and jsonb_typeof(p_summary)='object'
    returning id
  ) select exists(select 1 from saved);
$$;
create function public.release_offer_readings(p_rows jsonb) returns void
language sql volatile security invoker set search_path = public as $$
  update public.offers o set reader_token=null,reader_until=null,reader_source_hash=null
  from jsonb_to_recordset(p_rows) as r(id uuid,token uuid)
  where o.id=r.id and o.reader_token=r.token;
$$;
revoke all on function public.claim_offer_readings(integer),public.finish_offer_reading(uuid,uuid,jsonb),public.release_offer_readings(jsonb) from public,anon,authenticated;
grant execute on function public.claim_offer_readings(integer),public.finish_offer_reading(uuid,uuid,jsonb),public.release_offer_readings(jsonb) to service_role;

-- Aggregate inside Postgres: the REST row limit must not truncate cost accounting.
create function public.admin_ai_usage_by_model(p_since timestamptz) returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(grouped)),'[]'::jsonb) from (
    select user_id,model,count(*) as calls,sum(input_tokens) as input_tokens,sum(output_tokens) as output_tokens,
      sum(cost_usd) as cost_usd,
      coalesce(sum(input_tokens) filter(where cost_usd is null),0) as unpriced_input,
      coalesce(sum(output_tokens) filter(where cost_usd is null),0) as unpriced_output
    from public.ai_usage where created_at >= p_since group by user_id,model
  ) grouped;
$$;
revoke all on function public.admin_ai_usage_by_model(timestamptz) from public,anon,authenticated;
grant execute on function public.admin_ai_usage_by_model(timestamptz) to service_role;
