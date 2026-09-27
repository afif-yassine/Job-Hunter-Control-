-- Phase 1 (MVP): cross-platform de-duplication, offers to review (suspected,
-- probable duplicate, already applied elsewhere), model tracking and per-user
-- daily quotas. Additive only: the previous app version keeps working.
-- Safe to run more than once.

-- 1. Every link where an offer was seen (one offer, several platforms) ---------
create table if not exists public.job_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  platform text,
  url text not null,
  first_seen_at timestamptz not null default now(),
  unique (user_id, url)
);
create index if not exists job_sources_job_id_idx on public.job_sources (job_id);

alter table public.job_sources enable row level security;
drop policy if exists job_sources_owner_all on public.job_sources;
create policy job_sources_owner_all on public.job_sources
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Existing offers keep their link(s).
insert into public.job_sources (user_id, job_id, platform, url)
select user_id, id, source_platform, source_url from public.jobs where source_url is not null
on conflict (user_id, url) do nothing;
insert into public.job_sources (user_id, job_id, platform, url)
select user_id, id, source_platform, official_url from public.jobs
where official_url is not null and official_url is distinct from source_url
on conflict (user_id, url) do nothing;

-- 2. Offers the user must look at before anything is spent on them -----------
alter table public.jobs add column if not exists review_flag text;
alter table public.jobs add column if not exists review_reason text;
alter table public.jobs add column if not exists duplicate_of uuid references public.jobs(id) on delete set null;
alter table public.jobs add column if not exists score_model text;
do $$ begin
  alter table public.jobs add constraint jobs_review_flag_check
    check (review_flag in ('SUSPECTED', 'PROBABLE_DUPLICATE', 'ALREADY_APPLIED'));
exception when duplicate_object then null; end $$;
create index if not exists jobs_duplicate_of_idx on public.jobs (duplicate_of);

-- Which AI model wrote a document (switching model never mixes up history).
alter table public.documents add column if not exists model text;

-- 3. Daily quotas -----------------------------------------------------------
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('scan', 'analysis', 'generation')),
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_kind_time_idx
  on public.usage_events (user_id, kind, created_at desc);

alter table public.usage_events enable row level security;
-- Read and add only: a user cannot erase their own counter.
drop policy if exists usage_events_owner_select on public.usage_events;
create policy usage_events_owner_select on public.usage_events
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists usage_events_owner_insert on public.usage_events;
create policy usage_events_owner_insert on public.usage_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Counts today's uses (Paris day) and records one more if under the limit.
-- limit <= 0 means unlimited. Runs with the caller's rights (RLS applies).
create or replace function public.consume_quota(p_user_id uuid, p_kind text, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  used integer;
  day_start timestamptz := (date_trunc('day', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
begin
  if p_limit is null or p_limit <= 0 then
    return true;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_kind, 0));
  select count(*) into used from public.usage_events
    where user_id = p_user_id and kind = p_kind and created_at >= day_start;
  if used >= p_limit then
    return false;
  end if;
  insert into public.usage_events (user_id, kind) values (p_user_id, p_kind);
  return true;
end;
$$;

revoke all on function public.consume_quota(uuid, text, integer) from public, anon;
grant execute on function public.consume_quota(uuid, text, integer) to authenticated, service_role;
