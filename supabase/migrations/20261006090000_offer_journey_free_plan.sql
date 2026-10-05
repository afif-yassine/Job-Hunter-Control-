-- Sprint 6: the journey of each offer (new → seen → ready → applied → interview
-- → answer, or dismissed), the salary of catalogue offers, and the plan of each
-- account (free: 2 application kits per month).

-- 1. Journey of each offer, per account ------------------------------------------
alter table public.jobs
  add column if not exists stage text not null default 'new',
  add column if not exists stage_at timestamptz,
  add column if not exists seen_at timestamptz,
  add column if not exists applied_at timestamptz,
  add column if not exists interview_at timestamptz,
  add column if not exists notes text;

alter table public.jobs drop constraint if exists jobs_stage_check;
alter table public.jobs add constraint jobs_stage_check
  check (stage in ('new', 'seen', 'ready', 'applied', 'interview', 'offer', 'rejected', 'dismissed'));
alter table public.jobs drop constraint if exists jobs_notes_length;
alter table public.jobs add constraint jobs_notes_length check (notes is null or length(notes) <= 4000);

-- Existing offers start where their status already is.
update public.jobs set
  stage = case
    when status = 'SKIPPED' then 'dismissed'
    when status = 'REJECTED' then 'rejected'
    when status = 'INTERVIEW' then 'interview'
    when status in ('SUBMITTED', 'CONFIRMED', 'APPLYING') then 'applied'
    when status in ('WAITING_APPROVAL', 'PREPARED') then 'ready'
    when status = 'ANALYZED' then 'seen'
    else 'new'
  end,
  seen_at = case when status <> 'DISCOVERED' then coalesce(seen_at, updated_at) else seen_at end,
  applied_at = case when status in ('SUBMITTED', 'CONFIRMED', 'APPLYING', 'INTERVIEW', 'REJECTED') then coalesce(applied_at, updated_at) else applied_at end,
  stage_at = coalesce(stage_at, updated_at)
where stage = 'new';

create index if not exists jobs_user_stage_idx on public.jobs (user_id, stage);

-- The pipeline still moves `status`; the journey follows it forward only.
create or replace function public.sync_job_stage()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.status is distinct from old.status then
    if new.status in ('WAITING_APPROVAL', 'PREPARED') and new.stage in ('new', 'seen') then
      new.stage := 'ready';
    elsif new.status in ('SUBMITTED', 'CONFIRMED', 'APPLYING') and new.stage in ('new', 'seen', 'ready') then
      new.stage := 'applied';
      new.applied_at := coalesce(new.applied_at, now());
    elsif new.status = 'INTERVIEW' and new.stage not in ('interview', 'offer', 'rejected') then
      new.stage := 'interview';
    elsif new.status = 'REJECTED' and new.stage not in ('offer', 'rejected') then
      new.stage := 'rejected';
    elsif new.status = 'SKIPPED' then
      new.stage := 'dismissed';
    end if;
  end if;
  if new.stage is distinct from old.stage then
    new.stage_at := now();
    if new.stage <> 'new' then new.seen_at := coalesce(new.seen_at, now()); end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists jobs_sync_stage on public.jobs;
create trigger jobs_sync_stage before update on public.jobs
  for each row execute function public.sync_job_stage();

-- How many LeBonTaf students applied to the same offer (shown from 3, anonymous).
create or replace function public.offer_applicants(p_offer_ids uuid[])
returns table (offer_id uuid, applicants integer)
language sql
stable
security definer
set search_path = public
as $fn$
  select j.offer_id, count(distinct j.user_id)::integer
  from public.jobs j
  where j.offer_id = any (p_offer_ids)
    and j.stage in ('applied', 'interview', 'offer', 'rejected')
  group by j.offer_id
  having count(distinct j.user_id) >= 3;
$fn$;
revoke all on function public.offer_applicants(uuid[]) from public, anon;
grant execute on function public.offer_applicants(uuid[]) to authenticated, service_role;

-- 2. Salary of catalogue offers ------------------------------------------------
alter table public.offers add column if not exists salary text;
alter table public.offers drop constraint if exists offers_salary_length;
alter table public.offers add constraint offers_salary_length check (salary is null or length(salary) <= 160);

create or replace function public.upsert_offers(p_rows jsonb)
returns table (o_fingerprint text, o_id uuid, o_status text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reopened uuid[];
begin
  select coalesce(array_agg(o.id), '{}') into v_reopened
  from public.offers o
  where o.status <> 'open' and o.closed_reason <> 'reported'
    and o.fingerprint in (select r ->> 'fingerprint' from jsonb_array_elements(p_rows) r);

  return query
  insert into public.offers as o (fingerprint, title, company, location, contract_type, description, source, url,
                                  apply_url, published_at, rome_code, board, categories, contract_kind, salary)
  select distinct on (r ->> 'fingerprint')
    r ->> 'fingerprint', left(r ->> 'title', 300), left(r ->> 'company', 200), nullif(r ->> 'location', ''),
    nullif(r ->> 'contract_type', ''), nullif(r ->> 'description', ''), coalesce(nullif(r ->> 'source', ''), 'inconnu'),
    r ->> 'url', nullif(r ->> 'apply_url', ''),
    case when r ->> 'published_at' ~ '^\d{4}-\d{2}-\d{2}' then left(r ->> 'published_at', 10)::date end,
    nullif(r ->> 'rome_code', ''), nullif(r ->> 'board', ''),
    coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(r -> 'categories') = 'array' then r -> 'categories' else '[]'::jsonb end)), '{}'),
    nullif(r ->> 'contract_kind', ''),
    left(nullif(r ->> 'salary', ''), 160)
  from jsonb_array_elements(p_rows) r
  where coalesce(r ->> 'fingerprint', '') <> '' and coalesce(r ->> 'title', '') <> ''
    and coalesce(r ->> 'company', '') <> '' and coalesce(r ->> 'url', '') <> ''
  order by r ->> 'fingerprint', length(coalesce(r ->> 'description', '')) desc
  on conflict (fingerprint) do update set
    last_seen_at = now(),
    status = case when o.closed_reason = 'reported' then o.status else 'open' end,
    closed_reason = case when o.closed_reason = 'reported' then o.closed_reason end,
    closed_at = case when o.closed_reason = 'reported' then o.closed_at end,
    description = case when length(coalesce(excluded.description, '')) > length(coalesce(o.description, ''))
                       then excluded.description else o.description end,
    location = coalesce(o.location, excluded.location),
    contract_type = coalesce(o.contract_type, excluded.contract_type),
    apply_url = coalesce(o.apply_url, excluded.apply_url),
    published_at = coalesce(o.published_at, excluded.published_at),
    rome_code = coalesce(o.rome_code, excluded.rome_code),
    board = coalesce(o.board, excluded.board),
    categories = case when cardinality(excluded.categories) > 0 then excluded.categories else o.categories end,
    contract_kind = coalesce(excluded.contract_kind, o.contract_kind),
    salary = coalesce(excluded.salary, o.salary)
  returning o.fingerprint, o.id, o.status;

  if array_length(v_reopened, 1) > 0 then
    update public.jobs set gone_reason = null, gone_at = null
    where offer_id = any (v_reopened) and gone_reason is not null
      and gone_reason not like 'Tu as signalé%';
  end if;
end;
$fn$;
revoke all on function public.upsert_offers(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_offers(jsonb) to service_role;

-- 3. Plan of each account -------------------------------------------------------
alter table public.user_settings add column if not exists plan text not null default 'free';
alter table public.user_settings drop constraint if exists user_settings_plan_check;
alter table public.user_settings add constraint user_settings_plan_check check (plan in ('free', 'pro'));

-- The plan is set by the service (billing), never by the account itself.
create or replace function public.protect_user_plan()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    if tg_op = 'INSERT' then
      new.plan := 'free';
    elsif new.plan is distinct from old.plan then
      new.plan := old.plan;
    end if;
  end if;
  return new;
end;
$fn$;
drop trigger if exists user_settings_protect_plan on public.user_settings;
create trigger user_settings_protect_plan before insert or update on public.user_settings
  for each row execute function public.protect_user_plan();
