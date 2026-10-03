-- Sprint 2 — platform harvest and job categories.
--
-- The platform collects offers twice a day for everybody (France Travail by
-- métier for the whole country, Adzuna in the big cities, every known careers
-- board), in slices resumed by /api/cron/harvest (Vercel stops a function
-- after 60 s). Each offer gets its categories (lib/scan/categories.ts) and
-- its contract kind (alternance, stage, cdd…). Applied to production as
-- "platform_harvest".

alter table public.offers add column if not exists categories text[] not null default '{}';
alter table public.offers add column if not exists contract_kind text;
create index if not exists offers_categories_idx on public.offers using gin (categories) where status = 'open';

create table if not exists public.harvest_runs (
  id text primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done', 'partial')),
  counters jsonb not null default '{}'
);
alter table public.harvest_runs enable row level security;

create table if not exists public.harvest_tasks (
  run_id text not null references public.harvest_runs (id) on delete cascade,
  key text not null,
  source text not null,
  params jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  next_index integer not null default 0,
  found integer not null default 0,
  error text,
  updated_at timestamptz not null default now(),
  primary key (run_id, key)
);
create index if not exists harvest_tasks_pending_idx on public.harvest_tasks (run_id) where status = 'pending';
alter table public.harvest_tasks enable row level security;
-- Both tables: service role only (no policy).

create or replace function public.upsert_offers(p_rows jsonb)
returns table (o_fingerprint text, o_id uuid, o_status text)
language plpgsql security definer set search_path = public as $$
declare
  v_reopened uuid[];
begin
  select coalesce(array_agg(o.id), '{}') into v_reopened
  from public.offers o
  where o.status <> 'open' and o.closed_reason <> 'reported'
    and o.fingerprint in (select r ->> 'fingerprint' from jsonb_array_elements(p_rows) r);

  return query
  insert into public.offers as o (fingerprint, title, company, location, contract_type, description, source, url,
                                  apply_url, published_at, rome_code, board, categories, contract_kind)
  select distinct on (r ->> 'fingerprint')
    r ->> 'fingerprint', left(r ->> 'title', 300), left(r ->> 'company', 200), nullif(r ->> 'location', ''),
    nullif(r ->> 'contract_type', ''), nullif(r ->> 'description', ''), coalesce(nullif(r ->> 'source', ''), 'inconnu'),
    r ->> 'url', nullif(r ->> 'apply_url', ''),
    case when r ->> 'published_at' ~ '^\d{4}-\d{2}-\d{2}' then left(r ->> 'published_at', 10)::date end,
    nullif(r ->> 'rome_code', ''), nullif(r ->> 'board', ''),
    coalesce(array(select jsonb_array_elements_text(case when jsonb_typeof(r -> 'categories') = 'array' then r -> 'categories' else '[]'::jsonb end)), '{}'),
    nullif(r ->> 'contract_kind', '')
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
    contract_kind = coalesce(excluded.contract_kind, o.contract_kind)
  returning o.fingerprint, o.id, o.status;

  if array_length(v_reopened, 1) > 0 then
    update public.jobs set gone_reason = null, gone_at = null
    where offer_id = any (v_reopened) and gone_reason is not null
      and gone_reason not like 'Tu as signalé%';
  end if;
end;
$$;

-- A full France Travail harvest finished: its offers in scope not seen since
-- the run started were removed by France Travail (licence: mirror deletions).
-- The text of a closed France Travail offer is dropped (licence, art. 7).
create or replace function public.close_unseen_offers(p_source text, p_since timestamptz, p_romes text[], p_rome_prefix text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  with gone as (
    update public.offers
    set status = 'closed', closed_reason = 'not_seen', closed_at = now(),
        description = case when p_source = 'francetravail' then null else description end
    where source = p_source and status = 'open' and last_seen_at < p_since
      and (rome_code = any (coalesce(p_romes, '{}')) or (p_rome_prefix <> '' and rome_code like p_rome_prefix || '%'))
      -- Only what the harvest asks for: apprenticeships and CDD of the last 31 days.
      and contract_kind in ('alternance', 'cdd')
      and (published_at is null or published_at >= (p_since - interval '30 days')::date)
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from gone;
  if array_length(v_ids, 1) > 0 then
    perform public.flag_gone_offers(v_ids, 'Retirée par France Travail.');
  end if;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;
revoke all on function public.close_unseen_offers(text, timestamptz, text[], text) from public, anon, authenticated;
grant execute on function public.close_unseen_offers(text, timestamptz, text[], text) to service_role;

-- Offers stored before the categories existed (or by an older version of the
-- rules) get them on the next harvest slice: see recategorize() in harvest.ts.
create function public.set_offer_categories(p_rows jsonb)
returns integer language sql security definer set search_path = public as $$
  with done as (
    update public.offers o
    set categories = coalesce(array(select jsonb_array_elements_text(r -> 'categories')), '{}'),
        contract_kind = r ->> 'contract_kind'
    from jsonb_array_elements(p_rows) r
    where o.id = (r ->> 'id')::uuid
    returning 1
  )
  select count(*)::int from done;
$$;
revoke all on function public.set_offer_categories(jsonb) from public, anon, authenticated;
grant execute on function public.set_offer_categories(jsonb) to service_role;
