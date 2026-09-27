-- Platform administration: who is admin, health of every offer source,
-- shared API budgets (e.g. JSearch free plan), a shared result cache and
-- alerts to admins when a source runs out of quota or breaks.
-- Additive and safe to run more than once.

-- 1. Admins --------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
drop policy if exists app_admins_self_select on public.app_admins;
create policy app_admins_self_select on public.app_admins
  for select to authenticated using ((select auth.uid()) = user_id);

-- Bootstrap: the first account of the platform becomes its admin.
insert into public.app_admins (user_id)
select id from auth.users
where not exists (select 1 from public.app_admins)
order by created_at asc
limit 1
on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- 2. Health of each source (one line per run) ----------------------------------
create table if not exists public.source_runs (
  id bigint generated always as identity primary key,
  source text not null,
  status text not null check (status in ('ok', 'quota', 'budget', 'auth', 'error')),
  found integer not null default 0,
  cached boolean not null default false,
  message text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists source_runs_source_time_idx on public.source_runs (source, created_at desc);
create index if not exists source_runs_user_id_idx on public.source_runs (user_id);
alter table public.source_runs enable row level security;
drop policy if exists source_runs_admin_select on public.source_runs;
create policy source_runs_admin_select on public.source_runs
  for select to authenticated using ((select public.is_admin()));

-- 3. Shared API budgets (whole platform, per period) ---------------------------
create table if not exists public.source_budget (
  source text not null,
  period text not null,
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (source, period)
);
alter table public.source_budget enable row level security;
drop policy if exists source_budget_admin_select on public.source_budget;
create policy source_budget_admin_select on public.source_budget
  for select to authenticated using ((select public.is_admin()));

-- 4. Shared cache of source results (written by the server only) --------------
create table if not exists public.source_cache (
  source text not null,
  cache_key text not null,
  offers jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (source, cache_key)
);
alter table public.source_cache enable row level security;
-- No policy: only the service role (server) reads and writes it.

-- Admins can read every account's daily usage (quota counters).
drop policy if exists usage_events_admin_select on public.usage_events;
create policy usage_events_admin_select on public.usage_events
  for select to authenticated using ((select public.is_admin()));

-- 5. Record a run, and alert the admins when a source has a problem -----------
-- One alert per source and problem every 6 hours, plus one when it recovers.
create or replace function public.record_source_run(
  p_source text,
  p_status text,
  p_found integer default 0,
  p_message text default null,
  p_cached boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous text;
  v_source text := left(coalesce(p_source, ''), 60);
  v_title text;
  v_body text;
begin
  if (select auth.uid()) is null and (select auth.role()) <> 'service_role' then
    return;
  end if;
  if p_status not in ('ok', 'quota', 'budget', 'auth', 'error') or v_source = '' then
    return;
  end if;

  select status into v_previous from public.source_runs
    where source = v_source and cached = false
    order by created_at desc limit 1;

  insert into public.source_runs (source, status, found, cached, message, user_id)
  values (v_source, p_status, greatest(coalesce(p_found, 0), 0), coalesce(p_cached, false),
          left(p_message, 500), (select auth.uid()));

  if p_status = 'ok' then
    if v_previous in ('quota', 'budget', 'auth', 'error') then
      v_title := format('Source rétablie : %s', v_source);
      v_body := 'La source fonctionne de nouveau.';
    else
      return;
    end if;
  else
    v_title := case p_status
      when 'quota' then format('Quota épuisé : %s', v_source)
      when 'budget' then format('Budget gratuit atteint : %s', v_source)
      when 'auth' then format('Clé refusée : %s', v_source)
      else format('Erreur de source : %s', v_source)
    end;
    v_body := coalesce(left(p_message, 300), 'Voir Admin > Sources.');
    if exists (
      select 1 from public.notifications
      where notification_type = 'SOURCE_ALERT' and notifications.title = v_title
        and created_at > now() - interval '6 hours'
    ) then
      return;
    end if;
  end if;

  insert into public.notifications (user_id, notification_type, title, message, delivery_channels)
  select a.user_id, 'SOURCE_ALERT', v_title, v_body, '["dashboard"]'::jsonb from public.app_admins a;
end;
$$;
revoke all on function public.record_source_run(text, text, integer, text, boolean) from public, anon;
grant execute on function public.record_source_run(text, text, integer, text, boolean) to authenticated, service_role;

-- 6. Consume one call of a shared budget (false = budget reached) -------------
create or replace function public.consume_source_budget(p_source text, p_period text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_used integer;
begin
  if (select auth.uid()) is null and (select auth.role()) <> 'service_role' then
    return false;
  end if;
  if p_limit is null or p_limit <= 0 then
    return true;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('budget:' || p_source || ':' || p_period, 0));
  select used into current_used from public.source_budget where source = p_source and period = p_period;
  if coalesce(current_used, 0) >= p_limit then
    return false;
  end if;
  insert into public.source_budget (source, period, used) values (left(p_source, 60), left(p_period, 20), 1)
  on conflict (source, period) do update set used = public.source_budget.used + 1, updated_at = now();
  return true;
end;
$$;
revoke all on function public.consume_source_budget(text, text, integer) from public, anon;
grant execute on function public.consume_source_budget(text, text, integer) to authenticated, service_role;

-- 7. Quality of each source over the last days (admins only) ------------------
create or replace function public.admin_source_stats(p_days integer default 30)
returns table (
  source text,
  offers bigint,
  links bigint,
  analyzed bigint,
  avg_score numeric,
  strong bigint,
  suspected bigint,
  to_review bigint,
  unreadable bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) and (select auth.role()) <> 'service_role' then
    raise exception 'admin only';
  end if;
  return query
  with j as (
    select
      case
        when source_platform like 'ats:%' then source_platform
        when source_platform like 'alert:%' then 'gmail'
        else split_part(coalesce(source_platform, 'manual'), ':', 1)
      end as src,
      match_score, review_flag, status, description
    from public.jobs
    where created_at > now() - make_interval(days => p_days)
  ),
  l as (
    select
      case
        when platform like 'ats:%' then platform
        when platform like 'alert:%' then 'gmail'
        else split_part(coalesce(platform, 'manual'), ':', 1)
      end as src,
      count(*) as n
    from public.job_sources
    where first_seen_at > now() - make_interval(days => p_days)
    group by 1
  )
  select
    j.src,
    count(*),
    coalesce(max(l.n), 0),
    count(*) filter (where j.match_score is not null),
    round(avg(j.match_score), 1),
    count(*) filter (where j.match_score >= 80),
    count(*) filter (where j.review_flag = 'SUSPECTED'),
    count(*) filter (where j.review_flag in ('PROBABLE_DUPLICATE', 'ALREADY_APPLIED')),
    count(*) filter (where j.description is null and j.status = 'DISCOVERED')
  from j left join l on l.src = j.src
  group by j.src
  order by 2 desc;
end;
$$;
revoke all on function public.admin_source_stats(integer) from public, anon;
grant execute on function public.admin_source_stats(integer) to authenticated, service_role;
