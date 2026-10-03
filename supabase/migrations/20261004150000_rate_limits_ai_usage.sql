-- Sprint 1 — per-account request limits and AI cost per account.

create table if not exists public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, bucket, window_start)
);
alter table public.rate_limits enable row level security;

-- One hit for the signed-in account in this bucket; false once over the limit
-- for the current window. Only ever touches the caller's own counter.
create function public.hit_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_window timestamptz;
  v_hits integer;
begin
  if v_user is null then
    return false;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1));
  insert into public.rate_limits as r (user_id, bucket, window_start, hits)
  values (v_user, left(p_bucket, 40), v_window, 1)
  on conflict (user_id, bucket, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  -- Old windows are dropped now and then.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.hit_rate_limit(text, integer, integer) to authenticated;

-- Tokens of every AI call, per account (Admin: cost per account).
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
create policy "own ai usage readable" on public.ai_usage for select to authenticated using (user_id = auth.uid());
create policy "own ai usage insert" on public.ai_usage for insert to authenticated with check (user_id = auth.uid());
