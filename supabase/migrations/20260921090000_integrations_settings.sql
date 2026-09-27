-- API keys entered from the dashboard (encrypted by the server) and per-user
-- search preferences. Safe to run more than once.

create table if not exists public.integrations (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null,
  secret_enc text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.integrations enable row level security;
drop policy if exists integrations_owner_all on public.integrations;
create policy integrations_owner_all on public.integrations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  scan_config jsonb,
  auto_scan boolean not null default true,
  last_scan_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
drop policy if exists user_settings_owner_all on public.user_settings;
create policy user_settings_owner_all on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
