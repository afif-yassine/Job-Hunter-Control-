-- Source budgets and source health are platform data: since the app writes
-- them with the service client only, signed-in accounts may no longer call
-- these functions themselves (Supabase security advisor: an account could
-- burn the shared free budget or fill the health journal).
-- Apply AFTER the app version that uses the service client is deployed.
revoke execute on function public.consume_source_budget(text, text, integer) from public, anon, authenticated;
revoke execute on function public.record_source_run(text, text, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.consume_source_budget(text, text, integer) to service_role;
grant execute on function public.record_source_run(text, text, integer, text, boolean) to service_role;
