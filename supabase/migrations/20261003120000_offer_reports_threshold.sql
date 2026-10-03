-- An offer is closed for everybody after 10 reports from different accounts
-- (was 2). One report still hides it for the account that reported it.
create or replace function public.report_offer_gone(p_job uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_offer uuid;
  v_count integer;
  -- Reports from different accounts needed to close an offer for everybody.
  c_threshold constant integer := 10;
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
  if v_count >= c_threshold then
    update public.offers set status = 'closed', closed_reason = 'reported', closed_at = now()
    where id = v_offer and status <> 'closed';
    perform public.flag_gone_offers(array[v_offer], 'Signalée comme plus disponible par ' || c_threshold || ' candidats.');
    return 'closed';
  end if;
  return 'reported';
end;
$$;
