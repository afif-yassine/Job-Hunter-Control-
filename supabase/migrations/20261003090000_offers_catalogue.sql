-- Sprint 1 — shared offers catalogue.
--
-- An offer is stored once for the whole platform (public.offers); each
-- account keeps its own state on it in public.jobs (score, status, documents),
-- linked by jobs.offer_id. Searches are cached per query and shared, so ten
-- students looking for "alternance développeur" in Paris cost one API call.
--
-- Availability, in three layers:
--   1. not seen by any search for 21 days      → expired (reopens if seen again)
--   2. gone from the company's careers board   → closed  (reopens if relisted)
--   3. reported "plus disponible" by 2 accounts → closed  (stays closed)
-- Accounts holding a gone offer (not applied yet) see it under
-- "Plus disponibles" (jobs.gone_reason set), and nothing more is spent on it.
-- Applied to production in three parts (tables, link, functions).

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  title text not null,
  company text not null,
  location text,
  contract_type text,
  description text,
  source text not null,
  url text not null,
  apply_url text,
  published_at date,
  rome_code text,
  -- Careers board it was read from ("greenhouse:acme"), for closure detection.
  board text,
  status text not null default 'open' check (status in ('open', 'expired', 'closed')),
  closed_reason text check (closed_reason in ('not_seen', 'board', 'reported')),
  closed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists offers_open_seen_idx on public.offers (last_seen_at) where status = 'open';
create index if not exists offers_board_idx on public.offers (board) where board is not null;

alter table public.offers enable row level security;
create policy "offers readable by signed-in users" on public.offers for select to authenticated using (true);
-- Writes: service role and the functions below only.

create table if not exists public.offer_reports (
  offer_id uuid not null references public.offers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (offer_id, user_id)
);
alter table public.offer_reports enable row level security;
create policy "own offer reports" on public.offer_reports for select to authenticated using (user_id = auth.uid());

alter table public.jobs add column if not exists offer_id uuid references public.offers (id) on delete set null;
create index if not exists jobs_offer_id_idx on public.jobs (offer_id);

-- Why the offer is no longer available for this account (null = available).
alter table public.jobs add column if not exists gone_reason text;
alter table public.jobs add column if not exists gone_at timestamptz;

-- Existing offers move into the catalogue --------------------------------------
insert into public.offers (fingerprint, title, company, location, contract_type, description, source, url, apply_url,
                           published_at, rome_code, first_seen_at, last_seen_at)
select distinct on (fingerprint)
  fingerprint, title, company, location, contract_type, description, coalesce(source_platform, 'manuel'),
  coalesce(source_url, official_url), official_url, publication_date, rome_code, created_at, created_at
from public.jobs
where fingerprint is not null and coalesce(source_url, official_url) is not null
order by fingerprint, length(coalesce(description, '')) desc, created_at desc
on conflict (fingerprint) do nothing;

update public.jobs j set offer_id = o.id
from public.offers o
where o.fingerprint = j.fingerprint and j.offer_id is null;

-- Gone offers → flag the accounts that have not applied yet --------------------
create function public.flag_gone_offers(p_ids uuid[], p_reason text)
returns integer
language sql
security definer
set search_path = public
as $$
  with flagged as (
    update public.jobs
    set gone_reason = p_reason, gone_at = now()
    where offer_id = any (p_ids)
      and gone_reason is null
      and status not in ('APPLYING', 'SUBMITTED', 'CONFIRMED', 'INTERVIEW', 'REJECTED', 'SKIPPED')
    returning 1
  )
  select count(*)::int from flagged;
$$;
revoke all on function public.flag_gone_offers(uuid[], text) from public, anon, authenticated;

-- Harvest: insert or refresh offers seen by a search ---------------------------
-- p_rows: [{fingerprint,title,company,location,contract_type,description,
--           source,url,apply_url,published_at,rome_code,board}]
create function public.upsert_offers(p_rows jsonb)
returns table (o_fingerprint text, o_id uuid, o_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reopened uuid[];
begin
  -- Seen again: an offer expired or taken off a board is back (not a reported one).
  select coalesce(array_agg(o.id), '{}') into v_reopened
  from public.offers o
  where o.status <> 'open' and o.closed_reason <> 'reported'
    and o.fingerprint in (select r ->> 'fingerprint' from jsonb_array_elements(p_rows) r);

  return query
  insert into public.offers as o (fingerprint, title, company, location, contract_type, description, source, url,
                                  apply_url, published_at, rome_code, board)
  select distinct on (r ->> 'fingerprint')
    r ->> 'fingerprint', left(r ->> 'title', 300), left(r ->> 'company', 200), nullif(r ->> 'location', ''),
    nullif(r ->> 'contract_type', ''), nullif(r ->> 'description', ''), coalesce(nullif(r ->> 'source', ''), 'inconnu'),
    r ->> 'url', nullif(r ->> 'apply_url', ''),
    case when r ->> 'published_at' ~ '^\d{4}-\d{2}-\d{2}' then left(r ->> 'published_at', 10)::date end,
    nullif(r ->> 'rome_code', ''), nullif(r ->> 'board', '')
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
    board = coalesce(o.board, excluded.board)
  returning o.fingerprint, o.id, o.status;

  if array_length(v_reopened, 1) > 0 then
    update public.jobs set gone_reason = null, gone_at = null
    where offer_id = any (v_reopened) and gone_reason is not null
      and gone_reason not like 'Tu as signalé%';
  end if;
end;
$$;
revoke all on function public.upsert_offers(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_offers(jsonb) to service_role;

-- Layer 1: not seen for p_days ---------------------------------------------------
create function public.expire_offers(p_days integer default 21)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  with gone as (
    update public.offers
    set status = 'expired', closed_reason = 'not_seen', closed_at = now()
    where status = 'open' and last_seen_at < now() - make_interval(days => greatest(p_days, 7))
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from gone;
  if array_length(v_ids, 1) > 0 then
    perform public.flag_gone_offers(v_ids, 'Plus vue sur aucun site depuis ' || greatest(p_days, 7) || ' jours : elle a sans doute été pourvue.');
  end if;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;
revoke all on function public.expire_offers(integer) from public, anon, authenticated;
grant execute on function public.expire_offers(integer) to service_role;

-- Layer 2: read the whole careers board, the missing offers are closed -----------
create function public.close_board_offers(p_board text, p_urls text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  with gone as (
    update public.offers
    set status = 'closed', closed_reason = 'board', closed_at = now()
    where board = p_board and status = 'open' and not (url = any (coalesce(p_urls, '{}')))
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from gone;
  if array_length(v_ids, 1) > 0 then
    perform public.flag_gone_offers(v_ids, 'Retirée de la page carrière de l’entreprise.');
  end if;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;
revoke all on function public.close_board_offers(text, text[]) from public, anon, authenticated;
grant execute on function public.close_board_offers(text, text[]) to service_role;

-- Layer 3: "Offre plus disponible" pressed by the signed-in user ----------------
create function public.report_offer_gone(p_job uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_offer uuid;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  select offer_id into v_offer from public.jobs where id = p_job and user_id = v_user;
  if not found then
    raise exception 'job not found';
  end if;
  update public.jobs
  set gone_reason = 'Tu as signalé que cette offre n’est plus disponible.', gone_at = now()
  where id = p_job and user_id = v_user;
  if v_offer is null then
    return 'local';
  end if;
  insert into public.offer_reports (offer_id, user_id) values (v_offer, v_user) on conflict do nothing;
  select count(*) into v_count from public.offer_reports where offer_id = v_offer;
  if v_count >= 2 then
    update public.offers set status = 'closed', closed_reason = 'reported', closed_at = now()
    where id = v_offer and status <> 'closed';
    perform public.flag_gone_offers(array[v_offer], 'Signalée comme plus disponible par d’autres candidats.');
    return 'closed';
  end if;
  return 'reported';
end;
$$;
revoke all on function public.report_offer_gone(uuid) from public, anon;
grant execute on function public.report_offer_gone(uuid) to authenticated;
