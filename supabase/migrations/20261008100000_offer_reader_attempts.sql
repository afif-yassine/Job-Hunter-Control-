-- NON APPLIQUÉE — à appliquer par le propriétaire (migration additive).
-- Problème : une offre dont la lecture renvoie une réponse inexploitable reste sans résumé,
-- donc elle est reprise à chaque tranche et chaque reprise est un appel payant.
-- Remède : on compte les lectures inexploitables ; à 3 essais l'offre n'est plus réservée.
-- Le code fonctionne avant et après : sans cette migration, l'échec n'est simplement pas compté
-- (comportement actuel) ; avec elle, la limite s'applique. Aucun faux résumé n'est jamais écrit.
--
-- Offres devenues « illisibles » (à surveiller dans l'éditeur SQL) :
--   select count(*) from public.offers where status = 'open' and summary is null and reader_attempts >= 3;

alter table public.offers add column if not exists reader_attempts smallint not null default 0;

-- Même fonction qu'avant, avec le plafond de 3 essais.
create or replace function public.claim_offer_readings(p_limit integer default 60) returns jsonb
language sql volatile security invoker set search_path = public as $$
  with pending as (
    select id from public.offers
    where status='open' and summary is null and length(coalesce(description,'')) >= 120
      and reader_attempts < 3
      and (reader_until is null or reader_until < now())
    order by first_seen_at desc
    limit greatest(0,least(p_limit,60)) for update skip locked
  ), claimed as (
    update public.offers o set reader_token=gen_random_uuid(),reader_until=now()+interval '2 minutes',reader_source_hash=public.offer_reader_hash(o)
    from pending p where o.id=p.id
    returning o.id,o.title,o.company,o.location,o.contract_type,o.description,o.reader_token
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) from claimed;
$$;

-- Une lecture inexploitable de plus, seulement pour le porteur de la réservation en cours.
create or replace function public.record_offer_reading_failure(p_id uuid, p_token uuid) returns smallint
language sql volatile security invoker set search_path = public as $$
  update public.offers set reader_attempts = least(reader_attempts + 1, 100)::smallint
  where id = p_id and reader_token = p_token
  returning reader_attempts;
$$;
revoke all on function public.record_offer_reading_failure(uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_offer_reading_failure(uuid,uuid) to service_role;

-- Une annonce modifiée mérite de nouveaux essais : le compteur repart de zéro avec le résumé.
create or replace function public.invalidate_offer_reading() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if row(new.title,new.company,new.location,new.contract_type,new.description)
     is distinct from row(old.title,old.company,old.location,old.contract_type,old.description) then
    new.summary=null; new.reader_token=null; new.reader_until=null; new.reader_source_hash=null; new.reader_attempts=0;
  end if;
  return new;
end;
$$;
