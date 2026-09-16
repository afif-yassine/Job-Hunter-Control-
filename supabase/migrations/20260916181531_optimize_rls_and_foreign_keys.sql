alter policy candidate_profiles_owner_all on public.candidate_profiles to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy agent_rules_owner_all on public.agent_rules to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy jobs_owner_all on public.jobs to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy documents_owner_all on public.documents to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy applications_owner_all on public.applications to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy application_questions_owner_all on public.application_questions to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy notifications_owner_all on public.notifications to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy agent_schedules_owner_all on public.agent_schedules to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy agent_runs_owner_all on public.agent_runs to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy audit_events_owner_select on public.audit_events to authenticated using ((select auth.uid()) = user_id);
alter policy audit_events_owner_insert on public.audit_events to authenticated with check ((select auth.uid()) = user_id);

create index if not exists agent_runs_schedule_idx on public.agent_runs(schedule_id);
create index if not exists application_questions_user_idx on public.application_questions(user_id);
create index if not exists applications_job_idx on public.applications(job_id);
create index if not exists documents_based_on_idx on public.documents(based_on_document_id);
create index if not exists notifications_application_idx on public.notifications(application_id);
