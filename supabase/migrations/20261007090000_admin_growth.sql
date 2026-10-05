-- Sprint 7 — separate admin space: growth statistics, launch levels, costs.

-- Cost of each AI call in dollars, priced by the model that answered
-- (lib/economics.ts). Platform calls (shared catalogue) have no account.
alter table public.ai_usage add column if not exists cost_usd numeric(12, 6);
alter table public.ai_usage alter column user_id drop not null;
create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);

-- Steps of the launch levels the admin ticks by hand (the others are
-- detected from the data).
create table if not exists public.admin_quests (
  id text primary key check (char_length(id) <= 60),
  done boolean not null default true,
  done_at timestamptz not null default now(),
  done_by uuid references auth.users (id) on delete set null
);
alter table public.admin_quests enable row level security;
create policy admin_quests_admin_all on public.admin_quests
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Everything the growth dashboard needs, in one call, for admins only.
create or replace function public.admin_growth_stats(p_month_start timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare
  v jsonb;
begin
  if not (select public.is_admin()) and (select auth.role()) <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with active as (
    select id as user_id, last_sign_in_at as at from auth.users
    union all select user_id, created_at from public.usage_events
    union all select user_id, stage_at from public.jobs where stage_at is not null
    union all select user_id, created_at from public.ai_usage where user_id is not null
  ),
  last_seen as (select user_id, max(at) as at from active group by user_id)
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'new_today', (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'new_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'active_1d', (select count(*) from last_seen where at >= now() - interval '1 day'),
    'active_7d', (select count(*) from last_seen where at >= now() - interval '7 days'),
    'active_30d', (select count(*) from last_seen where at >= now() - interval '30 days'),
    'pro', (select count(*) from public.user_settings where plan = 'pro'),
    'admins', (select count(*) from public.app_admins),
    'with_cv', (select count(distinct user_id) from public.candidate_profiles),
    'kits_month', (select count(distinct job_id) from public.documents where kind = 'TAILORED_CV' and created_at >= p_month_start),
    'applied_month', (select count(*) from public.jobs where applied_at >= p_month_start),
    'interviews_month', (select count(*) from public.jobs where stage in ('interview', 'offer') and stage_at >= p_month_start),
    'offers_open', (select count(*) from public.offers where status = 'open'),
    'offers_summarized', (select count(*) from public.offers where status = 'open' and summary is not null),
    'offers_embedded', (select count(*) from public.offers where status = 'open' and embedding is not null),
    'offers_new_7d', (select count(*) from public.offers where first_seen_at >= now() - interval '7 days'),
    'ai_month', (
      select jsonb_build_object('calls', count(*), 'input', coalesce(sum(input_tokens), 0), 'output', coalesce(sum(output_tokens), 0), 'usd', coalesce(sum(cost_usd), 0), 'unpriced', count(*) filter (where cost_usd is null))
      from public.ai_usage where created_at >= p_month_start
    ),
    'ai_by_model', (
      select coalesce(jsonb_agg(jsonb_build_object('model', model, 'calls', calls, 'input', input, 'output', output, 'usd', usd)), '[]'::jsonb)
      from (select model, count(*) calls, sum(input_tokens) input, sum(output_tokens) output, coalesce(sum(cost_usd), 0) usd
            from public.ai_usage where created_at >= p_month_start group by model) m
    ),
    'signups_30d', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
      from (select created_at::date d, count(*) n from auth.users where created_at >= now() - interval '30 days' group by 1) s
    )
  ) into v;
  return v;
end;
$fn$;
revoke all on function public.admin_growth_stats(timestamptz) from public, anon;
grant execute on function public.admin_growth_stats(timestamptz) to authenticated, service_role;
