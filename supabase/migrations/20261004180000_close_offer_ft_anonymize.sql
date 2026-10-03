-- An offer found gone when checked (just before writing a CV): closed for everybody.
create function public.close_offer(p_offer uuid, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
begin
  update public.offers set status = 'closed', closed_reason = 'board', closed_at = now()
  where id = p_offer and status = 'open';
  if not found then
    return 0;
  end if;
  return public.flag_gone_offers(array[p_offer], left(coalesce(p_reason, 'Offre retirée.'), 200));
end;
$$;
revoke all on function public.close_offer(uuid, text) from public, anon, authenticated;
grant execute on function public.close_offer(uuid, text) to service_role;

-- France Travail licence (art. 7): the text of an offer France Travail removed
-- is dropped from the catalogue AND from the lists of accounts that had not
-- applied to it.
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
      and contract_kind in ('alternance', 'cdd')
      and (published_at is null or published_at >= (p_since - interval '30 days')::date)
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from gone;
  if array_length(v_ids, 1) > 0 then
    perform public.flag_gone_offers(v_ids, 'Retirée par France Travail.');
    if p_source = 'francetravail' then
      update public.jobs set description = null
      where offer_id = any (v_ids)
        and status not in ('APPLYING', 'SUBMITTED', 'CONFIRMED', 'INTERVIEW', 'REJECTED');
    end if;
  end if;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;
