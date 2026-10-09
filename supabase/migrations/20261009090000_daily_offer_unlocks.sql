-- NON APPLIQUÉE — à appliquer par le propriétaire, après test sur une copie de la base.
-- Sélection quotidienne : chaque compte non administrateur débloque au plus 8 offres du catalogue par
-- jour (heure de Paris). Une offre débloquée ne se verrouille jamais. Additive : aucune ligne existante
-- n'est modifiée ; le code fonctionne avant (table absente = tout est comme aujourd'hui) et après.
-- PRÉREQUIS DE MISE EN SERVICE : STUDENT_CATALOGUE_ONLY=1 posé dans Vercel AVANT d'appliquer cette
-- migration, sinon la recherche des sites d'emploi continue de remplir la liste de l'étudiant.

create table if not exists public.offer_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id uuid not null references public.offers (id) on delete cascade,
  unlocked_on date not null,
  -- daily = lot du jour ; backfill = offre déjà dans la liste du compte à la bascule
  origin text not null check (origin in ('daily', 'backfill')),
  created_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);
create index if not exists offer_unlocks_user_day_idx on public.offer_unlocks (user_id, unlocked_on desc);

-- L'étudiant lit ses lignes ; il n'écrit jamais (aucune règle d'écriture) : seul le serveur,
-- par la fonction ci-dessous, débloque.
alter table public.offer_unlocks enable row level security;
drop policy if exists offer_unlocks_owner_select on public.offer_unlocks;
create policy offer_unlocks_owner_select on public.offer_unlocks
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.offer_unlocks from anon, authenticated;

-- Débloque, pour p_user, les premières offres de p_offer_ids (ordre = priorité), au plus 8, et
-- seulement si le compte n'a pas déjà pris son lot du jour. Le verrou consultatif par compte rend
-- l'appel idempotent sous deux onglets : le second voit le lot du jour et n'ajoute rien.
-- Renvoie les offres NOUVELLEMENT débloquées (vide si le lot du jour existe déjà ou si rien ne passe).
create or replace function public.claim_daily_unlock(p_user uuid, p_offer_ids uuid[], p_limit integer default 8)
returns table (o_offer_id uuid)
language plpgsql security definer set search_path = public as $fn$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
begin
  perform pg_advisory_xact_lock(hashtextextended('daily_unlock:' || p_user::text, 0));
  if exists (select 1 from public.offer_unlocks where user_id = p_user and origin = 'daily' and unlocked_on = today) then
    return;
  end if;
  return query
    with taken as (
      insert into public.offer_unlocks (user_id, offer_id, unlocked_on, origin)
      select p_user, o.id, today, 'daily'
      from unnest(p_offer_ids) with ordinality as t(id, ord)
      join public.offers o on o.id = t.id and o.status = 'open'
      where not exists (select 1 from public.offer_unlocks u where u.user_id = p_user and u.offer_id = o.id)
      order by t.ord
      limit least(greatest(coalesce(p_limit, 0), 0), 8)
      on conflict do nothing
      returning offer_unlocks.offer_id
    )
    select taken.offer_id from taken;
end;
$fn$;
revoke all on function public.claim_daily_unlock(uuid, uuid[], integer) from public, anon, authenticated;
grant execute on function public.claim_daily_unlock(uuid, uuid[], integer) to service_role;

-- Comptes existants : toute offre déjà dans la liste d'un compte est débloquée d'office, avec la date
-- de la bascule (le front la range sous « Avant le … »). Rien n'est retiré à personne. Rejouable.
insert into public.offer_unlocks (user_id, offer_id, unlocked_on, origin)
select distinct j.user_id, j.offer_id, (now() at time zone 'Europe/Paris')::date, 'backfill'
from public.jobs j
join public.offers o on o.id = j.offer_id
where j.offer_id is not null
on conflict do nothing;
